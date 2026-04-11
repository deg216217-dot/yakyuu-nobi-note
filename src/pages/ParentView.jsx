import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs, orderBy,
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, nDaysAgoStr, formatShort, lastNDays, prevDateStr } from '../utils/dateUtils'
import { useToast } from '../contexts/ToastContext'

const MOOD_MAP = {
  best: { emoji: '🤩', label: '最高！' }, good: { emoji: '😊', label: 'まあまあ' },
  frustrate: { emoji: '😤', label: 'くやしい' }, tired: { emoji: '😴', label: 'つかれた' }, moody: { emoji: '😶', label: 'モヤモヤ' },
}

const REACTIONS = [
  { type: 'mitayo',    emoji: '👀', label: 'みたよ' },
  { type: 'ganbatta',  emoji: '💪', label: 'がんばったね' },
  { type: 'tsuzukete', emoji: '🔥', label: 'つづけてていいね' },
  { type: 'kaketa',    emoji: '✏️', label: 'きょうも書けたね' },
  { type: 'ashita',    emoji: '⭐', label: '明日もたのしみだね' },
  { type: 'nice',      emoji: '👍', label: 'ナイスふりかえり' },
]

export default function ParentView() {
  const { user, profile, isParent } = useAuth()
  const { showToast } = useToast()
  const [childProfile, setChildProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewRange, setViewRange] = useState(7)
  const [noChild, setNoChild] = useState(false)
  const [sentReactions, setSentReactions] = useState([])
  const [sendingReaction, setSendingReaction] = useState(false)

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
      const rSnap = await getDocs(query(
        collection(db, 'dailyRecords'),
        where('uid', '==', childUid),
        where('date', '>=', from),
        where('date', '<=', today),
        orderBy('date', 'asc'),
      ))
      setRecords(rSnap.docs.map(d => d.data()))

      // 今日送ったリアクションを取得
      const reactSnap = await getDocs(query(
        collection(db, 'parentReactions'),
        where('parentUid', '==', user.uid),
        where('childUid', '==', childUid),
        where('date', '==', today),
      ))
      setSentReactions(reactSnap.docs.map(d => d.data().reactionType))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function sendReaction(reactionType) {
    if (!user || !profile?.childUid) return
    setSendingReaction(true)
    try {
      const today = todayStr()
      const docId = `${user.uid}_${profile.childUid}_${today}_${reactionType}`
      await setDoc(doc(db, 'parentReactions', docId), {
        parentUid: user.uid,
        childUid: profile.childUid,
        date: today,
        reactionType,
        createdAt: serverTimestamp(),
      })
      setSentReactions(prev => [...prev, reactionType])
      showToast('スタンプを送りました！', 'success')
    } catch (e) {
      console.error(e)
      showToast('送れませんでした', 'error')
    } finally { setSendingReaction(false) }
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

  const allDates = [...new Set(records.map(r => r.date))].sort().reverse()
  let streak = 0, cur = today
  for (const d of allDates) {
    if (d === cur) { streak++; cur = prevDateStr(cur) }
    else break
  }

  const last7 = lastNDays(7).map(d => {
    const rec = records.find(r => r.date === d)
    return { date: d, mood: rec?.mood, hasRecord: !!rec }
  })

  const myPlays = fRec.filter(r => r.myPlay).slice(-5).reverse()
  const concerns = fRec.filter(r => r.concern).slice(-3).reverse()
  const goals = fRec.filter(r => r.nextGoal).slice(-3).reverse()
  const todayRec = records.find(r => r.date === today)

  return (
    <div>
      <h2 className="page-title">👀 みまもり画面</h2>
      <p className="page-subtitle">{childProfile?.nickname}さんの記録</p>

      <div className="segment-control">
        <button className={`segment-btn ${viewRange === 7 ? 'active' : ''}`} onClick={() => setViewRange(7)}>過去7日</button>
        <button className={`segment-btn ${viewRange === 30 ? 'active' : ''}`} onClick={() => setViewRange(30)}>過去30日</button>
      </div>

      {/* 統計 */}
      <div className="stats-row cols-3">
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{streak}<span className="stat-unit">日</span></div>
          <div className="stat-label">連続</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{fRec.length}</div>
          <div className="stat-label">記録日数</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-value">{fRec.filter(r => r.nextGoal).length}</div>
          <div className="stat-label">目標設定</div>
        </div>
      </div>

      {/* 今日の記録プレビュー + スタンプ */}
      {todayRec && (
        <>
          {/* 記録プレビュー */}
          <div className="card" style={{ background: 'var(--primary-bg)' }}>
            <div className="card-title">📝 今日の記録</div>
            {todayRec.mood && (
              <p className="text-sm" style={{ marginBottom: 8 }}>
                気分: {MOOD_MAP[todayRec.mood]?.emoji} {MOOD_MAP[todayRec.mood]?.label}
              </p>
            )}
            {todayRec.myPlay && (
              <p className="text-sm" style={{ marginBottom: 4 }}>
                ⭐ {todayRec.myPlay}
              </p>
            )}
            {todayRec.concern && (
              <p className="text-sm" style={{ marginBottom: 4 }}>
                💭 {todayRec.concern}
              </p>
            )}
            {todayRec.nextGoal && (
              <p className="text-sm" style={{ marginBottom: 4 }}>
                🎯 {todayRec.nextGoal}
              </p>
            )}
            {!todayRec.myPlay && !todayRec.concern && !todayRec.nextGoal && !todayRec.mood && (
              <p className="text-sm text-muted">記録あり（内容なし）</p>
            )}
          </div>

          {/* スタンプ */}
          <div className="card">
            <div className="card-title">💌 スタンプを送る</div>
            <p className="text-xs text-muted mb-md">
              記録を読んだら、気持ちを伝えよう
            </p>
            <div className="reaction-grid">
              {REACTIONS.map(r => {
                const isSent = sentReactions.includes(r.type)
                return (
                  <button key={r.type}
                    className={`reaction-btn ${isSent ? 'sent' : ''}`}
                    onClick={() => !isSent && sendReaction(r.type)}
                    disabled={sendingReaction || isSent}
                    style={{ opacity: sendingReaction && !isSent ? 0.6 : 1 }}
                  >
                    <span className="reaction-emoji">{r.emoji}</span>
                    <span>{r.label}</span>
                    {isSent && <span className="text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* 直近7日の記録状況 */}
      <div className="card">
        <div className="card-title">📅 直近7日</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {last7.map((d, i) => {
            const isToday = d.date === today
            return (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '8px 4px',
                background: d.hasRecord ? 'var(--primary-bg)' : 'var(--border-light)',
                borderRadius: 'var(--r-sm)',
              }}>
                <span style={{ fontSize: '0.65rem', color: isToday ? 'var(--primary)' : 'var(--text-3)', fontWeight: isToday ? 700 : 400 }}>
                  {formatShort(d.date)}
                </span>
                <div style={{ fontSize: '1.2rem', marginTop: 2 }}>
                  {d.mood ? MOOD_MAP[d.mood]?.emoji : d.hasRecord ? '📝' : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 100点プレー */}
      {myPlays.length > 0 && (
        <div className="card">
          <div className="card-title">⭐ 最近の100点プレー</div>
          {myPlays.map((r, i) => (
            <div key={i} className="list-item" style={{ background: 'var(--accent-bg)' }}>
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
          <p className="text-xs text-muted mb-sm">温かく見守ってあげてください</p>
          {concerns.map((r, i) => (
            <div key={i} className="list-item">
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
