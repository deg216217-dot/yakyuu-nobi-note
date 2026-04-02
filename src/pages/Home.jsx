import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

// 今日の日付文字列 YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// 今週の月曜〜今日
function getThisWeekRange() {
  const now = new Date()
  const day = now.getDay() // 0=日
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday
}

// 日付を日本語表示
function formatDateJP(str) {
  const [y, m, d] = str.split('-')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const dt = new Date(+y, +m - 1, +d)
  return `${+m}月${+d}日（${days[dt.getDay()]}）`
}

export default function Home() {
  const { user, profile, isChild } = useAuth()
  const navigate = useNavigate()
  const [todayRecord, setTodayRecord] = useState(null)
  const [weekMinutes, setWeekMinutes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    try {
      const today = todayStr()

      // 今日の記録があるか確認
      const todayQ = query(
        collection(db, 'dailyRecords'),
        where('uid', '==', user.uid),
        where('date', '==', today)
      )
      const todaySnap = await getDocs(todayQ)
      if (!todaySnap.empty) {
        setTodayRecord(todaySnap.docs[0].data())
      }

      // 今週の練習時間合計
      const weekStart = getThisWeekRange()
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekQ = query(
        collection(db, 'dailyRecords'),
        where('uid', '==', user.uid),
        where('date', '>=', weekStartStr),
        where('date', '<=', today)
      )
      const weekSnap = await getDocs(weekQ)
      let total = 0
      weekSnap.forEach(d => {
        total += d.data().totalMinutes || 0
      })
      setWeekMinutes(total)

      // 連続記録日数（直近30日分取得して計算）
      const thirtyAgo = new Date()
      thirtyAgo.setDate(thirtyAgo.getDate() - 30)
      const thirtyStr = thirtyAgo.toISOString().split('T')[0]
      const recentQ = query(
        collection(db, 'dailyRecords'),
        where('uid', '==', user.uid),
        where('date', '>=', thirtyStr),
        orderBy('date', 'desc')
      )
      const recentSnap = await getDocs(recentQ)
      const dates = recentSnap.docs.map(d => d.data().date).sort().reverse()
      let s = 0
      let cur = today
      for (const d of dates) {
        if (d === cur) {
          s++
          const prev = new Date(cur)
          prev.setDate(prev.getDate() - 1)
          cur = prev.toISOString().split('T')[0]
        } else {
          break
        }
      }
      setStreak(s)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const today = todayStr()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'おはよう！' : hour < 17 ? 'こんにちは！' : 'おつかれさま！'
  const name = profile?.nickname || 'せんしゅ'

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
        <div className="spinner" style={{ margin: '0 auto 12px', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div>
      {/* あいさつバナー */}
      <div className="home-greeting">
        <p className="greeting-date">{formatDateJP(today)}</p>
        <h2>{greeting} {name}！</h2>
        <p>
          {todayRecord
            ? '今日の記録は完了だ！'
            : isChild ? '今日の記録をつけよう！' : '子どもの様子を確認しよう！'}
        </p>
        {todayRecord && (
          <span className="recorded-tag">✅ きろく済み</span>
        )}
      </div>

      {/* 子ども向けショートカット */}
      {isChild && (
        <>
          {/* 今日の記録ボタン */}
          {!todayRecord ? (
            <button
              className="btn btn-success"
              style={{ marginBottom: 12, fontSize: '1.1rem' }}
              onClick={() => navigate('/record')}
            >
              📝 今日のふりかえりを書く
            </button>
          ) : (
            <button
              className="btn btn-outline"
              style={{ marginBottom: 12 }}
              onClick={() => navigate('/record')}
            >
              ✏️ 今日の記録を見る・修正
            </button>
          )}

          {/* 練習メニュー追加 */}
          <button
            className="btn btn-primary"
            style={{ marginBottom: 16 }}
            onClick={() => navigate('/training')}
          >
            ⚾ 練習メニューを追加する
          </button>
        </>
      )}

      {/* 今週のまとめ */}
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

      {/* クイックリンク */}
      <div className="card">
        <div className="card-title">🔗 クイックメニュー</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {isChild && (
            <>
              <QuickBtn icon="📊" label="せいちょうグラフ" onClick={() => navigate('/stats')} />
              <QuickBtn icon="🏆" label="ランキング" onClick={() => navigate('/ranking')} />
            </>
          )}
          {!isChild && (
            <QuickBtn icon="👀" label="みまもり画面" onClick={() => navigate('/parent')} color="#dcfce7" />
          )}
          <QuickBtn icon="⚙️" label="設定" onClick={() => navigate('/settings')} />
        </div>
      </div>

      {/* ストリーク応援メッセージ */}
      {isChild && streak >= 3 && (
        <div style={{
          background: 'linear-gradient(135deg, #1a3a5c, #2563eb)',
          borderRadius: 12,
          padding: '16px',
          color: '#fff',
          textAlign: 'center',
          marginBottom: 12,
        }}>
          <p style={{ fontSize: '1.5rem', marginBottom: 4 }}>
            {streak >= 30 ? '🏅' : streak >= 14 ? '🥇' : streak >= 7 ? '⭐' : '🔥'}
          </p>
          <p style={{ fontWeight: 900, fontSize: '1rem' }}>{streak}日連続きろく中！</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 4 }}>
            {streak >= 30 ? 'すごすぎ！伝説だ！' :
             streak >= 14 ? 'もう本物のプロ選手みたいだ！' :
             streak >= 7 ? '1週間達成！このまま続けよう！' :
             'いい感じ！続けていこう！'}
          </p>
        </div>
      )}
    </div>
  )
}

function QuickBtn({ icon, label, onClick, color = '#e0f2fe' }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color,
        border: 'none',
        borderRadius: 10,
        padding: '14px 8px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: '1.6rem' }}>{icon}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>{label}</span>
    </button>
  )
}

const MOOD_MAP = {
  best:    { emoji: '🤩', label: '最高！' },
  good:    { emoji: '😊', label: 'まあまあ' },
  frustrate: { emoji: '😤', label: 'くやしい' },
  tired:   { emoji: '😴', label: 'つかれた' },
  moody:   { emoji: '😶', label: 'モヤモヤ' },
}
