import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, weekStartStr, formatDateJP, greetingText, nDaysAgoStr, prevDateStr } from '../utils/dateUtils'
import { getAllRecords, getRecordByDate } from '../utils/localStore'
import { evaluateBadges, getEarnedBadgeIds, saveEarnedBadgeIds } from '../utils/badges'
import { getLocalCurrentWeekGoal } from '../utils/weeklyGoal'

const MOOD_MAP = {
  best:      { emoji: '🤩', label: '最高！' },
  good:      { emoji: '😊', label: 'いい感じ' },
  frustrate: { emoji: '😤', label: 'くやしい' },
  tired:     { emoji: '😴', label: 'つかれた' },
  moody:     { emoji: '😶', label: 'モヤモヤ' },
}

const DAILY_MESSAGES = [
  'きょうも1日おつかれさま！ふりかえりを書いてみよう。',
  'きのうより、ちょっとだけ上手くなろう！',
  '書くだけで成長してるよ！すごい！',
  '今日はどんなプレーができたかな？',
  '小さな一歩が、大きな力になるよ。',
  '毎日の記録が、未来の自分へのプレゼント！',
  'プロ選手もみんな、ふりかえりをしてるよ。',
  'うまくいったことも、うまくいかなかったことも宝物。',
  '続けてるだけで、もうすごいんだよ！',
  '今日の自分をほめてあげよう！',
  '失敗しても大丈夫。そこから学べるから。',
  'チームメイトのいいところも見つけてみよう！',
  '目標がある人は、練習がもっと楽しくなるよ。',
  '自分で考えて動ける選手になろう！',
]

const AFTER_RECORD_MESSAGES = [
  '今日もふりかえりできたね！えらい！',
  'ちゃんと書けたね！その調子！',
  '振り返れる選手は、かならず伸びるよ！',
  'おつかれさま！ゆっくり休んでね。',
  '今日も成長の1ページが増えたね！',
]

function getDailyMessage() {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  return DAILY_MESSAGES[seed % DAILY_MESSAGES.length]
}

function getAfterRecordMessage() {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  return AFTER_RECORD_MESSAGES[seed % AFTER_RECORD_MESSAGES.length]
}

/** 全スタンプの表示用マップ（子ども側で使用） */
const REACTION_MAP = {
  'mitayo':     '👀 みたよ！',
  'kaketa':     '✏️ 書けたね',
  'tsuzukete':  '🔥 続けてるのすごい',
  'furikaeri':  '💡 ふりかえれたね',
  'ganbatta':   '💪 がんばったね',
  'sugoi':      '🌟 すごい！',
  'ashita':     '⭐ 明日もたのしみ',
  'seichou':    '🌱 成長してるよ',
  'otukare':    '☕ おつかれさま',
  'daijoubu':   '🌈 だいじょうぶだよ',
  'nexttime':   '✊ つぎはきっと！',
  'yukkuri':    '🍀 ゆっくりでいいよ',
  'nice':       '👍 NICE!',
  'good':       '👏 GOOD!',
  'awesome':    '🔥 AWESOME!',
  'keepgoing':  '💫 KEEP GOING!',
  'proud':      '🏆 PROUD OF YOU!',
  'takeiteasy': '😌 TAKE IT EASY!',
  // 旧スタンプ後方互換
  'mokuhyou':   '🎯 もくひょうがはっきりしてるね',
  'tsukare':    '💫 つかれてても書けたのえらいね',
}

export default function Home() {
  const { user, profile, isTrial, isChild, isParent } = useAuth()
  const navigate = useNavigate()
  const today = todayStr()

  const [todayRecord, setTodayRecord] = useState(null)
  const [streak, setStreak] = useState(0)
  const [badgeCount, setBadgeCount] = useState(0)
  const [weeklyGoalText, setWeeklyGoalText] = useState('')
  const [yesterdayRecord, setYesterdayRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showNudge, setShowNudge] = useState(false)
  const [totalRecordDays, setTotalRecordDays] = useState(0)
  const [parentReactions, setParentReactions] = useState([])

  useEffect(() => { loadData() }, [user, isTrial])

  async function loadData() {
    try {
      let records = []
      const yesterday = nDaysAgoStr(1)

      if (isTrial) {
        /* ===== おためしモード（子ども） ===== */
        const rec = getRecordByDate(today)
        setTodayRecord(rec)
        setYesterdayRecord(getRecordByDate(yesterday))
        records = getAllRecords()
        setStreak(calcStreak(records.map(r => r.date)))
        const wg = getLocalCurrentWeekGoal()
        if (wg?.goalText) setWeeklyGoalText(wg.goalText)
        setTotalRecordDays(records.length)
        if (records.length >= 3 && !localStorage.getItem('nudgeDismissed')) {
          setShowNudge(true)
        }
      } else if (user && isChild) {
        /* ===== 登録済み子ども ===== */
        const todayQ = query(collection(db, 'dailyRecords'), where('uid', '==', user.uid), where('date', '==', today))
        const todaySnap = await getDocs(todayQ)
        if (!todaySnap.empty) setTodayRecord(todaySnap.docs[0].data())

        const thirtyAgo = nDaysAgoStr(30)
        const recQ = query(collection(db, 'dailyRecords'), where('uid', '==', user.uid), where('date', '>=', thirtyAgo), orderBy('date', 'desc'))
        const recSnap = await getDocs(recQ)
        records = recSnap.docs.map(d => d.data())
        setStreak(calcStreak(records.map(r => r.date)))

        const yRec = records.find(r => r.date === yesterday)
        if (yRec) setYesterdayRecord(yRec)
        setTotalRecordDays(new Set(records.map(r => r.date)).size)

        // 親からのリアクションを取得
        try {
          const rQ = query(collection(db, 'parentReactions'), where('childUid', '==', user.uid), where('date', '==', today))
          const rSnap = await getDocs(rQ)
          setParentReactions(rSnap.docs.map(d => d.data()))
        } catch (_) {}
      } else if (user && isParent && profile?.childUid) {
        /* ===== 登録済み保護者 — 子どもの今日の記録を確認 ===== */
        try {
          const childUid = profile.childUid
          const todayQ = query(collection(db, 'dailyRecords'), where('uid', '==', childUid), where('date', '==', today))
          const todaySnap = await getDocs(todayQ)
          if (!todaySnap.empty) setTodayRecord(todaySnap.docs[0].data())
        } catch (_) {}
      }

      // バッジ計算（子どものみ）
      if (isChild) {
        const s = calcStreak(records.map(r => r.date))
        const badgeStats = {
          streak: s,
          totalGoals: records.filter(r => r.nextGoal).length,
          totalPlays: records.filter(r => r.myPlay).length,
          totalConcerns: records.filter(r => r.concern).length,
        }
        const prevIds = getEarnedBadgeIds()
        const result = evaluateBadges(badgeStats, prevIds)
        setBadgeCount(result.earned.length)
        saveEarnedBadgeIds(result.earned.map(b => b.id))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const name = profile?.nickname || 'せんしゅ'
  const isSunday = new Date().getDay() === 0

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>
  }

  const showStats = totalRecordDays >= 3

  return (
    <div>
      {/* ============================================
          子ども：記録前
          ============================================ */}
      {isChild && !todayRecord && (
        <>
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            {isTrial && (
              <span className="text-xs" style={{
                display: 'inline-block', marginTop: 4,
                background: 'var(--primary-bg)', color: 'var(--primary-dark)',
                padding: '2px 10px', borderRadius: 'var(--r-full)', fontWeight: 700,
              }}>おためし中</span>
            )}
          </div>

          {/* マスコット + ひとこと */}
          <div className="mascot-area">
            <div className="mascot-ball">⚾</div>
            <div className="mascot-bubble">
              <p>{getDailyMessage()}</p>
            </div>
          </div>

          {/* 親からのスタンプ通知 */}
          {parentReactions.length > 0 && (
            <div className="stamp-notification">
              <p className="stamp-notification-title">
                💌 おうちの人からスタンプがとどいたよ！
              </p>
              <div className="reactions-display">
                {parentReactions.map((r, i) => (
                  <span key={i} className="reaction-stamp">
                    {REACTION_MAP[r.reactionType] || r.reactionType}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 主CTA */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-md)' }}>
            <button className="btn btn-primary cta-main" onClick={() => navigate('/record')}
              style={{ fontSize: '1.1rem', padding: '18px 24px' }}>
              📝 きょうのふりかえりを書く
            </button>
            <p className="text-xs text-hint" style={{ marginTop: 8 }}>
              1分で書けるよ！
            </p>
          </div>

          {/* 昨日の自分カード */}
          {yesterdayRecord && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '1.6rem' }}>{MOOD_MAP[yesterdayRecord.mood]?.emoji || '📝'}</span>
                <p className="text-xs text-muted font-bold">きのうの自分</p>
              </div>
              {yesterdayRecord.myPlay && (
                <p className="text-xs" style={{ marginBottom: 4, lineHeight: 1.5 }}>
                  ⭐ {yesterdayRecord.myPlay.length > 30 ? yesterdayRecord.myPlay.slice(0, 30) + '…' : yesterdayRecord.myPlay}
                </p>
              )}
              {yesterdayRecord.nextGoal && (
                <p className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                  🎯 {yesterdayRecord.nextGoal.length > 30 ? yesterdayRecord.nextGoal.slice(0, 30) + '…' : yesterdayRecord.nextGoal}
                </p>
              )}
              {!yesterdayRecord.myPlay && !yesterdayRecord.nextGoal && (
                <p className="text-xs text-muted">記録あり</p>
              )}
            </div>
          )}

          {/* 統計（3日以上から表示） */}
          {showStats && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--sp-md)' }}>
              <div className="mini-stat-card">
                <p className="font-bold" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
                  {streak}<span className="text-xs text-muted"> 日</span>
                </p>
                <p className="text-xs text-muted">連続きろく</p>
              </div>
              <div className="mini-stat-card">
                <p className="font-bold" style={{ fontSize: '1.2rem' }}>
                  {totalRecordDays}<span className="text-xs text-muted"> 日</span>
                </p>
                <p className="text-xs text-muted">きろく日数</p>
              </div>
            </div>
          )}

          {/* 週間もくひょう */}
          {weeklyGoalText && (
            <div onClick={() => navigate('/goal')}
              style={{
                cursor: 'pointer', padding: '12px 16px',
                background: 'var(--primary-bg)', borderRadius: 'var(--r-md)',
                marginBottom: 'var(--sp-md)',
              }}>
              <p className="text-xs text-primary font-bold" style={{ marginBottom: 4 }}>🎯 今週のもくひょう</p>
              <p className="text-sm font-bold">{weeklyGoalText}</p>
            </div>
          )}

          {/* 日曜振り返り */}
          {isSunday && weeklyGoalText && (
            <div className="card card-warning" onClick={() => navigate('/goal')} style={{ cursor: 'pointer' }}>
              <div className="card-title">📋 今週のふりかえり</div>
              <p className="text-sm" style={{ lineHeight: 1.6 }}>
                「{weeklyGoalText.length > 20 ? weeklyGoalText.slice(0, 20) + '…' : weeklyGoalText}」はどうだった？
              </p>
            </div>
          )}

          {/* おためしナッジ */}
          {isTrial && showNudge && (
            <div style={{
              position: 'relative', padding: '16px',
              background: 'var(--primary-bg)', borderRadius: 'var(--r-md)',
              marginBottom: 'var(--sp-md)',
            }}>
              <button onClick={() => { setShowNudge(false); localStorage.setItem('nudgeDismissed', '1') }}
                style={{
                  position: 'absolute', top: 8, right: 12,
                  background: 'none', border: 'none', fontSize: '0.9rem',
                  color: 'var(--text-3)', cursor: 'pointer',
                }}>✕</button>
              <p className="font-bold text-sm" style={{ marginBottom: 4 }}>
                🎉 {streak}日も続けてるね！
              </p>
              <p className="text-xs text-muted" style={{ lineHeight: 1.6, marginBottom: 8 }}>
                登録するとデータが安全に保存されるよ
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/settings')}>
                無料で登録する →
              </button>
            </div>
          )}
        </>
      )}

      {/* ============================================
          子ども：記録後
          ============================================ */}
      {isChild && todayRecord && (
        <>
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            <span className="recorded-badge">✅ きろく済み</span>
          </div>

          {/* マスコット + 達成ひとこと */}
          <div className="mascot-area">
            <div className="mascot-ball">⚾</div>
            <div className="mascot-bubble">
              <p>{getAfterRecordMessage()}</p>
            </div>
          </div>

          {/* 今日の気分 */}
          {todayRecord.mood && (
            <div style={{
              textAlign: 'center', padding: '12px',
              marginBottom: 'var(--sp-md)',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 4 }}>
                {MOOD_MAP[todayRecord.mood]?.emoji}
              </div>
              <p className="font-bold text-muted">{MOOD_MAP[todayRecord.mood]?.label}</p>
            </div>
          )}

          {/* 親からのスタンプ */}
          {parentReactions.length > 0 && (
            <div className="stamp-notification">
              <p className="stamp-notification-title">
                💌 おうちの人からのスタンプ
              </p>
              <div className="reactions-display">
                {parentReactions.map((r, i) => (
                  <span key={i} className="reaction-stamp">
                    {REACTION_MAP[r.reactionType] || r.reactionType}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 統計 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--sp-md)' }}>
            <div className="mini-stat-card">
              <p className="font-bold" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
                {streak}<span className="text-xs text-muted"> 日</span>
              </p>
              <p className="text-xs text-muted">連続きろく</p>
            </div>
            <div className="mini-stat-card">
              <p className="font-bold" style={{ fontSize: '1.2rem' }}>
                {totalRecordDays}<span className="text-xs text-muted"> 日</span>
              </p>
              <p className="text-xs text-muted">きろく日数</p>
            </div>
          </div>

          {/* ストリーク応援 */}
          {streak >= 3 && (
            <div style={{
              background: 'var(--primary)',
              color: '#fff', textAlign: 'center', borderRadius: 'var(--r-md)',
              padding: '16px', marginBottom: 'var(--sp-md)',
            }}>
              <p style={{ fontSize: '1.3rem', marginBottom: 4 }}>
                {streak >= 30 ? '🏅' : streak >= 14 ? '🥇' : streak >= 7 ? '⭐' : '🔥'}
              </p>
              <p className="font-bold" style={{ fontSize: '0.95rem' }}>{streak}日連続きろく中！</p>
              <p className="text-sm" style={{ opacity: 0.85, marginTop: 4 }}>
                {streak >= 30 ? 'すごすぎ！伝説だ！' : streak >= 14 ? 'プロ選手みたいだ！' : streak >= 7 ? '1週間達成！' : 'いい感じ！続けよう！'}
              </p>
            </div>
          )}

          {/* 週間もくひょう */}
          {weeklyGoalText && (
            <div onClick={() => navigate('/goal')}
              style={{
                cursor: 'pointer', padding: '12px 16px',
                background: 'var(--primary-bg)', borderRadius: 'var(--r-md)',
                marginBottom: 'var(--sp-md)',
              }}>
              <p className="text-xs text-primary font-bold" style={{ marginBottom: 4 }}>🎯 今週のもくひょう</p>
              <p className="text-sm font-bold">{weeklyGoalText}</p>
            </div>
          )}

          {/* バッジ */}
          {badgeCount > 0 && (
            <div onClick={() => navigate('/badges')}
              style={{
                cursor: 'pointer', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--surface)', borderRadius: 'var(--r-md)',
                marginBottom: 'var(--sp-md)',
              }}>
              <span className="text-sm font-bold">🏆 バッジ {badgeCount}個</span>
              <span className="text-xs text-primary">コレクションを見る →</span>
            </div>
          )}

          {/* 修正リンク */}
          <p className="text-center" style={{ marginBottom: 8 }}>
            <span className="text-sm text-muted" style={{ cursor: 'pointer' }}
              onClick={() => navigate('/record')}>
              ✏️ 記録を見る・修正する →
            </span>
          </p>
        </>
      )}

      {/* ============================================
          保護者ホーム
          ============================================ */}
      {!isChild && (
        <>
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}さん</h2>
            <p className="home-status">お子さんの様子を見てみましょう</p>
          </div>

          {/* 子どもの今日の記録ステータス */}
          {profile?.childUid ? (
            <div className="card" style={{
              background: todayRecord ? 'var(--success-bg)' : 'var(--surface)',
              textAlign: 'center',
            }}>
              <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
                お子さんの今日の記録
              </p>
              {todayRecord ? (
                <>
                  <p className="font-bold" style={{ color: 'var(--success-dark)' }}>
                    ✅ 記録されています
                  </p>
                  {todayRecord.mood && (
                    <p className="text-sm" style={{ marginTop: 6 }}>
                      気分: {MOOD_MAP[todayRecord.mood]?.emoji} {MOOD_MAP[todayRecord.mood]?.label}
                    </p>
                  )}
                </>
              ) : (
                <p className="font-bold">📝 まだ書いていないようです</p>
              )}
            </div>
          ) : (
            <div className="card" style={{
              background: 'var(--warning-bg)', textAlign: 'center',
            }}>
              <p className="text-sm" style={{ color: 'var(--accent-dark)', lineHeight: 1.6 }}>
                お子さんのIDが未設定です。<br />
                設定画面で入力してください。
              </p>
              <button className="btn btn-outline btn-sm mt-sm" style={{ width: 'auto' }}
                onClick={() => navigate('/settings')}>
                設定画面へ →
              </button>
            </div>
          )}

          <button className="btn btn-primary btn-lg" onClick={() => navigate('/parent')}
            style={{ marginBottom: 'var(--sp-md)' }}>
            👀 みまもり画面を開く
          </button>
          <p className="text-xs text-hint text-center" style={{ lineHeight: 1.6 }}>
            お子さんの記録を確認して、スタンプで気持ちを伝えましょう
          </p>
        </>
      )}
    </div>
  )
}

function calcStreak(dates) {
  const sorted = [...new Set(dates)].sort().reverse()
  let s = 0, cur = todayStr()
  for (const d of sorted) {
    if (d === cur) { s++; cur = prevDateStr(cur) }
    else break
  }
  return s
}
