import { useState, useEffect } from 'react'
import {
  collection, query, where, orderBy,
  doc, getDoc, setDoc, serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, nDaysAgoStr, formatShort, formatDateJP, lastNDays, prevDateStr } from '../utils/dateUtils'
import { useToast } from '../contexts/ToastContext'

const MOOD_MAP = {
  best: { emoji: '🤩', label: '最高！' }, good: { emoji: '😊', label: 'いい感じ' },
  frustrate: { emoji: '😤', label: 'くやしい' }, tired: { emoji: '😴', label: 'つかれた' }, moody: { emoji: '😶', label: 'モヤモヤ' },
}

/** 厳選スタンプ（初期表示） */
const QUICK_STAMPS = [
  { type: 'mitayo',    emoji: '👀', label: 'みたよ！' },
  { type: 'ganbatta',  emoji: '💪', label: 'がんばったね' },
  { type: 'otukare',   emoji: '☕', label: 'おつかれさま' },
  { type: 'nice',      emoji: '👍', label: 'NICE!' },
]

/** 全スタンプ（カテゴリ付き・「もっと見る」で展開） */
const STAMP_CATEGORIES = [
  {
    name: '見守り・認める',
    stamps: [
      { type: 'mitayo',    emoji: '👀', label: 'みたよ！' },
      { type: 'kaketa',    emoji: '✏️', label: 'きょうも書けたね' },
      { type: 'tsuzukete', emoji: '🔥', label: '続けてるのすごい' },
      { type: 'furikaeri', emoji: '💡', label: 'ふりかえれたね' },
    ]
  },
  {
    name: 'ほめる・はげます',
    stamps: [
      { type: 'ganbatta', emoji: '💪', label: 'がんばったね' },
      { type: 'sugoi',    emoji: '🌟', label: 'すごい！' },
      { type: 'ashita',   emoji: '⭐', label: '明日もたのしみ' },
      { type: 'seichou',  emoji: '🌱', label: '成長してるよ' },
    ]
  },
  {
    name: '寄り添い',
    stamps: [
      { type: 'otukare',  emoji: '☕', label: 'おつかれさま' },
      { type: 'daijoubu', emoji: '🌈', label: 'だいじょうぶだよ' },
      { type: 'nexttime', emoji: '✊', label: 'つぎはきっと！' },
      { type: 'yukkuri',  emoji: '🍀', label: 'ゆっくりでいいよ' },
    ]
  },
  {
    name: 'English',
    stamps: [
      { type: 'nice',       emoji: '👍', label: 'NICE!' },
      { type: 'good',       emoji: '👏', label: 'GOOD!' },
      { type: 'awesome',    emoji: '🔥', label: 'AWESOME!' },
      { type: 'keepgoing',  emoji: '💫', label: 'KEEP GOING!' },
      { type: 'proud',      emoji: '🏆', label: 'PROUD OF YOU!' },
      { type: 'takeiteasy', emoji: '😌', label: 'TAKE IT EASY!' },
    ]
  },
]

export default function ParentView() {
  const { user, profile, isParent } = useAuth()
  const { showToast } = useToast()
  const [childProfile, setChildProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [noChild, setNoChild] = useState(false)
  const [sentReactions, setSentReactions] = useState([])
  const [sendingReaction, setSendingReaction] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showAllStamps, setShowAllStamps] = useState(false)

  useEffect(() => {
    if (!isParent) return
    if (!profile?.childUid) { setNoChild(true); setLoading(false); return }
    const unsubs = []
    loadChild(profile.childUid, unsubs)
    return () => unsubs.forEach(fn => fn())
  }, [profile])

  async function loadChild(childUid, unsubs) {
    try {
      const snap = await getDoc(doc(db, 'users', childUid))
      if (!snap.exists()) { setNoChild(true); setLoading(false); return }
      setChildProfile(snap.data())

      const from = nDaysAgoStr(30)
      const recQ = query(
        collection(db, 'dailyRecords'),
        where('uid', '==', childUid),
        where('date', '>=', from),
        orderBy('date', 'asc'),
      )
      const unsubRecords = onSnapshot(recQ, (snap) => {
        setRecords(snap.docs.map(d => d.data()))
      }, () => {})
      unsubs.push(unsubRecords)

      const today = todayStr()
      const reactQ = query(
        collection(db, 'parentReactions'),
        where('parentUid', '==', user.uid),
        where('childUid', '==', childUid),
        where('date', '==', today),
      )
      const unsubReactions = onSnapshot(reactQ, (snap) => {
        setSentReactions(snap.docs.map(d => d.data().reactionType))
      }, () => {})
      unsubs.push(unsubReactions)
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

  function StampButton({ r }) {
    const isSent = sentReactions.includes(r.type)
    return (
      <button
        className={`reaction-btn ${isSent ? 'sent' : ''}`}
        onClick={() => !isSent && sendReaction(r.type)}
        disabled={sendingReaction || isSent}
        aria-label={`${r.label}${isSent ? '（送信済み）' : ''}`}
        style={{ opacity: sendingReaction && !isSent ? 0.6 : 1 }}
      >
        <span className="reaction-emoji" aria-hidden="true">{r.emoji}</span>
        <span>{r.label}</span>
        {isSent && <span className="text-xs" aria-hidden="true">✓</span>}
      </button>
    )
  }

  if (!isParent) {
    return <div className="empty-state"><div className="empty-icon">🔒</div><p>保護者専用ページです</p></div>
  }
  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (noChild) {
    return (
      <div>
        <h2 className="page-title">みまもり画面</h2>
        <div className="card text-center" style={{ padding: 32 }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>👦</p>
          <p className="font-bold mb-sm">子どものIDが未設定です</p>
          <p className="text-sm text-muted">設定画面で子どものユーザーIDを入力してください。</p>
        </div>
      </div>
    )
  }

  const today = todayStr()
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

  const selectedRec = records.find(r => r.date === selectedDate) || null
  const todayRec = records.find(r => r.date === today)

  return (
    <div>
      <h2 className="page-title">みまもり画面</h2>
      <p className="page-subtitle">{childProfile?.nickname}さんの記録</p>

      {/* 統計 */}
      <div className="stats-row cols-3">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{streak}<span className="stat-unit">日</span></div>
          <div className="stat-label">連続</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{records.length}</div>
          <div className="stat-label">記録日数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{records.filter(r => r.nextGoal).length}</div>
          <div className="stat-label">目標設定</div>
        </div>
      </div>

      {/* 直近7日カレンダー（タップで選択） */}
      <div className="card">
        <div className="card-title">直近7日</div>
        <p className="text-xs text-muted mb-sm">タップで記録を見られます</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {last7.map((d, i) => {
            const isToday = d.date === today
            const isSelected = d.date === selectedDate
            return (
              <div key={i}
                onClick={() => d.hasRecord && setSelectedDate(d.date)}
                style={{
                  flex: 1, textAlign: 'center', padding: '8px 4px',
                  background: isSelected ? 'var(--primary)' : d.hasRecord ? 'var(--primary-bg)' : 'var(--border-light)',
                  borderRadius: 'var(--r-sm)',
                  cursor: d.hasRecord ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}>
                <span style={{
                  fontSize: '0.7rem',
                  color: isSelected ? '#fff' : isToday ? 'var(--primary)' : 'var(--text-2)',
                  fontWeight: isToday || isSelected ? 700 : 400,
                }}>
                  {formatShort(d.date)}
                </span>
                <div style={{
                  fontSize: '1.2rem', marginTop: 2,
                  filter: isSelected ? 'brightness(10)' : 'none',
                }}>
                  {d.mood ? MOOD_MAP[d.mood]?.emoji : d.hasRecord ? '●' : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 選択日の記録詳細 */}
      {selectedRec ? (
        <div className="card" style={{ background: 'var(--primary-bg)' }}>
          <div className="card-title">{formatDateJP(selectedDate)} の記録</div>
          {selectedRec.mood && (
            <p className="text-sm" style={{ marginBottom: 8 }}>
              気分: {MOOD_MAP[selectedRec.mood]?.emoji} {MOOD_MAP[selectedRec.mood]?.label}
            </p>
          )}
          {selectedRec.myPlay && (
            <div style={{ marginBottom: 8 }}>
              <p className="text-xs text-muted font-bold">100点プレー</p>
              <p className="text-sm">{selectedRec.myPlay}</p>
            </div>
          )}
          {selectedRec.nicePlay && (
            <div style={{ marginBottom: 8 }}>
              <p className="text-xs text-muted font-bold">友達のナイスプレー</p>
              <p className="text-sm">{selectedRec.nicePlay}</p>
            </div>
          )}
          {selectedRec.concern && (
            <div style={{ marginBottom: 8 }}>
              <p className="text-xs text-muted font-bold">モヤっと</p>
              <p className="text-sm">{selectedRec.concern}</p>
            </div>
          )}
          {selectedRec.nextGoal && (
            <div>
              <p className="text-xs text-muted font-bold">次の目標</p>
              <p className="text-sm">{selectedRec.nextGoal}</p>
            </div>
          )}
          {!selectedRec.myPlay && !selectedRec.concern && !selectedRec.nextGoal && !selectedRec.mood && (
            <p className="text-sm text-muted">記録あり（詳細なし）</p>
          )}
        </div>
      ) : (
        <div className="card text-center" style={{ padding: '20px 16px' }}>
          <p className="text-sm text-muted">
            {selectedDate === today ? '今日の記録はまだありません' : `${formatDateJP(selectedDate)} の記録はありません`}
          </p>
        </div>
      )}

      {/* ===== スタンプ送信 ===== */}
      {todayRec ? (
        <div className="card">
          <div className="card-title">スタンプを送る</div>

          {/* 厳選4つ（初期表示） */}
          <div className="reaction-grid">
            {QUICK_STAMPS.map(r => <StampButton key={r.type} r={r} />)}
          </div>

          {/* もっと選ぶ */}
          {!showAllStamps ? (
            <button className="options-toggle" style={{ marginTop: 12 }}
              onClick={() => setShowAllStamps(true)}>
              <span className="options-arrow">▾</span>
              もっとスタンプを選ぶ
            </button>
          ) : (
            <div style={{ marginTop: 16 }}>
              {STAMP_CATEGORIES.map((cat, ci) => (
                <div key={ci} style={{ marginBottom: ci < STAMP_CATEGORIES.length - 1 ? 14 : 0 }}>
                  <p className="stamp-category-label">{cat.name}</p>
                  <div className="reaction-grid">
                    {cat.stamps.map(r => <StampButton key={r.type} r={r} />)}
                  </div>
                </div>
              ))}
              <button className="options-toggle" style={{ marginTop: 8 }}
                onClick={() => setShowAllStamps(false)}>
                <span className="options-arrow" style={{ transform: 'rotate(180deg)' }}>▾</span>
                閉じる
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center" style={{ padding: '20px 16px' }}>
          <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
            今日の記録がまだないため、スタンプはまだ送れません。<br />
            記録されたら自動で表示されます。
          </p>
        </div>
      )}

      {/* 声かけのヒント */}
      <div className="card card-highlight">
        <div className="card-title">声かけのヒント</div>
        <ul style={{ fontSize: '0.86rem', color: 'var(--text-1)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>「モヤっと」には共感のスタンプを送ると安心します</li>
          <li>頑張りを認めるスタンプが自信につながります</li>
          <li>記録の内容をもとに会話してみましょう</li>
          <li>プレッシャーをかけず、見守る姿勢が大切です</li>
        </ul>
      </div>
    </div>
  )
}
