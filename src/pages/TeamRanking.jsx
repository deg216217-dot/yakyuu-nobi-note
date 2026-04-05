import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, weekStartStr, nDaysAgoStr, prevDateStr } from '../utils/dateUtils'
import NiceButton from '../components/NiceButton'

const AWARD_DEFS = [
  { key: 'weekMinutes', icon: '⚾', title: '練習がんばったで賞', desc: '今週たくさん練習した人', valueLabel: v => `${v}分` },
  { key: 'streak',      icon: '🔥', title: '連続記録チャンピオン', desc: '毎日コツコツ記録している人', valueLabel: v => `${v}日` },
  { key: 'weekRecords', icon: '📝', title: 'たくさん書いたで賞', desc: '今週たくさん記録を書いた人', valueLabel: v => `${v}回` },
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

      // 1. ユーザー一覧
      const usersSnap = await getDocs(query(collection(db, 'users'), where('teamCode', '==', teamCode), where('role', '==', 'child')))
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (users.length === 0) { setMembers([]); return }

      // 2. バッチクエリ（teamCode で一括取得）
      const [summariesSnap, menuSnap] = await Promise.all([
        getDocs(query(collection(db, 'publicSummaries'), where('teamCode', '==', teamCode), where('date', '>=', thirtyAgo))),
        getDocs(query(collection(db, 'trainingMenus'), where('teamCode', '==', teamCode), where('date', '>=', ws), where('date', '<=', today))),
      ])

      // 3. UID別にグループ化
      const summaryByUid = {}
      summariesSnap.forEach(d => {
        const s = d.data()
        if (!summaryByUid[s.uid]) summaryByUid[s.uid] = []
        summaryByUid[s.uid].push(s)
      })

      const menuByUid = {}
      menuSnap.forEach(d => {
        const m = d.data()
        if (!menuByUid[m.uid]) menuByUid[m.uid] = []
        menuByUid[m.uid].push(m)
      })

      // 4. 各ユーザーの統計を計算
      const data = users.map(u => {
        const summaries = summaryByUid[u.uid] || []
        const weekSummaries = summaries.filter(s => s.date >= ws && s.date <= today)

        let weekMinutes = 0, weekRecords = 0, todayHitokoto = ''
        weekSummaries.forEach(s => {
          weekMinutes += s.totalMinutes || 0
          weekRecords++
          if (s.date === today) todayHitokoto = s.hitokoto || ''
        })

        // ストリーク計算
        const dates = [...new Set(summaries.map(s => s.date))].sort().reverse()
        let streak = 0, cur = today
        for (const d of dates) {
          if (d === cur) { streak++; cur = prevDateStr(cur) }
          else break
        }

        // Top3メニュー
        const menus = menuByUid[u.uid] || []
        const mc = {}
        menus.forEach(m => { mc[m.menuLabel] = (mc[m.menuLabel] || 0) + (m.minutes || 0) })
        const top3 = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)

        return {
          uid: u.uid, nickname: u.nickname,
          isMe: u.uid === user.uid,
          weekMinutes, weekRecords, streak,
          todayHitokoto, top3,
        }
      })

      setMembers(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (isTrial) {
    return (
      <div>
        <h2 className="page-title">🏆 チームのがんばり</h2>
        <div className="card text-center" style={{ padding: 32 }}>
          <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔒</p>
          <p className="font-bold">おためし中は見られないよ</p>
          <p className="text-sm text-muted mt-sm" style={{ lineHeight: 1.6 }}>
            アカウント登録＆チームコード設定をすると、<br />
            チームのみんなのがんばりが見えるよ！
          </p>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="loading-center" style={{ flexDirection: 'column', gap: 12 }}>
      <div className="spinner" />
      <p className="text-sm text-hint">チームデータを読み込み中...</p>
    </div>
  )

  const award = AWARD_DEFS.find(a => a.key === activeAward)
  const sorted = [...members].sort((a, b) => b[activeAward] - a[activeAward])

  return (
    <div>
      <h2 className="page-title">🏆 チームのがんばり</h2>
      <p className="page-subtitle">※ 日記の中身は見えないよ。がんばりの要約だけ公開！</p>

      {/* 賞切り替え */}
      <div className="segment-control">
        {AWARD_DEFS.map(a => (
          <button key={a.key}
            className={`segment-btn ${activeAward === a.key ? 'active' : ''}`}
            onClick={() => setActiveAward(a.key)}>
            {a.icon} {a.title}
          </button>
        ))}
      </div>

      <div className="card card-highlight" style={{ padding: '10px 16px', marginBottom: 16 }}>
        <span className="text-sm font-bold">{award.icon} {award.desc}</span>
      </div>

      {/* 今週の注目！ */}
      {sorted.length > 0 && sorted[0][activeAward] > 0 && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, var(--primary), #6366F1)',
          color: '#fff', textAlign: 'center', border: 'none',
        }}>
          <p style={{ fontSize: '2rem', marginBottom: 4 }}>{award.icon}</p>
          <p className="font-extrabold" style={{ fontSize: '0.95rem' }}>
            今週の{award.title}
          </p>
          <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '8px 0 4px' }}>
            {sorted[0].nickname}
          </p>
          <p style={{ opacity: 0.85, fontSize: '0.85rem' }}>
            {award.valueLabel(sorted[0][activeAward])}
          </p>
        </div>
      )}

      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🤝</div>
          <p>まだチームメンバーがいないよ</p>
          <p className="empty-hint">仲間をさそってみよう！</p>
        </div>
      ) : sorted.map(m => <MemberCard key={m.uid} member={m} award={award} />)}

      <p className="text-xs text-hint text-center mt-lg" style={{ lineHeight: 1.6 }}>
        今週（月〜今日）のデータです<br />
        みんなでがんばろう！💪
      </p>
    </div>
  )
}

function MemberCard({ member, award }) {
  return (
    <div className="card" style={{
      padding: '14px 16px',
      outline: member.isMe ? '2px solid var(--primary)' : 'none',
      outlineOffset: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span className="font-extrabold" style={{ fontSize: '0.95rem' }}>{member.nickname}</span>
            {member.isMe && (
              <span style={{
                fontSize: '0.65rem',
                background: 'var(--primary)', color: '#fff',
                borderRadius: 'var(--r-full)', padding: '2px 8px', fontWeight: 700,
              }}>じぶん</span>
            )}
          </div>
          <div className="text-xs text-muted" style={{ display: 'flex', gap: 10 }}>
            <span>🔥 {member.streak}日連続</span>
            <span>📝 今週{member.weekRecords}回</span>
          </div>
          {member.top3.length > 0 && (
            <div className="text-xs text-primary mt-sm">よく練習: {member.top3.join('・')}</div>
          )}
          {member.todayHitokoto && (
            <div className="text-xs mt-sm" style={{
              background: 'var(--bg)', borderRadius: 'var(--r-sm)',
              padding: '4px 8px', color: 'var(--text-1)',
            }}>
              💬 {member.todayHitokoto}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <NiceButton targetUid={member.uid} targetNickname={member.nickname} />
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 52, paddingTop: 2 }}>
          <div className="font-extrabold" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
            {award.valueLabel(member[award.key])}
          </div>
          <div className="text-xs text-hint">{award.title.replace('で賞', '').replace('チャンピオン', '')}</div>
        </div>
      </div>
    </div>
  )
}
