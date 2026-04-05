import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, weekStartStr, nDaysAgoStr, prevDateStr } from '../utils/dateUtils'
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
        const nSnap = await getDocs(query(collection(db, 'nices'), where('fromUid', '==', user.uid)))
        nicesSent = nSnap.size
      }

      const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
      let streak = 0, cur = today
      for (const d of allDates) {
        if (d === cur) { streak++; cur = prevDateStr(cur) }
        else break
      }

      const todayRec = records.find(r => r.date === today)
      const weekRecords = records.filter(r => r.date >= ws && r.date <= today)
      const weekMenus = menus.filter(m => m.date >= ws && m.date <= today)

      const s = {
        streak,
        todayMinutes: todayRec?.totalMinutes || 0,
        weekMinutes: weekRecords.reduce((s, r) => s + (r.totalMinutes || 0), 0),
        weekMenuTypes: new Set(weekMenus.map(m => m.menuKey)).size,
        totalGoals: records.filter(r => r.nextGoal).length,
        totalPlays: records.filter(r => r.myPlay).length,
        totalConcerns: records.filter(r => r.concern).length,
        nicesSent,
        totalTeammatePlays: records.filter(r => r.teammatePlay).length,
      }
      setStats(s)

      const prevIds = getEarnedBadgeIds()
      const result = evaluateBadges(s, prevIds)
      setEarned(result.earned)
      setLocked(result.locked)
      setNewBadges(result.newlyEarned)
      saveEarnedBadgeIds(result.earned.map(b => b.id))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const earnedGroups = groupByCategory(earned)
  const lockedGroups = groupByCategory(locked)

  return (
    <div>
      <h2 className="page-title">🏆 バッジコレクション</h2>
      <p className="page-subtitle">がんばりの証をあつめよう！</p>

      {/* サマリー */}
      <div className="card text-center" style={{
        background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
        color: '#fff', border: 'none', padding: '24px 20px',
      }}>
        <p style={{ fontSize: '2.5rem', marginBottom: 4 }}>🏆</p>
        <p className="font-extrabold" style={{ fontSize: '1.8rem', lineHeight: 1 }}>
          {earned.length}<span style={{ fontSize: '0.9rem', opacity: 0.8 }}>/{BADGE_DEFS.length}</span>
        </p>
        <p className="text-sm" style={{ opacity: 0.9, marginTop: 4 }}>バッジ獲得！</p>
      </div>

      {/* 新規獲得バッジ */}
      {newBadges.length > 0 && (
        <div className="card card-warning">
          <div className="card-title" style={{ color: 'var(--accent-dark)' }}>🎉 NEW! あたらしく獲得！</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {newBadges.map(b => <BadgeItem key={b.id} badge={b} isNew />)}
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
        <div className="card" style={{ opacity: 0.6 }}>
          <div className="card-title">🔒 まだ獲得していないバッジ</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {locked.map(b => <BadgeItem key={b.id} badge={b} isLocked />)}
          </div>
        </div>
      )}

      {/* ヒント */}
      <div className="card card-highlight">
        <div className="card-title">💡 バッジを増やすコツ</div>
        <ul style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.8, paddingLeft: 20 }}>
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
      width: 76, textAlign: 'center', gap: 4,
      animation: isNew ? 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.6rem',
        background: isLocked ? 'var(--border-light)' : isNew ? 'var(--warning-bg)' : 'var(--surface)',
        border: isLocked ? '2px dashed var(--border)' : isNew ? '2.5px solid var(--accent)' : '1.5px solid var(--border)',
        boxShadow: isNew ? '0 0 12px rgba(249,115,22,0.3)' : 'none',
        filter: isLocked ? 'grayscale(1)' : 'none',
      }}>
        {isLocked ? '🔒' : badge.icon}
      </div>
      <span className="text-xs font-bold" style={{ color: isLocked ? 'var(--text-3)' : 'var(--text-1)', lineHeight: 1.2 }}>
        {badge.name}
      </span>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', lineHeight: 1.2 }}>
        {badge.desc}
      </span>
    </div>
  )
}
