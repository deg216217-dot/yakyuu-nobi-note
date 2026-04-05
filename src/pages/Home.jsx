import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, weekStartStr, formatDateJP, greetingText, nDaysAgoStr, prevDateStr } from '../utils/dateUtils'
import { getAllRecords, getRecordByDate, getAllMenus } from '../utils/localStore'
import { evaluateBadges, getEarnedBadgeIds, saveEarnedBadgeIds } from '../utils/badges'
import { getLocalCurrentWeekGoal } from '../utils/weeklyGoal'

const MOOD_MAP = {
  best:      { emoji: '🤩', label: '最高！' },
  good:      { emoji: '😊', label: 'まあまあ' },
  frustrate: { emoji: '😤', label: 'くやしい' },
  tired:     { emoji: '😴', label: 'つかれた' },
  moody:     { emoji: '😶', label: 'モヤモヤ' },
}

export default function Home() {
  const { user, profile, isTrial, isChild } = useAuth()
  const navigate = useNavigate()
  const today = todayStr()

  const [todayRecord, setTodayRecord] = useState(null)
  const [weekMinutes, setWeekMinutes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [badgeCount, setBadgeCount] = useState(0)
  const [weeklyGoalText, setWeeklyGoalText] = useState('')
  const [yesterdayRecord, setYesterdayRecord] = useState(null)
  const [teamTodayCount, setTeamTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showNudge, setShowNudge] = useState(false)

  useEffect(() => { loadData() }, [user, isTrial])

  async function loadData() {
    try {
      let records = [], menus = []
      const yesterday = nDaysAgoStr(1)

      if (isTrial) {
        const rec = getRecordByDate(today)
        setTodayRecord(rec)
        setYesterdayRecord(getRecordByDate(yesterday))
        records = getAllRecords()
        menus = getAllMenus()
        const ws = weekStartStr()
        setWeekMinutes(records.filter(r => r.date >= ws && r.date <= today).reduce((s, r) => s + (r.totalMinutes || 0), 0))
        setStreak(calcStreak(records.map(r => r.date)))
        const wg = getLocalCurrentWeekGoal()
        if (wg?.goalText) setWeeklyGoalText(wg.goalText)
        // 3日以上記録 → 登録ナッジ表示
        if (records.length >= 3 && !localStorage.getItem('nudgeDismissed')) {
          setShowNudge(true)
        }
      } else if (user) {
        const todayQ = query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '==', today))
        const todaySnap = await getDocs(todayQ)
        if (!todaySnap.empty) setTodayRecord(todaySnap.docs[0].data())

        const ws = weekStartStr()
        const weekQ = query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '>=', ws), where('date', '<=', today))
        const weekSnap = await getDocs(weekQ)
        let wm = 0; weekSnap.forEach(d => wm += d.data().totalMinutes || 0); setWeekMinutes(wm)

        const thirtyAgo = nDaysAgoStr(30)
        const recQ = query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '>=', thirtyAgo), orderBy('date', 'desc'))
        const recSnap = await getDocs(recQ)
        records = recSnap.docs.map(d => d.data())
        setStreak(calcStreak(records.map(r => r.date)))

        const mSnap = await getDocs(query(collection(db, 'trainingMenus'), where('uid', '==', user.uid), where('date', '>=', thirtyAgo)))
        menus = mSnap.docs.map(d => d.data())

        const yRec = records.find(r => r.date === yesterday)
        if (yRec) setYesterdayRecord(yRec)

        try {
          const teamQ = query(collection(db, 'publicSummaries'), where('date', '==', today), where('teamCode', '==', profile?.teamCode || 'default'))
          const teamSnap = await getDocs(teamQ)
          setTeamTodayCount(teamSnap.size)
        } catch (_) {}
      }

      if (isChild) {
        const s = calcStreak(records.map(r => r.date))
        const todayRec = records.find(r => r.date === today)
        const ws = weekStartStr()
        const weekRecs = records.filter(r => r.date >= ws && r.date <= today)
        const weekMenus = menus.filter(m => m.date >= ws && m.date <= today)
        const badgeStats = {
          streak: s,
          todayMinutes: todayRec?.totalMinutes || 0,
          weekMinutes: weekRecs.reduce((sum, r) => sum + (r.totalMinutes || 0), 0),
          weekMenuTypes: new Set(weekMenus.map(m => m.menuKey)).size,
          totalGoals: records.filter(r => r.nextGoal).length,
          totalPlays: records.filter(r => r.myPlay).length,
          totalConcerns: records.filter(r => r.concern).length,
          nicesSent: 0,
          totalTeammatePlays: records.filter(r => r.teammatePlay).length,
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

  return (
    <div>
      {/* おためしバナー */}
      {isTrial && (
        <div className="trial-banner">
          <span>📌 おためし中（この端末だけに保存）</span>
          <button className="trial-banner-btn" onClick={() => navigate('/settings')}>
            登録する
          </button>
        </div>
      )}

      {/* 3日目ナッジ */}
      {isTrial && showNudge && (
        <div className="card card-warning" style={{ position: 'relative' }}>
          <button onClick={() => { setShowNudge(false); localStorage.setItem('nudgeDismissed', '1') }}
            style={{
              position: 'absolute', top: 8, right: 12,
              background: 'none', border: 'none', fontSize: '1rem',
              color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit',
            }}>✕</button>
          <p className="font-extrabold" style={{ fontSize: '0.95rem', marginBottom: 6 }}>
            🎉 {streak}日も続けてるね！すごい！
          </p>
          <p className="text-sm text-muted" style={{ lineHeight: 1.6, marginBottom: 10 }}>
            アカウント登録すると、データが安全に保存されて<br />チームのみんなとも繋がれるよ！
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/settings')}>
            🚀 無料で登録する
          </button>
        </div>
      )}

      {/* ===== 記録前レイアウト ===== */}
      {isChild && !todayRecord && (
        <>
          {/* CTA最優先 */}
          <div className="home-cta" style={{ marginBottom: 0 }}>
            <button className="btn btn-success cta-main" onClick={() => navigate('/quick')}>
              ⚡ 30秒きろく（かんたん）
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/record')}>
              📝 くわしく書く
            </button>
          </div>

          {/* チームの活動状況（社会的動機づけ） */}
          {!isTrial && teamTodayCount > 0 && (
            <div className="card card-highlight" style={{ textAlign: 'center', padding: '12px 16px' }}>
              <span className="text-sm font-bold text-primary">
                👥 チームの{teamTodayCount}人が今日きろくしたよ！
              </span>
            </div>
          )}

          {/* あいさつ */}
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            <p className="home-status">今日の記録をつけよう！</p>
          </div>

          {/* 昨日の自分カード */}
          {yesterdayRecord && (
            <div className="card card-success">
              <div className="card-title">📊 きのうの自分</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '2rem' }}>{MOOD_MAP[yesterdayRecord.mood]?.emoji || '😊'}</span>
                <div>
                  <p className="font-bold text-sm">
                    気分：{MOOD_MAP[yesterdayRecord.mood]?.label || '—'}
                  </p>
                  {yesterdayRecord.totalMinutes > 0 && (
                    <p className="text-sm text-success">練習{yesterdayRecord.totalMinutes}分</p>
                  )}
                  {yesterdayRecord.nextGoal && (
                    <p className="text-xs text-muted mt-sm">
                      🎯 {yesterdayRecord.nextGoal.length > 30 ? yesterdayRecord.nextGoal.slice(0, 30) + '…' : yesterdayRecord.nextGoal}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 今週まとめ */}
          <div className="stats-row">
            <div className="stat-card" onClick={() => navigate('/training')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon">⚾</div>
              <div className="stat-value">{weekMinutes}<span className="stat-unit">分</span></div>
              <div className="stat-label">今週の練習</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{streak}<span className="stat-unit">日</span></div>
              <div className="stat-label">連続きろく</div>
            </div>
          </div>

          {/* 日曜日の振り返りリマインダー */}
          {isSunday && weeklyGoalText && (
            <div className="card card-warning" onClick={() => navigate('/goal')} style={{ cursor: 'pointer' }}>
              <div className="card-title">📋 今週のふりかえり</div>
              <p className="text-sm" style={{ lineHeight: 1.6 }}>
                今週のもくひょう「{weeklyGoalText.length > 20 ? weeklyGoalText.slice(0, 20) + '…' : weeklyGoalText}」はどうだった？<br />
                タップしてふりかえりを書こう！
              </p>
            </div>
          )}

          {/* 今週のもくひょう */}
          <div className="card" onClick={() => navigate('/goal')}
            style={{
              cursor: 'pointer',
              borderStyle: weeklyGoalText ? 'solid' : 'dashed',
              borderColor: weeklyGoalText ? 'var(--primary-light)' : 'var(--border)',
            }}>
            <div className="card-title">🎯 今週のもくひょう</div>
            {weeklyGoalText ? (
              <p className="font-bold text-sm">{weeklyGoalText}</p>
            ) : (
              <p className="text-sm text-hint">タップして今週の目標を決めよう！</p>
            )}
          </div>
        </>
      )}

      {/* ===== 記録後レイアウト ===== */}
      {isChild && todayRecord && (
        <>
          {/* あいさつ + 完了バッジ */}
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            <p className="home-status">今日の記録は完了だ！</p>
            <span className="recorded-badge">✅ きろく済み</span>
          </div>

          {/* 修正ボタン */}
          <div className="home-cta">
            <button className="btn btn-outline" onClick={() => navigate('/record')}>
              ✏️ 今日の記録を見る・修正
            </button>
          </div>

          {/* 今日の気分 */}
          {todayRecord.mood && (
            <div className="card text-center">
              <div className="card-title" style={{ justifyContent: 'center' }}>😊 今日の気分</div>
              <div style={{ fontSize: '2.5rem', padding: '4px 0' }}>
                {MOOD_MAP[todayRecord.mood]?.emoji}
              </div>
              <p className="font-bold text-muted">{MOOD_MAP[todayRecord.mood]?.label}</p>
            </div>
          )}

          {/* 今週まとめ */}
          <div className="stats-row">
            <div className="stat-card" onClick={() => navigate('/training')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon">⚾</div>
              <div className="stat-value">{weekMinutes}<span className="stat-unit">分</span></div>
              <div className="stat-label">今週の練習</div>
              {weekMinutes === 0 && (
                <p className="text-xs text-primary mt-sm">練習メニューも記録しよう！</p>
              )}
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{streak}<span className="stat-unit">日</span></div>
              <div className="stat-label">連続きろく</div>
            </div>
          </div>

          {/* ストリーク応援 */}
          {streak >= 3 && (
            <div className="card" style={{
              background: 'linear-gradient(135deg, var(--primary), #6366F1)',
              color: '#fff', textAlign: 'center', border: 'none',
            }}>
              <p style={{ fontSize: '1.3rem', marginBottom: 4 }}>
                {streak >= 30 ? '🏅' : streak >= 14 ? '🥇' : streak >= 7 ? '⭐' : '🔥'}
              </p>
              <p className="font-extrabold" style={{ fontSize: '0.95rem' }}>{streak}日連続きろく中！</p>
              <p className="text-sm" style={{ opacity: 0.85, marginTop: 4 }}>
                {streak >= 30 ? 'すごすぎ！伝説だ！' : streak >= 14 ? 'プロ選手みたいだ！' : streak >= 7 ? '1週間達成！' : 'いい感じ！続けよう！'}
              </p>
            </div>
          )}

          {/* 日曜日の振り返りリマインダー */}
          {isSunday && weeklyGoalText && (
            <div className="card card-warning" onClick={() => navigate('/goal')} style={{ cursor: 'pointer' }}>
              <div className="card-title">📋 今週のふりかえり</div>
              <p className="text-sm" style={{ lineHeight: 1.6 }}>
                今週のもくひょう「{weeklyGoalText.length > 20 ? weeklyGoalText.slice(0, 20) + '…' : weeklyGoalText}」はどうだった？<br />
                タップしてふりかえりを書こう！
              </p>
            </div>
          )}

          {/* 今週のもくひょう */}
          <div className="card" onClick={() => navigate('/goal')}
            style={{
              cursor: 'pointer',
              borderStyle: weeklyGoalText ? 'solid' : 'dashed',
              borderColor: weeklyGoalText ? 'var(--primary-light)' : 'var(--border)',
            }}>
            <div className="card-title">🎯 今週のもくひょう</div>
            {weeklyGoalText ? (
              <p className="font-bold text-sm">{weeklyGoalText}</p>
            ) : (
              <p className="text-sm text-hint">タップして今週の目標を決めよう！</p>
            )}
          </div>

          {/* バッジ */}
          {badgeCount > 0 && (
            <div className="card" onClick={() => navigate('/badges')}
              style={{ cursor: 'pointer' }}>
              <div className="flex-between">
                <div className="card-title" style={{ marginBottom: 0 }}>🏆 バッジ</div>
                <span className="font-extrabold text-accent" style={{ fontSize: '1.1rem' }}>{badgeCount}個</span>
              </div>
              <p className="text-xs text-muted mt-sm">タップしてコレクションを見る →</p>
            </div>
          )}

          {/* ナイス導線 */}
          {!isTrial && teamTodayCount > 0 && (
            <div className="card card-highlight" onClick={() => navigate('/ranking')}
              style={{ cursor: 'pointer', textAlign: 'center' }}>
              <p className="font-bold text-sm text-primary">
                👋 チームの{teamTodayCount}人にナイス！を送ろう →
              </p>
            </div>
          )}
        </>
      )}

      {/* ===== 保護者レイアウト ===== */}
      {!isChild && (
        <div className="home-hero">
          <p className="home-date">{formatDateJP(today)}</p>
          <h2 className="home-greeting">{greetingText()} {name}！</h2>
          <p className="home-status">子どもの様子を確認しよう！</p>
        </div>
      )}

      {/* クイックアクション */}
      <div className="quick-actions">
        {isChild && (
          <>
            <QuickAction icon="📊" label="せいちょう" onClick={() => navigate('/stats')} />
            <QuickAction icon="🏆" label="チーム" onClick={() => navigate('/ranking')} disabled={isTrial} />
            <QuickAction icon="🏅" label="バッジ" onClick={() => navigate('/badges')} />
            <QuickAction icon="⚾" label="練習" onClick={() => navigate('/training')} />
          </>
        )}
        {!isChild && (
          <>
            <QuickAction icon="👀" label="みまもり" onClick={() => navigate('/parent')} />
            <QuickAction icon="⚙️" label="設定" onClick={() => navigate('/settings')} />
          </>
        )}
      </div>

      {isTrial && isChild && (
        <p className="text-xs text-hint text-center">
          ※ チーム機能はアカウント登録後に使えます
        </p>
      )}
    </div>
  )
}

function QuickAction({ icon, label, onClick, disabled }) {
  return (
    <button className="quick-action-btn" onClick={onClick} disabled={disabled}>
      <span className="qa-icon">{icon}</span>
      <span className="qa-label">{label}</span>
    </button>
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
