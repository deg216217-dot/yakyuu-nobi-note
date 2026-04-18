/**
 * 親の見守り画面
 * 親1アカウント＝子ども1人。子ども1人に親は最大2人まで見守れる。
 * records クエリは orderBy を使わずクライアント側でソート（複合インデックス不要）。
 */
import { useState, useEffect } from 'react'
import {
  collection, query, where,
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

/** 初期表示するスタンプ（よく使うもの優先） */
const QUICK_STAMPS = [
  { type: 'mitayo',    emoji: '👀', label: 'みたよ！' },
  { type: 'ganbatta',  emoji: '💪', label: 'がんばったね' },
  { type: 'sugoi',     emoji: '🌟', label: 'すごい！' },
  { type: 'nice',      emoji: '👍', label: 'NICE!' },
  { type: 'otukare',   emoji: '☕', label: 'おつかれさま' },
  { type: 'tsuzukete', emoji: '🔥', label: '続けてるのすごい' },
]

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

  const childUid = profile?.childUid || null

  const [childProfile, setChildProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [noChild, setNoChild] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [sentReactionsByDate, setSentReactionsByDate] = useState({})
  const [sendingReaction, setSendingReaction] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showAllStamps, setShowAllStamps] = useState(false)

  useEffect(() => {
    if (!isParent) return
    if (!childUid) { setNoChild(true); setLoading(false); return }

    const unsubs = []
    setLoading(true)
    setNoChild(false)
    setLoadError(false)
    loadChild(childUid, unsubs)
    return () => unsubs.forEach(fn => fn())
  }, [childUid, isParent])

  async function loadChild(cUid, unsubs) {
    try {
      const snap = await getDoc(doc(db, 'users', cUid))
      if (!snap.exists()) {
        setLoadError(true)
        setLoading(false)
        return
      }
      setChildProfile(snap.data())

      const from = nDaysAgoStr(30)

      const recQ = query(
        collection(db, 'dailyRecords'),
        where('uid', '==', cUid),
        where('date', '>=', from),
      )
      const unsubRecords = onSnapshot(recQ, (snap) => {
        const sorted = snap.docs.map(d => d.data()).sort((a, b) => a.date.localeCompare(b.date))
        setRecords(sorted)
      }, (err) => { console.error('records snapshot error:', err) })
      unsubs.push(unsubRecords)

      const reactQ = query(
        collection(db, 'parentReactions'),
        where('parentUid', '==', user.uid),
        where('childUid', '==', cUid),
        where('date', '>=', from),
      )
      const unsubReactions = onSnapshot(reactQ, (snap) => {
        const byDate = {}
        snap.docs.forEach(d => {
          const { date, reactionType } = d.data()
          if (!byDate[date]) byDate[date] = []
          byDate[date].push(reactionType)
        })
        setSentReactionsByDate(byDate)
      }, (err) => { console.error('reactions snapshot error:', err) })
      unsubs.push(unsubReactions)

    } catch (e) {
      console.error('loadChild error:', e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  async function sendReaction(reactionType) {
    if (!user || !childUid) return
    setSendingReaction(true)
    try {
      const docId = `${user.uid}_${childUid}_${selectedDate}_${reactionType}`
      await setDoc(doc(db, 'parentReactions', docId), {
        parentUid: user.uid,
        childUid,
        date: selectedDate,
        reactionType,
        createdAt: serverTimestamp(),
      })
      setSentReactionsByDate(prev => ({
        ...prev,
        [selectedDate]: [...(prev[selectedDate] || []), reactionType],
      }))
      showToast('スタンプを送りました！', 'success')
    } catch (e) {
      console.error(e)
      showToast('送れませんでした', 'error')
    } finally { setSendingReaction(false) }
  }

  function StampButton({ r }) {
    const sentForDate = sentReactionsByDate[selectedDate] || []
    const isSent = sentForDate.includes(r.type)
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
          <p className="font-bold mb-sm">まだお子さんと連携されていません</p>
          <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
            お子さんの設定画面で「招待コード」を確認して、<br />
            設定画面で入力すると記録が見られるようになります。
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div>
        <h2 className="page-title">みまもり画面</h2>
        <div className="card text-center" style={{ padding: '24px 16px' }}>
          <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
            データを読み込めませんでした。<br />
            設定画面でお子さんとのリンクを確認してください。
          </p>
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
  const isToday = selectedDate === today

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

      {/* 直近7日カレンダー */}
      <div className="card">
        <div className="card-title">直近7日</div>
        <p className="text-xs text-muted mb-sm">タップで記録を見られます</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {last7.map((d, i) => {
            const isToday = d.date === today
            const isSelected = d.date === selectedDate
            return (
              <button key={i} type="button"
                onClick={() => { if (d.hasRecord) { setSelectedDate(d.date); setShowAllStamps(false) } }}
                disabled={!d.hasRecord}
                aria-label={`${formatShort(d.date)}${d.hasRecord ? '' : '（記録なし）'}`}
                aria-current={isSelected ? 'true' : undefined}
                style={{
                  flex: 1, textAlign: 'center', padding: '8px 4px',
                  background: isSelected ? 'var(--primary)' : d.hasRecord ? 'var(--primary-bg)' : 'var(--border-light)',
                  borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: d.hasRecord ? 'pointer' : 'default',
                  transition: 'all 0.15s ease', fontFamily: 'var(--font)',
                }}>
                <span style={{
                  fontSize: '0.7rem', display: 'block',
                  color: isSelected ? '#fff' : isToday ? 'var(--primary)' : 'var(--text-2)',
                  fontWeight: isToday || isSelected ? 700 : 400,
                }}>
                  {formatShort(d.date)}
                </span>
                <span style={{
                  fontSize: '1.2rem', marginTop: 2, display: 'block',
                  filter: isSelected ? 'brightness(10)' : 'none',
                }} aria-hidden="true">
                  {d.mood ? MOOD_MAP[d.mood]?.emoji : d.hasRecord ? '●' : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 選択日の記録 */}
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
        <div className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
            {isToday ? '今日の記録はまだありません' : `${formatDateJP(selectedDate)} の記録はありません`}
          </p>
          {isToday && (
            <p className="text-xs text-muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
              記録が見えないときは、子ども側で<br />今日の記録が保存されているか確認してください。
            </p>
          )}
        </div>
      )}

      {/* スタンプ送信 — 記録の直後に表示して気づきやすく */}
      {selectedRec ? (
        <div className="card" style={{ border: '2px solid var(--primary-light)' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>スタンプを送る</span>
            {selectedDate !== today && (
              <span className="text-xs text-muted" style={{ fontWeight: 400 }}>
                {formatDateJP(selectedDate)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            読んだよ、という気持ちをスタンプで伝えましょう
          </p>
          <div className="reaction-grid">
            {QUICK_STAMPS.map(r => <StampButton key={r.type} r={r} />)}
          </div>
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
            {isToday
              ? '今日の記録がまだないため、スタンプはまだ送れません。'
              : 'この日の記録がないため、スタンプは送れません。'}
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
