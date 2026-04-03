import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, weekStartStr, formatDateJP, greetingText, nDaysAgoStr } from '../utils/dateUtils'
import { getAllRecords, getRecordByDate } from '../utils/localStore'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [user, isTrial])

  async function loadData() {
    try {
      if (isTrial) {
        // --- おためし: localStorage ---
        const rec = getRecordByDate(today)
        setTodayRecord(rec)
        const all = getAllRecords()
        const ws = weekStartStr()
        setWeekMinutes(all.filter(r => r.date >= ws && r.date <= today).reduce((s, r) => s + (r.totalMinutes || 0), 0))
        setStreak(calcStreak(all.map(r => r.date)))
      } else if (user) {
        // --- 本登録: Firestore ---
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
        setStreak(calcStreak(recSnap.docs.map(d => d.data().date)))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const name = profile?.nickname || 'せんしゅ'

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>
      <div className="spinner" style={{ margin: '0 auto 12px', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
    </div>
  }

  return (
    <div>
      {/* おためし注意バー */}
      {isTrial && (
        <div style={{
          background: '#fef3c7', borderRadius: 10, padding: '10px 14px',
          marginBottom: 12, fontSize: '0.8rem', color: '#92400e', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>📌 おためし中（この端末だけに保存）</span>
          <button
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => navigate('/settings')}
          >
            登録する
          </button>
        </div>
      )}

      {/* あいさつバナー */}
      <div className="home-greeting">
        <p className="greeting-date">{formatDateJP(today)}</p>
        <h2>{greetingText()} {name}！</h2>
        <p>{todayRecord ? '今日の記録は完了だ！' : isChild ? '今日の記録をつけよう！' : '子どもの様子を確認しよう！'}</p>
        {todayRecord && <span className="recorded-tag">✅ きろく済み</span>}
      </div>

      {/* アクションボタン */}
      {isChild && (
        <>
          {!todayRecord ? (
            <button className="btn btn-success" style={{ marginBottom: 12, fontSize: '1.1rem' }} onClick={() => navigate('/record')}>
              📝 今日のふりかえりを書く
            </button>
          ) : (
            <button className="btn btn-outline" style={{ marginBottom: 12 }} onClick={() => navigate('/record')}>
              ✏️ 今日の記録を見る・修正
            </button>
          )}
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => navigate('/training')}>
            ⚾ 練習メニューを追加する
          </button>
        </>
      )}

      {/* 今週まとめ */}
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-value">{weekMinutes}<span style={{ fontSize: '0.9rem' }}>分</span></div>
          <div className="stat-label">今週の練習時間</div>
        </div>
        <div className="stat-box" style={{ background: '#fef3c7' }}>
          <div className="stat-value" style={{ color: '#d97706' }}>{streak}<span style={{ fontSize: '0.9rem' }}>日</span></div>
          <div className="stat-label">🔥 連続きろく</div>
        </div>
      </div>

      {/* 今日の気分 */}
      {todayRecord?.mood && (
        <div className="card">
          <div className="card-title">😊 今日の気分</div>
          <div style={{ fontSize: '2.5rem', textAlign: 'center', padding: '8px 0' }}>
            {MOOD_MAP[todayRecord.mood]?.emoji}
          </div>
          <p style={{ textAlign: 'center', fontWeight: 700, color: '#374151' }}>
            {MOOD_MAP[todayRecord.mood]?.label}
          </p>
        </div>
      )}

      {/* クイックメニュー */}
      <div className="card">
        <div className="card-title">🔗 クイックメニュー</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {isChild && (
            <>
              <QuickBtn icon="📊" label="せいちょうグラフ" onClick={() => navigate('/stats')} />
              <QuickBtn icon="🏆" label="ランキング" onClick={() => navigate('/ranking')} disabled={isTrial} />
            </>
          )}
          {!isChild && <QuickBtn icon="👀" label="みまもり画面" onClick={() => navigate('/parent')} color="#dcfce7" />}
          <QuickBtn icon="⚙️" label="設定" onClick={() => navigate('/settings')} />
        </div>
        {isTrial && (
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
            ※ ランキングはアカウント登録後に参加できます
          </p>
        )}
      </div>

      {/* ストリーク応援 */}
      {isChild && streak >= 3 && (
        <div style={{
          background: 'linear-gradient(135deg, #1a3a5c, #2563eb)',
          borderRadius: 12, padding: 16, color: '#fff', textAlign: 'center', marginBottom: 12,
        }}>
          <p style={{ fontSize: '1.5rem', marginBottom: 4 }}>
            {streak >= 30 ? '🏅' : streak >= 14 ? '🥇' : streak >= 7 ? '⭐' : '🔥'}
          </p>
          <p style={{ fontWeight: 900, fontSize: '1rem' }}>{streak}日連続きろく中！</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 4 }}>
            {streak >= 30 ? 'すごすぎ！伝説だ！' : streak >= 14 ? 'プロ選手みたいだ！' : streak >= 7 ? '1週間達成！' : 'いい感じ！続けよう！'}
          </p>
        </div>
      )}
    </div>
  )
}

function QuickBtn({ icon, label, onClick, color = '#e0f2fe', disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        background: disabled ? '#f3f4f6' : color,
        border: 'none', borderRadius: 10, padding: '14px 8px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
      }}>
      <span style={{ fontSize: '1.6rem' }}>{icon}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>{label}</span>
    </button>
  )
}

function calcStreak(dates) {
  const sorted = [...new Set(dates)].sort().reverse()
  let s = 0, cur = todayStr()
  for (const d of sorted) {
    if (d === cur) { s++; const p = new Date(cur); p.setDate(p.getDate() - 1); cur = p.toISOString().split('T')[0] }
    else break
  }
  return s
}
