import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function todayStr() { return new Date().toISOString().split('T')[0] }

function getWeekStartStr() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

function nDaysAgoStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const AWARD_DEFS = [
  {
    key: 'weekMinutes',
    icon: '⚾',
    title: '練習時間賞',
    desc: '今週の練習時間が多い順',
    color: '#dbeafe',
    valueLabel: (v) => `${v}分`,
  },
  {
    key: 'streak',
    icon: '🔥',
    title: '継続賞',
    desc: '連続記録日数が長い順',
    color: '#fef3c7',
    valueLabel: (v) => `${v}日`,
  },
  {
    key: 'weekRecords',
    icon: '📝',
    title: '記録賞',
    desc: '今週の記録回数が多い順',
    color: '#dcfce7',
    valueLabel: (v) => `${v}回`,
  },
]

export default function TeamRanking() {
  const { user, profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAward, setActiveAward] = useState('weekMinutes')

  useEffect(() => {
    if (!profile?.teamCode) return
    loadTeamData()
  }, [profile])

  async function loadTeamData() {
    try {
      const teamCode = profile.teamCode || 'default'
      const weekStart = getWeekStartStr()
      const today = todayStr()
      const thirtyAgo = nDaysAgoStr(30)

      // チームの子どもを全員取得
      const usersSnap = await getDocs(
        query(collection(db, 'users'),
          where('teamCode', '==', teamCode),
          where('role', '==', 'child')
        )
      )
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      // 全員の今週＋30日記録を取得
      const memberData = await Promise.all(users.map(async (u) => {
        // 今週の記録
        const weekSnap = await getDocs(query(
          collection(db, 'dailyRecords'),
          where('uid', '==', u.uid),
          where('date', '>=', weekStart),
          where('date', '<=', today)
        ))
        let weekMinutes = 0
        let weekRecords = 0
        let todayMessage = ''
        const weekDates = []
        weekSnap.forEach(d => {
          const data = d.data()
          weekMinutes += data.totalMinutes || 0
          weekRecords++
          weekDates.push(data.date)
          if (data.date === today && data.nextGoal) todayMessage = data.nextGoal
        })

        // 連続記録（30日分で計算）
        const recentSnap = await getDocs(query(
          collection(db, 'dailyRecords'),
          where('uid', '==', u.uid),
          where('date', '>=', thirtyAgo),
          where('date', '<=', today),
          orderBy('date', 'desc')
        ))
        const recentDates = recentSnap.docs.map(d => d.data().date).sort().reverse()
        let streak = 0
        let cur = today
        for (const d of recentDates) {
          if (d === cur) {
            streak++
            const prev = new Date(cur)
            prev.setDate(prev.getDate() - 1)
            cur = prev.toISOString().split('T')[0]
          } else break
        }

        // 練習TOP3
        const menuSnap = await getDocs(query(
          collection(db, 'trainingMenus'),
          where('uid', '==', u.uid),
          where('date', '>=', weekStart),
          where('date', '<=', today)
        ))
        const menuCount = {}
        menuSnap.forEach(d => {
          const { menuLabel, minutes } = d.data()
          menuCount[menuLabel] = (menuCount[menuLabel] || 0) + (minutes || 0)
        })
        const top3 = Object.entries(menuCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)

        return {
          uid: u.uid,
          nickname: u.nickname,
          isMe: u.uid === user.uid,
          weekMinutes,
          weekRecords,
          streak,
          todayMessage,
          top3,
        }
      }))

      setMembers(memberData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const award = AWARD_DEFS.find(a => a.key === activeAward)
  const sorted = [...members].sort((a, b) => b[activeAward] - a[activeAward])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
        <p style={{ color: '#9ca3af', marginTop: 12 }}>チームデータを読み込み中...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 4 }}>
        🏆 チームランキング
      </h2>
      <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
        ※ みんなの日記の中身は見えないよ。要約だけ公開！
      </p>

      {/* 賞の切り替え */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {AWARD_DEFS.map(a => (
          <button
            key={a.key}
            onClick={() => setActiveAward(a.key)}
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              borderRadius: 20,
              border: '2px solid',
              borderColor: activeAward === a.key ? '#2563eb' : '#e5e7eb',
              background: activeAward === a.key ? '#2563eb' : '#fff',
              color: activeAward === a.key ? '#fff' : '#374151',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {a.icon} {a.title}
          </button>
        ))}
      </div>

      {/* 現在の賞の説明 */}
      <div style={{
        background: award.color,
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 16,
        fontWeight: 700,
        fontSize: '0.85rem',
        color: '#374151',
      }}>
        {award.icon} {award.desc}
      </div>

      {/* ランキングリスト */}
      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🤝</div>
          <p>まだチームメンバーがいないよ</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>仲間を誘ってみよう！</p>
        </div>
      ) : (
        sorted.map((member, i) => (
          <RankCard
            key={member.uid}
            rank={i + 1}
            member={member}
            award={award}
          />
        ))
      )}

      <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: 16 }}>
        ランキングは今週（月〜今日）のデータです
      </p>
    </div>
  )
}

function RankCard({ rank, member, award }) {
  const rankColors = { 1: '#f59e0b', 2: '#94a3b8', 3: '#fb923c' }
  const rankEmoji = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div
      className={`rank-item rank-${rank <= 3 ? rank : ''}`}
      style={{
        outline: member.isMe ? '2px solid #2563eb' : 'none',
        outlineOffset: 2,
      }}
    >
      {/* 順位 */}
      <div className="rank-num" style={{ color: rankColors[rank] || '#6b7280' }}>
        {rankEmoji[rank] || rank}
      </div>

      {/* 情報 */}
      <div className="rank-info">
        <div className="rank-name">
          {member.nickname}
          {member.isMe && (
            <span style={{
              marginLeft: 6,
              fontSize: '0.7rem',
              background: '#2563eb',
              color: '#fff',
              borderRadius: 10,
              padding: '2px 8px',
              fontWeight: 700,
            }}>
              じぶん
            </span>
          )}
        </div>
        <div className="rank-detail">
          🔥 {member.streak}日連続　📝 今週{member.weekRecords}回
        </div>
        {member.top3.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: 2 }}>
            よく練習: {member.top3.join('・')}
          </div>
        )}
        {member.todayMessage && (
          <div style={{
            fontSize: '0.75rem',
            color: '#374151',
            marginTop: 4,
            background: '#f3f4f6',
            borderRadius: 6,
            padding: '4px 8px',
          }}>
            💬 {member.todayMessage}
          </div>
        )}
      </div>

      {/* スコア */}
      <div style={{ textAlign: 'right', minWidth: 52 }}>
        <div style={{ fontWeight: 900, fontSize: '1.2rem', color: rankColors[rank] || '#374151' }}>
          {award.valueLabel(member[award.key])}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{award.title}</div>
      </div>
    </div>
  )
}
