import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function nDaysAgoStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
function todayStr() { return new Date().toISOString().split('T')[0] }
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
  best:      { emoji: '🤩', label: '最高！', bg: '#dcfce7' },
  good:      { emoji: '😊', label: 'まあまあ', bg: '#e0f2fe' },
  frustrate: { emoji: '😤', label: 'くやしい', bg: '#fee2e2' },
  tired:     { emoji: '😴', label: 'つかれた', bg: '#f3f4f6' },
  moody:     { emoji: '😶', label: 'モヤモヤ', bg: '#fef3c7' },
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
    if (!user) return
    if (!isParent) return
    if (!profile?.childUid) {
      setNoChild(true)
      setLoading(false)
      return
    }
    loadChildData(profile.childUid)
  }, [user, profile])

  async function loadChildData(childUid) {
    try {
      // 子どもプロフィール取得
      const childSnap = await getDoc(doc(db, 'users', childUid))
      if (!childSnap.exists()) {
        setNoChild(true)
        setLoading(false)
        return
      }
      setChildProfile(childSnap.data())

      const from = nDaysAgoStr(30)
      const today = todayStr()

      const [rSnap, mSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'dailyRecords'),
          where('uid', '==', childUid),
          where('date', '>=', from),
          where('date', '<=', today),
          orderBy('date', 'asc')
        )),
        getDocs(query(
          collection(db, 'trainingMenus'),
          where('uid', '==', childUid),
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

  // 権限チェック：子どもでも見えるが、parent のみここに入る
  if (!isParent) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <p>保護者専用ページです</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#16a34a' }} />
      </div>
    )
  }

  if (noChild) {
    return (
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
          👀 みまもり画面
        </h2>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>👦</p>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>子どものIDが設定されていません</p>
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            設定画面で子どものユーザーIDを入力してください。<br />
            子どものユーザーIDは、子どもの設定画面で確認できます。
          </p>
        </div>
      </div>
    )
  }

  // 期間フィルタ
  const cutoff = nDaysAgoStr(viewRange - 1)
  const filteredRecords = records.filter(r => r.date >= cutoff)
  const filteredMenus = menus.filter(m => m.date >= cutoff)

  // サマリー
  const totalMin = filteredRecords.reduce((s, r) => s + (r.totalMinutes || 0), 0)
  const today = todayStr()
  const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
  let streak = 0; let cur = today
  for (const d of allDates) {
    if (d === cur) { streak++; const p = new Date(cur); p.setDate(p.getDate() - 1); cur = p.toISOString().split('T')[0] }
    else break
  }

  // 練習ランキング
  const menuCount = {}
  filteredMenus.forEach(m => {
    menuCount[m.menuKey] = (menuCount[m.menuKey] || 0) + (m.minutes || 0)
  })
  const menuRanking = Object.entries(menuCount).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // 直近7日のバーチャート
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const rec = records.find(r => r.date === dateStr)
    return { date: dateStr, minutes: rec?.totalMinutes || 0, mood: rec?.mood, hasRecord: !!rec }
  })
  const maxMin = Math.max(...last7.map(d => d.minutes), 1)

  // 最近の100点プレー（見守り観点）
  const myPlays = filteredRecords.filter(r => r.myPlay).slice(-5).reverse()
  // 最近のモヤっと
  const concerns = filteredRecords.filter(r => r.concern).slice(-3).reverse()
  // 次の目標
  const nextGoals = filteredRecords.filter(r => r.nextGoal).slice(-3).reverse()

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 4 }}>
        👀 みまもり画面
      </h2>
      <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 16, fontWeight: 700 }}>
        {childProfile?.nickname || ''}さんの記録
      </p>

      {/* 期間切り替え */}
      <div className="toggle-tabs" style={{ marginBottom: 16 }}>
        <button className={`toggle-tab ${viewRange === 7 ? 'active' : ''}`} onClick={() => setViewRange(7)}>過去7日</button>
        <button className={`toggle-tab ${viewRange === 30 ? 'active' : ''}`} onClick={() => setViewRange(30)}>過去30日</button>
      </div>

      {/* サマリー */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-box">
          <div className="stat-value">{totalMin}<span style={{ fontSize: '0.7rem' }}>分</span></div>
          <div className="stat-label">練習時間</div>
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

      {/* 直近7日バー */}
      <div className="card">
        <div className="card-title">📅 直近7日の練習</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
          {last7.map((d, i) => {
            const h = maxMin > 0 ? Math.max((d.minutes / maxMin) * 90, d.minutes > 0 ? 8 : 0) : 0
            const isToday = d.date === today
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {d.minutes > 0 && <span style={{ fontSize: '0.55rem', color: '#16a34a', fontWeight: 700 }}>{d.minutes}</span>}
                <div style={{
                  width: '100%', height: `${h}%`, minHeight: d.minutes > 0 ? 6 : 2,
                  background: isToday ? '#16a34a' : d.minutes > 0 ? '#86efac' : '#e5e7eb',
                  borderRadius: '4px 4px 0 0',
                }} />
                <span style={{ fontSize: '0.55rem', color: isToday ? '#16a34a' : '#9ca3af' }}>
                  {formatDateShort(d.date)}
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
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: i < menuRanking.length - 1 ? '1px solid #e5e7eb' : 'none',
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {['🥇', '🥈', '🥉'][i]} {MENU_LABELS[key] || key}
              </span>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>{min}分</span>
            </div>
          ))}
        </div>
      )}

      {/* 最近の100点プレー */}
      {myPlays.length > 0 && (
        <div className="card">
          <div className="card-title">⭐ 最近の100点プレー</div>
          {myPlays.map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: '#fef3c7', borderRadius: 8, marginBottom: 8,
            }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.myPlay}</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{formatDateShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {/* モヤっと */}
      {concerns.length > 0 && (
        <div className="card">
          <div className="card-title">💭 最近のモヤっと</div>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 8 }}>
            ※ 子どもが書いたことです。温かく見守ってあげてください。
          </p>
          {concerns.map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: '#f3f4f6', borderRadius: 8, marginBottom: 8,
              borderLeft: '3px solid #d1d5db',
            }}>
              <p style={{ fontSize: '0.9rem' }}>{r.concern}</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{formatDateShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 次の目標 */}
      {nextGoals.length > 0 && (
        <div className="card">
          <div className="card-title">🎯 子どもが立てた目標</div>
          {nextGoals.map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: '#e0f2fe', borderRadius: 8, marginBottom: 8,
              borderLeft: '3px solid #2563eb',
            }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.nextGoal}</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{formatDateShort(r.date)}</p>
            </div>
          ))}
        </div>
      )}

      {filteredRecords.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>この期間の記録はまだないよ</p>
        </div>
      )}
    </div>
  )
}
