import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, nDaysAgoStr, formatShort, lastNDays, prevDateStr } from '../utils/dateUtils'
import { getAllRecords, getAllMenus } from '../utils/localStore'

const MENU_LABELS = {
  swing: '素振り', tee: 'ティー', catch: 'キャッチボール',
  wall: '壁当て', ground: 'ゴロ捕球', fly: 'フライ捕球',
  dash: 'ダッシュ', core: '体幹', stretch: 'ストレッチ', other: 'その他',
}
const MOOD_MAP = {
  best: { emoji: '🤩' }, good: { emoji: '😊' },
  frustrate: { emoji: '😤' }, tired: { emoji: '😴' }, moody: { emoji: '😶' },
}

export default function MyStats() {
  const { user, profile, isTrial, isChild } = useAuth()
  const [records, setRecords] = useState([])
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewRange, setViewRange] = useState(7)

  useEffect(() => { loadAll() }, [user, isTrial])

  async function loadAll() {
    try {
      const from = nDaysAgoStr(30)
      const today = todayStr()
      if (isTrial) {
        setRecords(getAllRecords().filter(r => r.date >= from && r.date <= today))
        setMenus(getAllMenus().filter(m => m.date >= from && m.date <= today))
      } else if (user) {
        const [rSnap, mSnap] = await Promise.all([
          getDocs(query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '>=', from), where('date', '<=', today), orderBy('date', 'asc'))),
          getDocs(query(collection(db, 'trainingMenus'), where('uid', '==', user.uid), where('date', '>=', from), where('date', '<=', today))),
        ])
        setRecords(rSnap.docs.map(d => d.data()))
        setMenus(mSnap.docs.map(d => d.data()))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const cutoff = nDaysAgoStr(viewRange - 1)
  const today = todayStr()
  const fRec = records.filter(r => r.date >= cutoff)
  const fMenu = menus.filter(m => m.date >= cutoff)

  const totalMin = fRec.reduce((s, r) => s + (r.totalMinutes || 0), 0)

  // 連続記録
  const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
  let streak = 0, cur = today
  for (const d of allDates) {
    if (d === cur) { streak++; cur = prevDateStr(cur) }
    else break
  }

  // 練習ランキング
  const mc = {}
  fMenu.forEach(m => { mc[m.menuKey] = (mc[m.menuKey] || 0) + (m.minutes || 0) })
  const menuRanking = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // 7日棒グラフ
  const last7 = lastNDays(7).map(d => {
    const rec = records.find(r => r.date === d)
    return { date: d, minutes: rec?.totalMinutes || 0, mood: rec?.mood }
  })
  const maxMin = Math.max(...last7.map(d => d.minutes), 1)

  const recentGoals = fRec.filter(r => r.nextGoal).slice(-5).reverse()
  const recentPlays = fRec.filter(r => r.myPlay).slice(-3).reverse()

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div>
      <h2 className="page-title">📊 {isChild ? 'じぶんの成長' : `${profile?.nickname}の記録`}</h2>

      <div className="segment-control">
        <button className={`segment-btn ${viewRange === 7 ? 'active' : ''}`} onClick={() => setViewRange(7)}>過去7日</button>
        <button className={`segment-btn ${viewRange === 30 ? 'active' : ''}`} onClick={() => setViewRange(30)}>過去30日</button>
      </div>

      <div className="stats-row cols-3">
        <div className="stat-card">
          <div className="stat-icon">⚾</div>
          <div className="stat-value">{totalMin}<span className="stat-unit">分</span></div>
          <div className="stat-label">合計練習</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{streak}<span className="stat-unit">日</span></div>
          <div className="stat-label">連続</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{fRec.length}</div>
          <div className="stat-label">記録日数</div>
        </div>
      </div>

      {/* 棒グラフ */}
      <div className="card">
        <div className="card-title">📅 直近7日の練習時間</div>
        <div className="bar-chart">
          {last7.map((d, i) => {
            const h = maxMin > 0 ? Math.max((d.minutes / maxMin) * 100, d.minutes > 0 ? 8 : 0) : 0
            const isToday = d.date === today
            return (
              <div key={i} className="bar-col">
                {d.minutes > 0 && <span className="bar-value">{d.minutes}</span>}
                <div className="bar-fill" style={{
                  height: `${h}%`, minHeight: d.minutes > 0 ? 8 : 2,
                  background: isToday ? 'var(--primary)' : d.minutes > 0 ? 'var(--primary-light)' : 'var(--border)',
                }} />
                <span className={`bar-label ${isToday ? 'today' : ''}`}>
                  {formatShort(d.date)}
                </span>
                {d.mood && <span style={{ fontSize: '0.65rem' }}>{MOOD_MAP[d.mood]?.emoji}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* 練習ランキング */}
      <div className="card">
        <div className="card-title">🏆 よくやっている練習TOP5</div>
        {menuRanking.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}><p>まだ記録がないよ</p></div>
        ) : menuRanking.map(([key, min], i) => {
          const pct = Math.round((min / menuRanking[0][1]) * 100)
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <div className="flex-between mb-sm">
                <span className="font-bold text-sm">{i + 1}. {MENU_LABELS[key] || key}</span>
                <span className="text-sm font-bold text-primary">{min}分</span>
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill" style={{
                  width: `${pct}%`,
                  background: i === 0 ? 'var(--accent)' : 'var(--primary-light)',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* 最近の目標 */}
      {recentGoals.length > 0 && (
        <div className="card">
          <div className="card-title">🎯 最近の目標</div>
          {recentGoals.map((r, i) => (
            <div key={i} className="list-item list-item-accent">
              <p className="font-bold text-sm">{r.nextGoal}</p>
              <p className="text-xs text-hint mt-sm">{formatShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 100点プレー */}
      {recentPlays.length > 0 && (
        <div className="card">
          <div className="card-title">⭐ 最近の100点プレー</div>
          {recentPlays.map((r, i) => (
            <div key={i} className="list-item" style={{ background: 'var(--warning-bg)' }}>
              <p className="font-bold text-sm">{r.myPlay}</p>
              <p className="text-xs text-hint mt-sm">{formatShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
