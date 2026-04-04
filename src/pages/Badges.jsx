import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, weekStartStr, nDaysAgoStr } from '../utils/dateUtils'
import { getAllRecords, getAllMenus } from '../utils/localStore'
import {
  BADGE_DEFS, evaluateBadges, groupByCategory, getCategoryName,
  getEarnedBadgeIds, saveEarnedBadgeIds,
} from '../utils/badges'

export default function Badges() {
  const { user, isTrial } = useAuth()
  const [stats, setStats] = useState(null)
  const [earned, setEarned] = useState([])
  const [locked, setLocked] = useState([])
  const [newBadges, setNewBadges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [user, isTrial])

  async function loadStats() {
    try {
      const today = todayStr()
      const ws = weekStartStr()
      const thirtyAgo = nDaysAgoStr(30)
      let records = [], menus = [], nicesSent = 0

      if (isTrial) {
        records = getAllRecords()
        menus = getAllMenus()
      } else if (user) {
        const [rSnap, mSnap] = await Promise.all([
          getDocs(query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '>=', thirtyAgo), orderBy('date', 'desc'))),
          getDocs(query(collection(db, 'trainingMenus'), where('uid', '==', user.uid), where('date', '>=', thirtyAgo))),
        ])
        records = rSnap.docs.map(d => d.data())
        menus = mSnap.docs.map(d => d.data())
        // ナイス送信数
        const nSnap = await getDocs(query(collection(db, 'nices'), where('fromUid', '==', user.uid)))
        nicesSent = nSnap.size
      }

      // 連続記録
      const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
      let streak = 0, cur = today
      for (const d of allDates) {
        if (d === cur) { streak++; const p = new Date(cur); p.setDate(p.getDate() - 1); cur = p.toISOString().split('T')[0] }
        else break
      }

      // 今日の練習時間
      const todayRec = records.find(r => r.date === today)
      const todayMinutes = todayRec?.totalMinutes || 0

      // 今週
      const weekRecords = records.filter(r => r.date >= ws && r.date <= today)
      const weekMinutes = weekRecords.reduce((s, r) => s + (r.totalMinutes || 0), 0)
      const weekMenus = menus.filter(m => m.date >= ws && m.date <= today)
      const weekMenuTypes = new Set(weekMenus.map(m => m.menuKey)).size

      // 累計
      const totalGoals = records.filter(r => r.nextGoal).length
      const totalPlays = records.filter(r => r.myPlay).length
      const totalConcerns = records.filter(r => r.concern).length
      const totalTeammatePlays = records.filter(r => r.teammatePlay).length

      const s = {
        streak, todayMinutes, weekMinutes, weekMenuTypes,
        totalGoals, totalPlays, totalConcerns,
        nicesSent, totalTeammatePlays,
      }
      setStats(s)

      const prevIds = getEarnedBadgeIds()
      const result = evaluateBadges(s, prevIds)
      setEarned(result.earned)
      setLocked(result.locked)
      setNewBadges(result.newlyEarned)

      // 新たに獲得したバッジをlocalStorageに保存
      const allEarnedIds = result.earned.map(b => b.id)
      saveEarnedBadgeIds(allEarnedIds)

    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>
    <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#f59e0b' }} />
  </div>

  const earnedGroups = groupByCategory(earned)
  const lockedGroups = groupByCategory(locked)

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 4 }}>
        🏆 バッジコレクション
      </h2>
      <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
        がんばりの証をあつめよう！
      </p>

      {/* サマリー */}
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
        borderRadius: 16, padding: 20, color: '#fff', textAlign: 'center', marginBottom: 16,
      }}>
        <p style={{ fontSize: '3rem', marginBottom: 4 }}>🏆</p>
        <p style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>{earned.length}<span style={{ fontSize: '1rem' }}>/{BADGE_DEFS.length}</span></p>
        <p style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: 4 }}>バッジ獲得！</p>
      </div>

      {/* 新規獲得バッジ */}
      {newBadges.length > 0 && (
        <div className="card" style={{ background: '#fffbeb', border: '2px solid #f59e0b' }}>
          <div className="card-title" style={{ color: '#92400e' }}>🎉 NEW! あたらしく獲得！</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {newBadges.map(b => (
              <BadgeItem key={b.id} badge={b} isNew />
            ))}
          </div>
        </div>
      )}

      {/* 獲得済みバッジ（カテゴリ別） */}
      {Object.entries(earnedGroups).map(([cat, badges]) => (
        <div key={cat} className="card">
          <div className="card-title">{getCategoryName(cat)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {badges.map(b => <BadgeItem key={b.id} badge={b} />)}
          </div>
        </div>
      ))}

      {/* 未獲得バッジ */}
      {locked.length > 0 && (
        <div className="card" style={{ opacity: 0.7 }}>
          <div className="card-title">🔒 まだ獲得していないバッジ</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {locked.map(b => <BadgeItem key={b.id} badge={b} isLocked />)}
          </div>
        </div>
      )}

      {/* ヒント */}
      <div className="card" style={{ background: '#f0f9ff' }}>
        <div className="card-title">💡 バッジを増やすコツ</div>
        <ul style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>毎日記録を続けると「つづける力」バッジがもらえるよ</li>
          <li>いろんな練習メニューをやると「バランス練習」バッジ！</li>
          <li>100点プレーやモヤっとを書くと「ふりかえる力」UP</li>
          <li>仲間にナイスを送ると「チームの力」バッジ！</li>
        </ul>
      </div>
    </div>
  )
}

function BadgeItem({ badge, isLocked, isNew }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: 80, textAlign: 'center', gap: 4,
      animation: isNew ? 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.8rem',
        background: isLocked ? '#e5e7eb' : isNew ? '#fef3c7' : '#fff',
        border: isLocked ? '2px dashed #d1d5db' : isNew ? '3px solid #f59e0b' : '2px solid #e5e7eb',
        boxShadow: isNew ? '0 0 12px rgba(245,158,11,0.4)' : 'none',
        filter: isLocked ? 'grayscale(1)' : 'none',
      }}>
        {isLocked ? '🔒' : badge.icon}
      </div>
      <span style={{
        fontSize: '0.65rem', fontWeight: 700,
        color: isLocked ? '#9ca3af' : '#374151',
        lineHeight: 1.2,
      }}>
        {badge.name}
      </span>
      <span style={{ fontSize: '0.55rem', color: '#9ca3af', lineHeight: 1.2 }}>
        {badge.desc}
      </span>
    </div>
  )
}
