import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, nDaysAgoStr, formatShort, lastNDays, prevDateStr } from '../utils/dateUtils'
import { getParentHints, getBalanceComment } from '../utils/messages'

const MENU_LABELS = {
  swing: '素振り', tee: 'ティー', catch: 'キャッチボール',
  wall: '壁当て', ground: 'ゴロ捕球', fly: 'フライ捕球',
  dash: 'ダッシュ', core: '体幹', stretch: 'ストレッチ', other: 'その他',
}
const MOOD_MAP = {
  best: { emoji: '🤩', label: '最高！' }, good: { emoji: '😊', label: 'まあまあ' },
  frustrate: { emoji: '😤', label: 'くやしい' }, tired: { emoji: '😴', label: 'つかれた' }, moody: { emoji: '😶', label: 'モヤモヤ' },
}

export default function ParentView() {
  const { user, profile, isParent } = useAuth()
  const [childProfile, setChildProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewRange, setViewRange] = useState(7)
  const [noChild, setNoChild] = useState(false)

  useEffect(() => {
    if (!isParent) return
    if (!profile?.childUid) { setNoChild(true); setLoading(false); return }
    loadChild(profile.childUid)
  }, [profile])

  async function loadChild(childUid) {
    try {
      const snap = await getDoc(doc(db, 'users', childUid))
      if (!snap.exists()) { setNoChild(true); setLoading(false); return }
      setChildProfile(snap.data())

      const from = nDaysAgoStr(30)
      const today = todayStr()
      const [rSnap, mSnap] = await Promise.all([
        getDocs(query(collection(db, 'privateRecords'), where('uid', '==', childUid), where('date', '>=', from), where('date', '<=', today), orderBy('date', 'asc'))),
        getDocs(query(collection(db, 'trainingMenus'), where('uid', '==', childUid), where('date', '>=', from), where('date', '<=', today))),
      ])
      setRecords(rSnap.docs.map(d => d.data()))
      setMenus(mSnap.docs.map(d => d.data()))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (!isParent) {
    return <div className="empty-state"><div className="empty-icon">🔒</div><p>保護者専用ページです</p></div>
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  if (noChild) {
    return (
      <div>
        <h2 className="page-title">👀 みまもり画面</h2>
        <div className="card text-center" style={{ padding: 32 }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>👦</p>
          <p className="font-bold mb-sm">子どものIDが未設定です</p>
          <p className="text-sm text-muted">設定画面で子どものユーザーIDを入力してください。</p>
        </div>
      </div>
    )
  }

  const cutoff = nDaysAgoStr(viewRange - 1)
  const today = todayStr()
  const fRec = records.filter(r => r.date >= cutoff)
  const fMenu = menus.filter(m => m.date >= cutoff)
  const totalMin = fRec.reduce((s, r) => s + (r.totalMinutes || 0), 0)

  const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
  let streak = 0, cur = today
  for (const d of allDates) {
    if (d === cur) { streak++; cur = prevDateStr(cur) }
    else break
  }

  const mc = {}
  fMenu.forEach(m => { mc[m.menuKey] = (mc[m.menuKey] || 0) + (m.minutes || 0) })
  const menuRanking = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const last7 = lastNDays(7).map(d => {
    const rec = records.find(r => r.date === d)
    return { date: d, minutes: rec?.totalMinutes || 0, mood: rec?.mood, hasRecord: !!rec }
  })
  const maxMin = Math.max(...last7.map(d => d.minutes), 1)

  const myPlays = fRec.filter(r => r.myPlay).slice(-5).reverse()
  const concerns = fRec.filter(r => r.concern).slice(-3).reverse()
  const goals = fRec.filter(r => r.nextGoal).slice(-3).reverse()

  return (
    <div>
      <h2 className="page-title">👀 みまもり画面</h2>
      <p className="page-subtitle">{childProfile?.nickname}さんの記録</p>

      <div className="segment-control">
        <button className={`segment-btn ${viewRange === 7 ? 'active' : ''}`} onClick={() => setViewRange(7)}>過去7日</button>
        <button className={`segment-btn ${viewRange === 30 ? 'active' : ''}`} onClick={() => setViewRange(30)}>過去30日</button>
      </div>

      <div className="stats-row cols-3">
        <div className="stat-card">
          <div className="stat-icon">⚾</div>
          <div className="stat-value">{totalMin}<span className="stat-unit">分</span></div>
          <div className="stat-label">練習時間</div>
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

      {/* 声かけヒント */}
      {(() => {
        const latestRec = fRec[fRec.length - 1]
        if (!latestRec) return null
        const hints = getParentHints({
          mood: latestRec.mood, myPlay: latestRec.myPlay,
          concern: latestRec.concern, nextGoal: latestRec.nextGoal,
          streak, totalMinutes: totalMin,
        })
        return (
          <div className="card card-warning">
            <div className="card-title">💬 今日の声かけヒント</div>
            <p className="text-xs text-muted mb-md">
              子どもの記録から、おすすめの声かけを提案します
            </p>
            {hints.map((h, i) => (
              <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.1rem' }}>{h.icon}</span>
                <div>
                  <p className="text-sm" style={{ lineHeight: 1.5 }}>{h.hint}</p>
                  {h.avoid && (
                    <p className="text-xs text-danger mt-sm" style={{ lineHeight: 1.4 }}>
                      ⚠️ {h.avoid}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* 練習バランス */}
      {(() => {
        const comment = getBalanceComment(mc)
        if (!comment) return null
        return (
          <div className="card card-success">
            <div className="card-title">⚖️ 練習バランス</div>
            <p className="text-sm" style={{ color: 'var(--success-dark)', lineHeight: 1.5 }}>{comment}</p>
          </div>
        )
      })()}

      {/* 棒グラフ */}
      <div className="card">
        <div className="card-title">📅 直近7日</div>
        <div className="bar-chart" style={{ height: 100 }}>
          {last7.map((d, i) => {
            const h = maxMin > 0 ? Math.max((d.minutes / maxMin) * 90, d.minutes > 0 ? 8 : 0) : 0
            const isToday = d.date === today
            return (
              <div key={i} className="bar-col">
                {d.minutes > 0 && <span className="bar-value" style={{ color: 'var(--success)' }}>{d.minutes}</span>}
                <div className="bar-fill" style={{
                  height: `${h}%`, minHeight: d.minutes > 0 ? 6 : 2,
                  background: isToday ? 'var(--success)' : d.minutes > 0 ? 'var(--success-light)' : 'var(--border)',
                }} />
                <span className={`bar-label ${isToday ? 'today' : ''}`} style={isToday ? { color: 'var(--success)' } : {}}>
                  {formatShort(d.date)}
                </span>
                {d.mood && <span style={{ fontSize: '0.6rem' }}>{MOOD_MAP[d.mood]?.emoji}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* よくやっている練習 */}
      {menuRanking.length > 0 && (
        <div className="card">
          <div className="card-title">⚾ よくやっている練習</div>
          {menuRanking.map(([key, min], i) => (
            <div key={key} className="flex-between" style={{
              padding: '8px 0',
              borderBottom: i < menuRanking.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <span className="font-bold text-sm">{['🥇', '🥈', '🥉'][i]} {MENU_LABELS[key] || key}</span>
              <span className="text-sm font-bold text-success">{min}分</span>
            </div>
          ))}
        </div>
      )}

      {/* 100点プレー */}
      {myPlays.length > 0 && (
        <div className="card">
          <div className="card-title">⭐ 最近の100点プレー</div>
          {myPlays.map((r, i) => (
            <div key={i} className="list-item" style={{ background: 'var(--warning-bg)' }}>
              <p className="font-bold text-sm">{r.myPlay}</p>
              <p className="text-xs text-hint mt-sm">{formatShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {/* モヤっと */}
      {concerns.length > 0 && (
        <div className="card">
          <div className="card-title">💭 最近のモヤっと</div>
          <p className="text-xs text-muted mb-sm">※ 温かく見守ってあげてください</p>
          {concerns.map((r, i) => (
            <div key={i} className="list-item" style={{ borderLeft: '3px solid var(--border)' }}>
              <p className="text-sm">{r.concern}</p>
              <p className="text-xs text-hint mt-sm">{formatShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 目標 */}
      {goals.length > 0 && (
        <div className="card">
          <div className="card-title">🎯 子どもが立てた目標</div>
          {goals.map((r, i) => (
            <div key={i} className="list-item list-item-accent">
              <p className="font-bold text-sm">{r.nextGoal}</p>
              <p className="text-xs text-hint mt-sm">{formatShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
