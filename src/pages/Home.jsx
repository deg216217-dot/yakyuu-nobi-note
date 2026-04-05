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
  const [totalRecordDays, setTotalRecordDays] = useState(0)

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
        setTotalRecordDays(records.length)
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
        setTotalRecordDays(new Set(records.map(r => r.date)).size)

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

  // 統計を表示するか（3日以上記録してから）
  const showStats = totalRecordDays >= 3

  return (
    <div>
      {/* ===== 記録前レイアウト ===== */}
      {isChild && !todayRecord && (
        <>
          {/* あいさつ */}
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            {isTrial && (
              <span className="text-xs" style={{
                display: 'inline-block', marginTop: 4,
                background: 'var(--warning-bg)', color: 'var(--accent-dark)',
                padding: '2px 10px', borderRadius: 'var(--r-full)', fontWeight: 700,
              }}>おためし中</span>
            )}
          </div>

          {/* チームの活動状況（社会的動機づけ） */}
          {!isTrial && teamTodayCount > 0 && (
            <p className="text-sm text-primary font-bold text-center" style={{ margin: '-4px 0 12px' }}>
              👥 チームの{teamTodayCount}人が今日きろくしたよ！
            </p>
          )}

          {/* === 主CTA（1つだけ） === */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <button className="btn btn-success cta-main" onClick={() => navigate('/quick')}
              style={{ fontSize: '1.1rem', padding: '18px 24px' }}>
              ⚡ 今日の気分をきろく！
            </button>
            <p className="text-xs text-hint" style={{ marginTop: 8 }}>
              たった30秒で終わるよ！
            </p>
          </div>

          {/* テキストリンク（ボタンではない） */}
          <p className="text-center" style={{ marginBottom: 20 }}>
            <span className="text-sm text-primary" style={{ cursor: 'pointer' }}
              onClick={() => navigate('/record')}>
              📝 ふりかえり日記を書きたい人はこちら →
            </span>
          </p>

          {/* ─── ファーストビューここまで ─── */}

          {/* 昨日の自分カード */}
          {yesterdayRecord && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: 'var(--success-bg)',
              borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-md)',
            }}>
              <span style={{ fontSize: '2rem' }}>{MOOD_MAP[yesterdayRecord.mood]?.emoji || '😊'}</span>
              <div>
                <p className="text-xs text-muted" style={{ marginBottom: 2 }}>きのうの自分</p>
                <p className="font-bold text-sm">
                  {MOOD_MAP[yesterdayRecord.mood]?.label || '—'}
                  {yesterdayRecord.totalMinutes > 0 && (
                    <span className="text-success"> ／ {yesterdayRecord.totalMinutes}分</span>
                  )}
                </p>
                {yesterdayRecord.nextGoal && (
                  <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                    🎯 {yesterdayRecord.nextGoal.length > 25 ? yesterdayRecord.nextGoal.slice(0, 25) + '…' : yesterdayRecord.nextGoal}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 統計（3日以上記録してから表示） */}
          {showStats && (
            <div style={{
              display: 'flex', gap: 12, marginBottom: 'var(--sp-md)',
            }}>
              <div style={{
                flex: 1, textAlign: 'center', padding: '12px 8px',
                background: 'var(--bg)', borderRadius: 'var(--r-md)',
              }}>
                <p className="font-extrabold" style={{ fontSize: '1.2rem' }}>
                  {weekMinutes}<span className="text-xs text-muted"> 分</span>
                </p>
                <p className="text-xs text-muted">今週の練習</p>
              </div>
              <div style={{
                flex: 1, textAlign: 'center', padding: '12px 8px',
                background: 'var(--bg)', borderRadius: 'var(--r-md)',
              }}>
                <p className="font-extrabold" style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>
                  {streak}<span className="text-xs text-muted"> 日</span>
                </p>
                <p className="text-xs text-muted">連続きろく</p>
              </div>
            </div>
          )}

          {/* 日曜日の振り返りリマインダー */}
          {isSunday && weeklyGoalText && (
            <div className="card card-warning" onClick={() => navigate('/goal')} style={{ cursor: 'pointer' }}>
              <div className="card-title">📋 今週のふりかえり</div>
              <p className="text-sm" style={{ lineHeight: 1.6 }}>
                「{weeklyGoalText.length > 20 ? weeklyGoalText.slice(0, 20) + '…' : weeklyGoalText}」はどうだった？
              </p>
            </div>
          )}

          {/* 週間もくひょう（設定済みのときだけ） */}
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

          {/* 3日目ナッジ */}
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
                登録するとデータが安全に保存されて、チームとも繋がれるよ
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/settings')}>
                無料で登録する →
              </button>
            </div>
          )}
        </>
      )}

      {/* ===== 記録後レイアウト ===== */}
      {isChild && todayRecord && (
        <>
          {/* あいさつ + 完了 */}
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            <span className="recorded-badge">✅ きろく済み</span>
            {isTrial && (
              <span className="text-xs" style={{
                display: 'inline-block', marginTop: 4, marginLeft: 8,
                background: 'var(--warning-bg)', color: 'var(--accent-dark)',
                padding: '2px 10px', borderRadius: 'var(--r-full)', fontWeight: 700,
              }}>おためし中</span>
            )}
          </div>

          {/* 今日の気分サマリー */}
          {todayRecord.mood && (
            <div style={{
              textAlign: 'center', padding: '16px',
              marginBottom: 'var(--sp-md)',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 4 }}>
                {MOOD_MAP[todayRecord.mood]?.emoji}
              </div>
              <p className="font-bold text-muted">{MOOD_MAP[todayRecord.mood]?.label}</p>
            </div>
          )}

          {/* 統計（記録後のご褒美） */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 'var(--sp-md)',
          }}>
            <div onClick={() => navigate('/training')} style={{
              flex: 1, textAlign: 'center', padding: '12px 8px', cursor: 'pointer',
              background: 'var(--bg)', borderRadius: 'var(--r-md)',
            }}>
              <p className="font-extrabold" style={{ fontSize: '1.2rem' }}>
                {weekMinutes}<span className="text-xs text-muted"> 分</span>
              </p>
              <p className="text-xs text-muted">今週の練習</p>
              {weekMinutes === 0 && (
                <p className="text-xs text-primary" style={{ marginTop: 4 }}>練習メニューも記録しよう！</p>
              )}
            </div>
            <div style={{
              flex: 1, textAlign: 'center', padding: '12px 8px',
              background: 'var(--bg)', borderRadius: 'var(--r-md)',
            }}>
              <p className="font-extrabold" style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>
                {streak}<span className="text-xs text-muted"> 日</span>
              </p>
              <p className="text-xs text-muted">連続きろく</p>
            </div>
          </div>

          {/* ストリーク応援 */}
          {streak >= 3 && (
            <div style={{
              background: 'linear-gradient(135deg, var(--primary), #6366F1)',
              color: '#fff', textAlign: 'center', borderRadius: 'var(--r-md)',
              padding: '16px', marginBottom: 'var(--sp-md)',
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
                「{weeklyGoalText.length > 20 ? weeklyGoalText.slice(0, 20) + '…' : weeklyGoalText}」はどうだった？
              </p>
            </div>
          )}

          {/* 週間もくひょう（設定済みのときだけ） */}
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

          {/* バッジ（あるときだけ） */}
          {badgeCount > 0 && (
            <div onClick={() => navigate('/badges')}
              style={{
                cursor: 'pointer', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--bg)', borderRadius: 'var(--r-md)',
                marginBottom: 'var(--sp-md)',
              }}>
              <span className="text-sm font-bold">🏆 バッジ {badgeCount}個</span>
              <span className="text-xs text-primary">コレクションを見る →</span>
            </div>
          )}

          {/* ナイス導線 */}
          {!isTrial && teamTodayCount > 0 && (
            <p className="text-sm text-primary font-bold text-center" style={{
              cursor: 'pointer', marginBottom: 'var(--sp-md)',
            }} onClick={() => navigate('/ranking')}>
              👋 チームの{teamTodayCount}人にナイス！を送ろう →
            </p>
          )}

          {/* 修正リンク（テキストリンク） */}
          <p className="text-center" style={{ marginBottom: 8 }}>
            <span className="text-sm text-muted" style={{ cursor: 'pointer' }}
              onClick={() => navigate('/record')}>
              ✏️ 記録を見る・修正する →
            </span>
          </p>
        </>
      )}

      {/* ===== 保護者レイアウト ===== */}
      {!isChild && (
        <>
          <div className="home-hero">
            <p className="home-date">{formatDateJP(today)}</p>
            <h2 className="home-greeting">{greetingText()} {name}！</h2>
            <p className="home-status">子どもの様子を確認しよう！</p>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate('/parent')}>
              👀 みまもり画面を開く
            </button>
          </div>
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
