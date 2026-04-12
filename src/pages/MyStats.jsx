import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, nDaysAgoStr, formatShort, lastNDays, prevDateStr } from '../utils/dateUtils'
import { getAllRecords } from '../utils/localStore'

const MOOD_MAP = {
  best: { emoji: '🤩' }, good: { emoji: '😊' },
  frustrate: { emoji: '😤' }, tired: { emoji: '😴' }, moody: { emoji: '😶' },
}

export default function MyStats() {
  const { user, profile, isTrial, isChild } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewRange, setViewRange] = useState(7)

  useEffect(() => { loadAll() }, [user, isTrial])

  async function loadAll() {
    try {
      const from = nDaysAgoStr(30)
      const today = todayStr()
      if (isTrial) {
        setRecords(getAllRecords().filter(r => r.date >= from && r.date <= today))
      } else if (user) {
        const rSnap = await getDocs(query(
          collection(db, 'dailyRecords'),
          where('uid', '==', user.uid),
          where('date', '>=', from),
          where('date', '<=', today),
          orderBy('date', 'asc'),
        ))
        setRecords(rSnap.docs.map(d => d.data()))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const cutoff = nDaysAgoStr(viewRange - 1)
  const today = todayStr()
  const fRec = records.filter(r => r.date >= cutoff)

  // 連続記録
  const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
  let streak = 0, cur = today
  for (const d of allDates) {
    if (d === cur) { streak++; cur = prevDateStr(cur) }
    else break
  }

  // 7日の記録状況
  const last7 = lastNDays(7).map(d => {
    const rec = records.find(r => r.date === d)
    return { date: d, mood: rec?.mood, hasRecord: !!rec }
  })

  const recentGoals = fRec.filter(r => r.nextGoal).slice(-5).reverse()
  const recentPlays = fRec.filter(r => r.myPlay).slice(-3).reverse()
  const recentConcerns = fRec.filter(r => r.concern).slice(-3).reverse()

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div>
      <h2 className="page-title">{isChild ? 'じぶんのせいちょう' : `${profile?.nickname}の記録`}</h2>

      <div className="segment-control">
        <button className={`segment-btn ${viewRange === 7 ? 'active' : ''}`} onClick={() => setViewRange(7)}>過去7日</button>
        <button className={`segment-btn ${viewRange === 30 ? 'active' : ''}`} onClick={() => setViewRange(30)}>過去30日</button>
      </div>

      <div className="stats-row cols-3">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--success)' }}>●</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{fRec.length}</div>
          <div className="stat-label">記録日数</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--primary)' }}>●</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{streak}<span className="stat-unit">日</span></div>
          <div className="stat-label">連続</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--accent)' }}>●</div>
          <div className="stat-value">{fRec.filter(r => r.nextGoal).length}</div>
          <div className="stat-label">目標設定</div>
        </div>
      </div>

      {/* 直近7日 */}
      <div className="card">
        <div className="card-title">直近7日</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {last7.map((d, i) => {
            const isToday = d.date === today
            return (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '8px 4px',
                background: d.hasRecord ? 'var(--primary-bg)' : 'var(--border-light)',
                borderRadius: 'var(--r-sm)',
              }}>
                <span style={{ fontSize: '0.72rem', color: isToday ? 'var(--primary)' : 'var(--text-3)', fontWeight: isToday ? 700 : 400 }}>
                  {formatShort(d.date)}
                </span>
                <div style={{ fontSize: '1.2rem', marginTop: 2 }}>
                  {d.mood ? MOOD_MAP[d.mood]?.emoji : d.hasRecord ? '●' : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 最近の目標 */}
      {recentGoals.length > 0 && (
        <div className="card">
          <div className="card-title">最近の目標</div>
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
          <div className="card-title">最近の100点プレー</div>
          {recentPlays.map((r, i) => (
            <div key={i} className="list-item" style={{ background: 'var(--accent-bg)' }}>
              <p className="font-bold text-sm">{r.myPlay}</p>
              <p className="text-xs text-hint mt-sm">{formatShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {/* モヤっと */}
      {recentConcerns.length > 0 && (
        <div className="card">
          <div className="card-title">最近のモヤっと</div>
          {recentConcerns.map((r, i) => (
            <div key={i} className="list-item">
              <p className="text-sm">{r.concern}</p>
              <p className="text-xs text-hint mt-sm">{formatShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
