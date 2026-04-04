import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, weekStartStr, nDaysAgoStr } from '../utils/dateUtils'
import NiceButton from '../components/NiceButton'

const AWARD_DEFS = [
  { key: 'weekMinutes', icon: '⚾', title: '練習時間賞', desc: '今週の練習時間が多い順', color: '#dbeafe', valueLabel: v => `${v}分` },
  { key: 'streak',      icon: '🔥', title: '継続賞',     desc: '連続記録日数が長い順',     color: '#fef3c7', valueLabel: v => `${v}日` },
  { key: 'weekRecords', icon: '📝', title: '記録賞',     desc: '今週の記録回数が多い順',   color: '#dcfce7', valueLabel: v => `${v}回` },
]

export default function TeamRanking() {
  const { user, profile, isTrial } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAward, setActiveAward] = useState('weekMinutes')

  useEffect(() => {
    if (isTrial || !profile?.teamCode) { setLoading(false); return }
    loadTeam()
  }, [profile, isTrial])

  async function loadTeam() {
    try {
      const teamCode = profile.teamCode
      const ws = weekStartStr()
      const today = todayStr()
      const thirtyAgo = nDaysAgoStr(30)

      // チームの子どもをpublicSummariesから集める
      const usersSnap = await getDocs(query(collection(db, 'users'), where('teamCode', '==', teamCode), where('role', '==', 'child')))
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const data = await Promise.all(users.map(async u => {
        // 今週の公開要約
        const weekSnap = await getDocs(query(
          collection(db, 'publicSummaries'),
          where('uid', '==', u.uid), where('date', '>=', ws), where('date', '<=', today)
        ))
        let weekMinutes = 0, weekRecords = 0, todayHitokoto = '', todayGoal = ''
        weekSnap.forEach(d => {
          const s = d.data()
          weekMinutes += s.totalMinutes || 0
          weekRecords++
          if (s.date === today) { todayHitokoto = s.hitokoto || ''; todayGoal = s.nextGoal || '' }
        })

        // 連続記録（公開要約から）
        const recSnap = await getDocs(query(
          collection(db, 'publicSummaries'),
          where('uid', '==', u.uid), where('date', '>=', thirtyAgo), orderBy('date', 'desc')
        ))
        const dates = recSnap.docs.map(d => d.data().date).sort().reverse()
        let streak = 0, cur = today
        for (const d of dates) {
          if (d === cur) { streak++; const p = new Date(cur); p.setDate(p.getDate() - 1); cur = p.toISOString().split('T')[0] }
          else break
        }

        // 練習TOP3（trainingMenusはチーム読み取り可）
        const menuSnap = await getDocs(query(
          collection(db, 'trainingMenus'),
          where('uid', '==', u.uid), where('date', '>=', ws), where('date', '<=', today)
        ))
        const mc = {}
        menuSnap.forEach(d => { const { menuLabel, minutes } = d.data(); mc[menuLabel] = (mc[menuLabel] || 0) + (minutes || 0) })
        const top3 = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)

        return {
          uid: u.uid, nickname: u.nickname,
          isMe: u.uid === user.uid,
          weekMinutes, weekRecords, streak,
          todayHitokoto, todayGoal, top3,
        }
      }))

      setMembers(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // おためしモード
  if (isTrial) {
    return (
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>🏆 チームランキング</h2>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: '3rem', marginBottom: 8 }}>🔒</p>
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>おためし中は見られないよ</p>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>
            アカウント登録＆チームコード設定をすると、<br />
            チームのランキングに参加できるよ！
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>
    <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
    <p style={{ color: '#9ca3af', marginTop: 12 }}>チームデータを読み込み中...</p>
  </div>

  const award = AWARD_DEFS.find(a => a.key === activeAward)
  const sorted = [...members].sort((a, b) => b[activeAward] - a[activeAward])

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 4 }}>🏆 チームランキング</h2>
      <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
        ※ 日記の中身は見えないよ。がんばりの要約だけ公開！
      </p>

      {/* 賞切り替え */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {AWARD_DEFS.map(a => (
          <button key={a.key} onClick={() => setActiveAward(a.key)}
            style={{
              flexShrink: 0, padding: '10px 16px', borderRadius: 20, border: '2px solid',
              borderColor: activeAward === a.key ? '#2563eb' : '#e5e7eb',
              background: activeAward === a.key ? '#2563eb' : '#fff',
              color: activeAward === a.key ? '#fff' : '#374151',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
            {a.icon} {a.title}
          </button>
        ))}
      </div>

      <div style={{ background: award.color, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>
        {award.icon} {award.desc}
      </div>

      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🤝</div>
          <p>まだチームメンバーがいないよ</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>仲間をさそってみよう！</p>
        </div>
      ) : sorted.map((m, i) => <RankCard key={m.uid} rank={i + 1} member={m} award={award} />)}

      <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: 16 }}>
        今週（月〜今日）のデータです
      </p>
    </div>
  )
}

function RankCard({ rank, member, award }) {
  const colors = { 1: '#f59e0b', 2: '#94a3b8', 3: '#fb923c' }
  const emoji = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return (
    <div className={`rank-item rank-${rank <= 3 ? rank : ''}`}
      style={{ outline: member.isMe ? '2px solid #2563eb' : 'none', outlineOffset: 2 }}>
      <div className="rank-num" style={{ color: colors[rank] || '#6b7280' }}>{emoji[rank] || rank}</div>
      <div className="rank-info">
        <div className="rank-name">
          {member.nickname}
          {member.isMe && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#2563eb', color: '#fff', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>じぶん</span>}
        </div>
        <div className="rank-detail">🔥 {member.streak}日連続　📝 今週{member.weekRecords}回</div>
        {member.top3.length > 0 && <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: 2 }}>よく練習: {member.top3.join('・')}</div>}
        {member.todayHitokoto && (
          <div style={{ fontSize: '0.75rem', color: '#374151', marginTop: 4, background: '#f3f4f6', borderRadius: 6, padding: '4px 8px' }}>
            💬 {member.todayHitokoto}
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          <NiceButton targetUid={member.uid} targetNickname={member.nickname} />
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 52 }}>
        <div style={{ fontWeight: 900, fontSize: '1.2rem', color: colors[rank] || '#374151' }}>{award.valueLabel(member[award.key])}</div>
        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{award.title}</div>
      </div>
    </div>
  )
}
