import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  onSnapshot, doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { todayStr, weekStartStr, formatDateJP, greetingText, nDaysAgoStr, prevDateStr } from '../utils/dateUtils'
import { getAllRecords, getRecordByDate } from '../utils/localStore'
import { evaluateBadges } from '../utils/badges'
import { getLocalCurrentWeekGoal } from '../utils/weeklyGoal'

const MOOD_MAP = {
  best:      { emoji: '🤩', label: '最高！' },
  good:      { emoji: '😊', label: 'いい感じ' },
  frustrate: { emoji: '😤', label: 'くやしい' },
  tired:     { emoji: '😴', label: 'つかれた' },
  moody:     { emoji: '😶', label: 'モヤモヤ' },
}

const DAILY_MESSAGES = [
  '今日の練習はどうだった？',
  'きのうより、ちょっとだけ上手くなろう！',
  '今日のよかったこと、書いてみよう。',
  '今日はどんなプレーができたかな？',
  '小さな一歩が、大きな力になるよ。',
  '毎日の記録が、未来の自分へのプレゼント！',
  'プロ選手もみんな、ふりかえりをしてるよ。',
  'うまくいったことも、うまくいかなかったことも宝物。',
  '続けてるだけで、もうすごい！',
  '今日の自分をほめてあげよう！',
  '失敗しても大丈夫。そこから学べるから。',
  'チームメイトのいいところも見つけてみよう！',
  '次にがんばりたいこと、のこしておこう。',
  '自分で考えて動ける選手になろう！',
]

const AFTER_RECORD_MESSAGES = [
  '今日もふりかえりできたね！えらい！',
  'ちゃんと書けたね。その調子！',
  '振り返れる選手は、かならず伸びるよ！',
  'おつかれさま！ゆっくり休んでね。',
  '今日も成長の1ページが増えたね！',
]

function getDailyMessage() {
  const d = new Date()
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  return DAILY_MESSAGES[seed % DAILY_MESSAGES.length]
}

function getAfterRecordMessage() {
  const d = new Date()
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  return AFTER_RECORD_MESSAGES[seed % AFTER_RECORD_MESSAGES.length]
}

/** スタンプ表示マップ（子ども側） */
const REACTION_MAP = {
  'mitayo':     '👀 みたよ！',
  'kaketa':     '✏️ きょうも書けたね！',
  'tsuzukete':  '🔥 続けてるね、すごい！',
  'furikaeri':  '💡 ふりかえれたね！',
  'ganbatta':   '💪 がんばったね！',
  'sugoi':      '🌟 すごい！',
  'ashita':     '⭐ 明日もたのしみ！',
  'seichou':    '🌱 成長してるよ！',
  'otukare':    '☕ おつかれさま！',
  'daijoubu':   '🌈 だいじょうぶだよ！',
  'nexttime':   '✊ つぎはきっと！',
  'yukkuri':    '🍀 ゆっくりでいいよ！',
  'nice':       '👍 NICE!',
  'good':       '👏 GOOD!',
  'awesome':    '🔥 AWESOME!',
  'keepgoing':  '💫 KEEP GOING!',
  'proud':      '🏆 PROUD OF YOU!',
  'takeiteasy': '😌 TAKE IT EASY!',
  'mokuhyou':   '🎯 もくひょうがはっきりしてるね！',
  'tsukare':    '💫 つかれてても書けたのえらいね！',
}

/** 親ホーム簡易スタンプ（6種） */
const HOME_QUICK_STAMPS = [
  { type: 'nice',     emoji: '👍', label: 'NICE!' },
  { type: 'good',     emoji: '👏', label: 'GOOD!' },
  { type: 'sugoi',    emoji: '🌟', label: 'すごい！' },
  { type: 'mitayo',   emoji: '👀', label: 'みたよ！' },
  { type: 'ganbatta', emoji: '💪', label: 'がんばったね' },
  { type: 'otukare',  emoji: '☕', label: 'おつかれさま' },
]

export default function Home() {
  const { user, profile, isTrial, isChild, isParent } = useAuth()
  const { showToast } = useToast()
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

  // 親ホーム：簡易スタンプ送信用
  const [homeStampSent, setHomeStampSent] = useState(new Set())
  const [homeStampSending, setHomeStampSending] = useState(false)

  useEffect(() => {
    const unsubs = []
    loadData(unsubs)
    return () => unsubs.forEach(fn => fn())
  }, [user, isTrial])

  async function loadData(unsubs) {
    let parentSnapshotStarted = false  // 親はonSnapshot内でsetLoading(false)するためフラグ管理
    try {
      let records = []
      const yesterday = nDaysAgoStr(1)

      if (isTrial) {
        const rec = getRecordByDate(today)
        setTodayRecord(rec)
        setYesterdayRecord(getRecordByDate(yesterday))
        records = getAllRecords()
        setStreak(calcStreak(records.map(r => r.date)))
        const wg = getLocalCurrentWeekGoal()
        if (wg?.goalText) setWeeklyGoalText(wg.goalText)
        setTotalRecordDays(records.length)
        if (records.length >= 3 && !localStorage.getItem('nobi_nudge_dismissed')) {
          setShowNudge(true)
        }
      } else if (user && isChild) {
        const thirtyAgo = nDaysAgoStr(30)
        const recQ = query(
          collection(db, 'dailyRecords'),
          where('uid', '==', user.uid),
          where('date', '>=', thirtyAgo),
        )
        const recSnap = await getDocs(recQ)
        records = recSnap.docs.map(d => d.data()).sort((a, b) => b.date.localeCompare(a.date))
        const todayRec = records.find(r => r.date === today)
        setTodayRecord(todayRec || null)
        const yRec = records.find(r => r.date === yesterday)
        if (yRec) setYesterdayRecord(yRec)
        setStreak(calcStreak(records.map(r => r.date)))
        setTotalRecordDays(new Set(records.map(r => r.date)).size)

        // 週間目標
        try {
          const ws = weekStartStr()
          const { getDoc, doc: docRef } = await import('firebase/firestore')
          const goalSnap = await getDoc(docRef(db, 'weeklyGoals', `${user.uid}_${ws}`))
          if (goalSnap.exists()) {
            const gd = goalSnap.data()
            if (gd.goalText) setWeeklyGoalText(gd.goalText)
          }
        } catch (_) {}

        // リアルタイム: 親からのスタンプ（直近3日分）
        const rQ = query(
          collection(db, 'parentReactions'),
          where('childUid', '==', user.uid),
          where('date', '>=', nDaysAgoStr(2)),
        )
        const unsubReactions = onSnapshot(rQ, (snap) => {
          setParentReactions(snap.docs.map(d => d.data()))
        }, () => {})
        unsubs.push(unsubReactions)

      } else if (user && isParent) {
        const childUid = profile?.childUid || null
        if (!childUid) { setLoading(false); return }
        parentSnapshotStarted = true  // finally での setLoading(false) を抑制
        let firstCallback = true
        const todayQ = query(
          collection(db, 'dailyRecords'),
          where('uid', '==', childUid),
          where('date', '==', today),
        )
        const unsubRecord = onSnapshot(todayQ, (snap) => {
          if (!snap.empty) setTodayRecord(snap.docs[0].data())
          else setTodayRecord(null)
          // 初回コールバック時のみローディングを解除（ちらつき防止）
          if (firstCallback) { firstCallback = false; setLoading(false) }
        }, (err) => {
          console.error(err)
          if (firstCallback) { firstCallback = false; setLoading(false) }
        })
        unsubs.push(unsubRecord)
      }

      if (isChild) {
        const s = calcStreak(records.map(r => r.date))
        const badgeStats = {
          streak: s,
          totalGoals: records.filter(r => r.nextGoal).length,
          totalPlays: records.filter(r => r.myPlay).length,
          totalConcerns: records.filter(r => r.concern).length,
        }
        const result = evaluateBadges(badgeStats, [])
        setBadgeCount(result.earned.length)
      }
    } catch (e) { console.error(e) }
    finally {
      // 親のonSnapshotケースは初回コールバック内でsetLoading(false)するため除外
      if (!parentSnapshotStarted) setLoading(false)
    }
  }

  /** 親ホームから簡易スタンプ送信 */
  async function sendHomeStamp(reactionType) {
    if (!user || !profile?.childUid) return
    setHomeStampSending(true)
    try {
      const childUid = profile.childUid
      const docId = `${user.uid}_${childUid}_${today}_${reactionType}`
      await setDoc(doc(db, 'parentReactions', docId), {
        parentUid: user.uid,
        childUid,
        date: today,
        reactionType,
        createdAt: serverTimestamp(),
      })
      setHomeStampSent(prev => new Set([...prev, reactionType]))
      showToast('スタンプを送りました！', 'success')
    } catch (e) {
      console.error(e)
      showToast('送れませんでした', 'error')
    } finally {
      setHomeStampSending(false)
    }
  }

  const name = profile?.nickname || 'せんしゅ'
  const isSunday = new Date().getDay() === 0

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>
  }

  const showStats = totalRecordDays >= 3
  const sortedReactions = [...parentReactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const hasReactionsToday = sortedReactions.some(r => r.date === today)

  return (
    <div>
      {/* おためし常設バナー */}
      {isTrial && isChild && (
        <div style={{
          background: 'var(--primary)',
          color: '#fff',
          borderRadius: 'var(--r-md)',
          padding: '10px 14px',
          marginBottom: 'var(--sp-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          <p style={{ fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
            おためし中です。登録するとデータが消えないよ！
          </p>
          <button
            style={{
              background: '#fff',
              color: 'var(--primary)',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              padding: '5px 10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: 'var(--font)',
            }}
            onClick={() => navigate('/welcome', { state: { fromSettings: true } })}
          >
            登録する
          </button>
        </div>
      )}

      {/* ============================================
          子ども：記録前
          ============================================ */}
      {isChild && !todayRecord && (
        <>
          {/* ヒーロー */}
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            {isTrial && (
              <span className="trial-badge">おためし中</span>
            )}
          </div>

          {/* マスコット + 日替わりメッセージ */}
          <div className="mascot-area">
            <div className="mascot-ball-wrap" aria-hidden="true">
              <svg className="mascot-svg" viewBox="0 0 40 40" width="36" height="36" focusable="false">
                <circle cx="20" cy="20" r="18" fill="var(--primary)" />
                <path d="M8 14 Q20 6 32 14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 26 Q20 34 32 26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mascot-bubble">
              <p>{getDailyMessage()}</p>
            </div>
          </div>

          {/* 親からのスタンプ通知（リアルタイム・直近3日） */}
          {sortedReactions.length > 0 && (
            <div className="stamp-notification" aria-live="polite">
              <p className="stamp-notification-title">
                {hasReactionsToday ? 'おうちの人からスタンプがとどいたよ！' : 'おうちの人からの最近のスタンプ'}
              </p>
              <div className="reactions-display">
                {sortedReactions.map((r, i) => (
                  <span key={i} className="reaction-stamp">
                    {REACTION_MAP[r.reactionType] || r.reactionType}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 主CTA */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-lg)' }}>
            <button className="btn btn-primary cta-main" onClick={() => navigate('/record')}>
              きょうのふりかえりを書く
            </button>
            <p className="text-xs text-hint" style={{ marginTop: 6 }}>
              書けるところだけで大丈夫！
            </p>
          </div>

          {/* 昨日の自分カード */}
          {yesterdayRecord && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '1.3rem' }}>{MOOD_MAP[yesterdayRecord.mood]?.emoji || '—'}</span>
                <span className="text-xs text-muted font-bold">きのうの自分</span>
              </div>
              {yesterdayRecord.myPlay && (
                <p className="text-xs" style={{ marginBottom: 3, lineHeight: 1.5 }}>
                  {yesterdayRecord.myPlay.length > 30 ? yesterdayRecord.myPlay.slice(0, 30) + '…' : yesterdayRecord.myPlay}
                </p>
              )}
              {yesterdayRecord.nextGoal && (
                <p className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                  → {yesterdayRecord.nextGoal.length > 30 ? yesterdayRecord.nextGoal.slice(0, 30) + '…' : yesterdayRecord.nextGoal}
                </p>
              )}
              {!yesterdayRecord.myPlay && !yesterdayRecord.nextGoal && (
                <p className="text-xs text-muted">記録あり</p>
              )}
            </div>
          )}

          {/* 統計（3日以上） */}
          {showStats && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--sp-md)' }}>
              <div className="mini-stat-card">
                <p className="mini-stat-value" style={{ color: 'var(--primary)' }}>
                  {streak}<span className="mini-stat-unit">日</span>
                </p>
                <p className="mini-stat-label">連続きろく</p>
              </div>
              <div className="mini-stat-card">
                <p className="mini-stat-value">
                  {totalRecordDays}<span className="mini-stat-unit">日</span>
                </p>
                <p className="mini-stat-label">きろく日数</p>
              </div>
            </div>
          )}

          {/* 週間目標 */}
          {weeklyGoalText && (
            <button type="button" onClick={() => navigate('/goal')} className="goal-card-link">
              <span className="text-xs text-primary font-bold">今週のもくひょう</span>
              <p className="text-sm font-bold" style={{ marginTop: 2 }}>{weeklyGoalText}</p>
            </button>
          )}

          {/* 日曜振り返り */}
          {isSunday && weeklyGoalText && (
            <button type="button" className="card card-warning" onClick={() => navigate('/goal')} style={{ cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              <div className="card-title">今週のふりかえり</div>
              <p className="text-sm" style={{ lineHeight: 1.6 }}>
                「{weeklyGoalText.length > 20 ? weeklyGoalText.slice(0, 20) + '…' : weeklyGoalText}」はどうだった？
              </p>
            </button>
          )}

          {/* おためしナッジ */}
          {isTrial && showNudge && (
            <div style={{
              position: 'relative', padding: '14px 16px',
              background: 'var(--primary-bg)', borderRadius: 'var(--r-md)',
              marginBottom: 'var(--sp-md)',
            }}>
              <button onClick={() => { setShowNudge(false); localStorage.setItem('nobi_nudge_dismissed', '1') }}
                aria-label="閉じる"
                style={{
                  position: 'absolute', top: 8, right: 12,
                  background: 'none', border: 'none', fontSize: '0.85rem',
                  color: 'var(--text-3)', cursor: 'pointer',
                }}>✕</button>
              <p className="font-bold text-sm" style={{ marginBottom: 4 }}>
                {streak}日も続けてるね！
              </p>
              <p className="text-xs text-muted" style={{ lineHeight: 1.6, marginBottom: 8 }}>
                登録するとデータが安全に保存されるよ
              </p>
              <button className="btn btn-primary btn-sm"
                onClick={() => navigate('/welcome', { state: { fromSettings: true } })}>
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
            <span className="recorded-badge">きろく済み</span>
          </div>

          {/* マスコット + 達成ひとこと */}
          <div className="mascot-area">
            <div className="mascot-ball-wrap" aria-hidden="true">
              <svg className="mascot-svg" viewBox="0 0 40 40" width="36" height="36" focusable="false">
                <circle cx="20" cy="20" r="18" fill="var(--success)" />
                <path d="M12 20 L18 26 L28 14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="mascot-bubble">
              <p>{getAfterRecordMessage()}</p>
            </div>
          </div>

          {/* 今日の気分 */}
          {todayRecord.mood && (
            <div style={{ textAlign: 'center', padding: '10px', marginBottom: 'var(--sp-md)' }}>
              <span style={{ fontSize: '2.2rem' }}>{MOOD_MAP[todayRecord.mood]?.emoji}</span>
              <p className="text-xs text-muted font-bold" style={{ marginTop: 2 }}>{MOOD_MAP[todayRecord.mood]?.label}</p>
            </div>
          )}

          {/* 親からのスタンプ（リアルタイム・直近3日） */}
          {sortedReactions.length > 0 && (
            <div className="stamp-notification" aria-live="polite">
              <p className="stamp-notification-title">
                {hasReactionsToday ? 'おうちの人からのスタンプ' : 'おうちの人からの最近のスタンプ'}
              </p>
              <div className="reactions-display">
                {sortedReactions.map((r, i) => (
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
              <p className="mini-stat-value" style={{ color: 'var(--primary)' }}>
                {streak}<span className="mini-stat-unit">日</span>
              </p>
              <p className="mini-stat-label">連続きろく</p>
            </div>
            <div className="mini-stat-card">
              <p className="mini-stat-value">
                {totalRecordDays}<span className="mini-stat-unit">日</span>
              </p>
              <p className="mini-stat-label">きろく日数</p>
            </div>
          </div>

          {/* ストリーク */}
          {streak >= 3 && (
            <div className="streak-card">
              <p className="streak-card-num">{streak}日連続きろく中！</p>
              <p className="streak-card-sub">
                {streak >= 30 ? 'すごすぎ！伝説だ！' : streak >= 14 ? 'プロ選手みたいだ！' : streak >= 7 ? '1週間達成！' : 'いい感じ！続けよう！'}
              </p>
            </div>
          )}

          {/* 週間目標 */}
          {weeklyGoalText && (
            <button type="button" onClick={() => navigate('/goal')} className="goal-card-link">
              <span className="text-xs text-primary font-bold">今週のもくひょう</span>
              <p className="text-sm font-bold" style={{ marginTop: 2 }}>{weeklyGoalText}</p>
            </button>
          )}

          {/* バッジ */}
          {badgeCount > 0 && (
            <button type="button" onClick={() => navigate('/badges')} className="goal-card-link"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span className="text-sm font-bold">バッジ {badgeCount}個</span>
              <span className="text-xs text-primary">見る →</span>
            </button>
          )}

          {/* 修正リンク */}
          <p className="text-center" style={{ marginTop: 'var(--sp-sm)' }}>
            <button type="button" className="text-sm text-muted" style={{ cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
              onClick={() => navigate('/record')}>
              記録を見る・修正する →
            </button>
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

          {!!profile?.childUid ? (
            <>
              {/* 今日の記録ステータス */}
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
                      記録されています
                    </p>
                    {todayRecord.mood && (
                      <p className="text-sm" style={{ marginTop: 6 }}>
                        気分: {MOOD_MAP[todayRecord.mood]?.emoji} {MOOD_MAP[todayRecord.mood]?.label}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-bold text-muted">まだ書いていないようです</p>
                    <p className="text-xs text-muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
                      記録が見えないときは、子ども側で<br />今日の記録が保存されているか確認してください。
                    </p>
                  </>
                )}
              </div>

              {/* 今日の記録がある場合：簡易スタンプ送信 */}
              {todayRecord && (
                <div className="card" style={{ background: 'var(--primary-bg)', padding: '16px' }}>
                  <p className="text-sm font-bold" style={{ marginBottom: 12, color: 'var(--primary-dark)' }}>
                    スタンプを送って励ましましょう
                  </p>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                  }}>
                    {HOME_QUICK_STAMPS.map(({ type, emoji, label }) => {
                      const sent = homeStampSent.has(type)
                      return (
                        <button
                          key={type}
                          onClick={() => !sent && sendHomeStamp(type)}
                          disabled={homeStampSending || sent}
                          aria-label={`${label}${sent ? '（送信済み）' : ''}`}
                          style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 4,
                            padding: '10px 4px',
                            background: sent ? 'var(--success-bg)' : 'var(--surface)',
                            border: sent ? '1.5px solid var(--success-light)' : '1.5px solid var(--border)',
                            borderRadius: 'var(--r-sm)',
                            cursor: sent ? 'default' : 'pointer',
                            fontFamily: 'var(--font)',
                            opacity: homeStampSending && !sent ? 0.6 : 1,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: '1.4rem', lineHeight: 1 }} aria-hidden="true">
                            {sent ? '✅' : emoji}
                          </span>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700,
                            color: sent ? 'var(--success-dark)' : 'var(--text-1)',
                            lineHeight: 1.2, textAlign: 'center',
                          }}>
                            {label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: 10, textAlign: 'center' }}>
                    くわしいスタンプは「みまもり画面」から送れます
                  </p>
                </div>
              )}
            </>
          ) : (
            /* 未連携時：ステップを具体的に案内 */
            <div className="card" style={{ background: 'var(--warning-bg)' }}>
              <p className="font-bold" style={{ color: 'var(--accent-dark)', marginBottom: 8 }}>
                まだお子さんと連携されていません
              </p>
              <div style={{
                fontSize: '0.84rem', color: 'var(--accent-dark)',
                lineHeight: 1.8, marginBottom: 12,
              }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>連携するには</p>
                <p>① お子さんのスマホで「設定」画面を開く</p>
                <p>② 「あなたの招待コード」（6文字）を確認する</p>
                <p>③ 下のボタンから招待コードを入力する</p>
              </div>
              <button className="btn btn-primary btn-sm" style={{ width: 'auto' }}
                onClick={() => navigate('/settings')}>
                招待コードを入力する →
              </button>
            </div>
          )}

          <button className="btn btn-primary btn-lg" onClick={() => navigate('/parent')}
            style={{ marginBottom: 'var(--sp-md)' }}>
            みまもり画面を開く
          </button>
          <p className="text-xs text-hint text-center" style={{ lineHeight: 1.6 }}>
            お子さんの記録を確認して<br />スタンプで気持ちを伝えましょう
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
