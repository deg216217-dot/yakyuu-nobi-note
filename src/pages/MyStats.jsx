import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function todayStr() { return new Date().toISOString().split('T')[0] }

function nDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function formatDateShort(str) {
  const [, m, d] = str.split('-')
  return `${+m}/${+d}`
}

const MENU_LABELS = {
  swing: '素振り', tee: 'ティー', catch: 'キャッチボール',
  wall: '壁当て', ground: 'ゴロ捕球', fly: 'フライ捕球',
  dash: 'ダッシュ', core: '体幹', stretch: 'ストレッチ', other: 'その他',
}

const MOOD_MAP = {
  best:      { emoji: '🤩', label: '最高！' },
  good:      { emoji: '😊', label: 'まあまあ' },
  frustrate: { emoji: '😤', label: 'くやしい' },
  tired:     { emoji: '😴', label: 'つかれた' },
  moody:     { emoji: '😶', label: 'モヤモヤ' },
}

export default function MyStats() {
  const { user, isChild, profile } = useAuth()
  const [records, setRecords] = useState([])
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewRange, setViewRange] = useState(7) // 7 or 30

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    try {
      const from = nDaysAgo(30)
      const today = todayStr()

      const [rSnap, mSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'dailyRecords'),
          where('uid', '==', user.uid),
          where('date', '>=', from),
          where('date', '<=', today),
          orderBy('date', 'asc')
        )),
        getDocs(query(
          collection(db, 'trainingMenus'),
          where('uid', '==', user.uid),
          where('date', '>=', from),
          where('date', '<=', today)
        ))
      ])
      setRecords(rSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setMenus(mSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 表示期間で絞り込み
  const cutoff = nDaysAgo(viewRange - 1)
  const filteredRecords = records.filter(r => r.date >= cutoff)
  const filteredMenus = menus.filter(m => m.date >= cutoff)

  // 合計練習時間
  const totalMin = filteredRecords.reduce((s, r) => s + (r.totalMinutes || 0), 0)

  // 連続記録日数
  const today = todayStr()
  const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
  let streak = 0
  let cur = today
  for (const d of allDates) {
    if (d === cur) {
      streak++
      const prev = new Date(cur)
      prev.setDate(prev.getDate() - 1)
      cur = prev.toISOString().split('T')[0]
    } else break
  }

  // 練習ランキング（多い順）
  const menuCount = {}
  filteredMenus.forEach(m => {
    menuCount[m.menuKey] = (menuCount[m.menuKey] || 0) + (m.minutes || 0)
  })
  const menuRanking = Object.entries(menuCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // 直近7日の日別データ（棒グラフ用）
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const rec = records.find(r => r.date === dateStr)
    return { date: dateStr, minutes: rec?.totalMinutes || 0, mood: rec?.mood }
  })
  const maxMin = Math.max(...last7.map(d => d.minutes), 1)

  // 最近の目標一覧
  const recentGoals = filteredRecords
    .filter(r => r.nextGoal)
    .slice(-5)
    .reverse()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
        📊 {isChild ? 'じぶんの成長グラフ' : `${profile?.nickname || ''}さんの記録`}
      </h2>

      {/* 期間切り替え */}
      <div className="toggle-tabs" style={{ marginBottom: 16 }}>
        <button className={`toggle-tab ${viewRange === 7 ? 'active' : ''}`} onClick={() => setViewRange(7)}>
          過去7日
        </button>
        <button className={`toggle-tab ${viewRange === 30 ? 'active' : ''}`} onClick={() => setViewRange(30)}>
          過去30日
        </button>
      </div>

      {/* サマリー */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-box">
          <div className="stat-value">{totalMin}<span style={{ fontSize: '0.7rem' }}>分</span></div>
          <div className="stat-label">合計練習</div>
        </div>
        <div className="stat-box" style={{ background: '#fef3c7' }}>
          <div className="stat-value" style={{ color: '#d97706' }}>{streak}<span style={{ fontSize: '0.7rem' }}>日</span></div>
          <div className="stat-label">🔥 連続</div>
        </div>
        <div className="stat-box" style={{ background: '#dcfce7' }}>
          <div className="stat-value" style={{ color: '#16a34a', fontSize: '1.4rem' }}>{filteredRecords.length}</div>
          <div className="stat-label">記録日数</div>
        </div>
      </div>

      {/* 練習時間グラフ（直近7日） */}
      <div className="card">
        <div className="card-title">📅 直近7日の練習時間</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
          {last7.map((d, i) => {
            const height = maxMin > 0 ? Math.max((d.minutes / maxMin) * 100, d.minutes > 0 ? 8 : 0) : 0
            const isToday = d.date === today
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {d.minutes > 0 && (
                  <span style={{ fontSize: '0.6rem', color: '#2563eb', fontWeight: 700 }}>{d.minutes}</span>
                )}
                <div
                  style={{
                    width: '100%',
                    height: `${height}%`,
                    minHeight: d.minutes > 0 ? 8 : 2,
                    background: isToday ? '#2563eb' : d.minutes > 0 ? '#93c5fd' : '#e5e7eb',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s',
                  }}
                />
                <span style={{ fontSize: '0.6rem', color: isToday ? '#2563eb' : '#9ca3af', fontWeight: isToday ? 700 : 400 }}>
                  {formatDateShort(d.date)}
                </span>
                {d.mood && <span style={{ fontSize: '0.65rem' }}>{MOOD_MAP[d.mood]?.emoji}</span>}
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
          ※ 棒の上の数字は分数。今日は青色
        </p>
      </div>

      {/* 練習ランキング */}
      <div className="card">
        <div className="card-title">🏆 よくやっている練習TOP5</div>
        {menuRanking.length === 0 ? (
          <div className="empty-state">
            <p>まだ記録がないよ</p>
          </div>
        ) : (
          menuRanking.map(([key, min], i) => {
            const pct = Math.round((min / menuRanking[0][1]) * 100)
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {i + 1}. {MENU_LABELS[key] || key}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 700 }}>{min}分</span>
                </div>
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: i === 0 ? '#f59e0b' : '#93c5fd',
                    borderRadius: 4,
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 最近の目標 */}
      {recentGoals.length > 0 && (
        <div className="card">
          <div className="card-title">🎯 最近の目標</div>
          {recentGoals.map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px',
              background: '#f9fafb',
              borderRadius: 8,
              marginBottom: 8,
              borderLeft: '3px solid #2563eb',
            }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.nextGoal}</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{formatDateShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 最近の100点プレー */}
      {filteredRecords.filter(r => r.myPlay).length > 0 && (
        <div className="card">
          <div className="card-title">⭐ 最近の100点プレー</div>
          {filteredRecords.filter(r => r.myPlay).slice(-3).reverse().map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px',
              background: '#fef3c7',
              borderRadius: 8,
              marginBottom: 8,
            }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.myPlay}</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{formatDateShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
