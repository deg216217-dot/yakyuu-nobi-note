import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs, orderBy,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, formatDateJP, nDaysAgoStr } from '../utils/dateUtils'
import {
  getRecordByDate, saveRecord as saveLocal,
  getMenusByDate, getAllRecords,
} from '../utils/localStore'
import SuccessOverlay from '../components/SuccessOverlay'
import { getFollowUpQuestion } from '../utils/messages'
import { useToast } from '../contexts/ToastContext'

const PRACTICE_TYPES = [
  { value: 'team', label: '⚾ チーム練習' },
  { value: 'self', label: '🏃 自主練' },
  { value: 'game', label: '🏟️ 試合' },
  { value: 'rest', label: '💤 休み' },
]

const MOODS = [
  { value: 'best',      emoji: '🤩', label: '最高！' },
  { value: 'good',      emoji: '😊', label: 'まあまあ' },
  { value: 'frustrate', emoji: '😤', label: 'くやしい' },
  { value: 'tired',     emoji: '😴', label: 'つかれた' },
  { value: 'moody',     emoji: '😶', label: 'モヤモヤ' },
]

export default function DailyRecord() {
  const { user, profile, isTrial } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const today = todayStr()

  const [isEdit, setIsEdit] = useState(false)
  const [practiceType, setPracticeType] = useState('team')
  const [myPlay, setMyPlay] = useState('')
  const [teammatePlay, setTeammatePlay] = useState('')
  const [concern, setConcern] = useState('')
  const [nextGoal, setNextGoal] = useState('')
  const [hitokoto, setHitokoto] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followUp, setFollowUp] = useState(null)

  // 折りたたみ管理（入力済みなら開く）
  const [openSections, setOpenSections] = useState({
    myPlay: false, teammatePlay: false, concern: false, nextGoal: false,
  })

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => { loadExisting() }, [user, isTrial])

  async function loadExisting() {
    try {
      if (isTrial) {
        const rec = getRecordByDate(today)
        if (rec) fillForm(rec)
        const allRecs = getAllRecords().filter(r => r.date < today && r.concern).sort((a, b) => b.date.localeCompare(a.date))
        if (allRecs.length > 0) setFollowUp(getFollowUpQuestion(allRecs[0].concern))
      } else if (user) {
        const q = query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '==', today))
        const snap = await getDocs(q)
        if (!snap.empty) fillForm(snap.docs[0].data())
        const prevQ = query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '>=', nDaysAgoStr(14)), where('date', '<', today), orderBy('date', 'desc'))
        const prevSnap = await getDocs(prevQ)
        for (const d of prevSnap.docs) {
          const data = d.data()
          if (data.concern) { setFollowUp(getFollowUpQuestion(data.concern)); break }
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function fillForm(d) {
    setIsEdit(true)
    setPracticeType(d.practiceType || 'team')
    setMyPlay(d.myPlay || '')
    setTeammatePlay(d.teammatePlay || '')
    setConcern(d.concern || '')
    setNextGoal(d.nextGoal || '')
    setHitokoto(d.hitokoto || '')
    setMood(d.mood || '')
    // 入力済みのセクションは開く
    setOpenSections({
      myPlay: !!d.myPlay,
      teammatePlay: !!d.teammatePlay,
      concern: !!d.concern,
      nextGoal: !!d.nextGoal,
    })
  }

  async function handleSave() {
    if (!mood) { showToast('今日の気分を選んでね！', 'warning'); return }
    setSaving(true)
    try {
      let totalMinutes = 0
      if (isTrial) {
        totalMinutes = getMenusByDate(today).reduce((s, m) => s + (m.minutes || 0), 0)
      } else if (user) {
        const mq = query(collection(db, 'trainingMenus'), where('uid', '==', user.uid), where('date', '==', today))
        const ms = await getDocs(mq)
        ms.forEach(d => { totalMinutes += d.data().minutes || 0 })
      }

      const record = {
        date: today, practiceType,
        myPlay: myPlay.trim(),
        teammatePlay: teammatePlay.trim(),
        concern: concern.trim(),
        nextGoal: nextGoal.trim(),
        hitokoto: hitokoto.trim(),
        mood, totalMinutes,
      }

      if (isTrial) {
        saveLocal(record)
      } else if (user) {
        const docId = `${user.uid}_${today}`
        await setDoc(doc(db, 'privateRecords', docId), {
          uid: user.uid, ...record,
          ...(isEdit ? {} : { createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        }, { merge: true })
        await setDoc(doc(db, 'publicSummaries', docId), {
          uid: user.uid,
          nickname: profile?.nickname || '',
          teamCode: profile?.teamCode || 'default',
          date: today, totalMinutes, practiceType, mood,
          hitokoto: hitokoto.trim(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
      setShowSuccess(true)
    } catch (e) {
      console.error(e)
      showToast('保存できませんでした。もう一度ためしてね。', 'error')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>
  }

  return (
    <div>
      <h2 className="page-title">📝 今日のふりかえり</h2>

      <div className="card" style={{ padding: '12px 16px' }}>
        <span className="font-bold text-sm">📅 {formatDateJP(today)}</span>
      </div>

      {/* 前回のモヤっとフォローアップ */}
      {followUp && (
        <div className="card card-highlight">
          <div className="card-title">💬 前回のつづき</div>
          <p className="text-sm text-primary" style={{ lineHeight: 1.6 }}>{followUp}</p>
        </div>
      )}

      {/* 練習の種類 */}
      <div className="card">
        <div className="card-title">今日の練習は？</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PRACTICE_TYPES.map(t => (
            <button key={t.value}
              className={`chip ${practiceType === t.value ? 'selected' : ''}`}
              onClick={() => setPracticeType(t.value)}
              style={{ borderRadius: 10, padding: '12px 8px', fontSize: '0.88rem', width: '100%' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 気分 — 3列レイアウト */}
      <div className="card">
        <div className="card-title">😊 今日の気分は？ <span className="text-xs text-danger">※ ひっす</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {MOODS.map(m => (
            <button key={m.value}
              className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
              onClick={() => setMood(m.value)}
              style={{ padding: '14px 8px' }}>
              <span className="mood-emoji" style={{ fontSize: '2.2rem' }}>{m.emoji}</span>
              <span className="mood-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 今日のひとこと（常に表示） */}
      <div className="card">
        <div className="card-title">💬 今日のひとこと</div>
        <textarea className="form-textarea" placeholder="例：明日もがんばるぞ！"
          value={hitokoto} onChange={e => setHitokoto(e.target.value)} maxLength={100} rows={1} />
        <p className="form-hint">※ ひとことはチームのみんなにも見えます</p>
      </div>

      {/* --- 折りたたみセクション --- */}
      <p className="text-xs text-hint mb-sm" style={{ marginTop: 4 }}>
        👇 かけたら書こう（書ける項目だけでOK！）
      </p>

      {/* 100点プレー */}
      <CollapsibleCard
        title="⭐ 今日の100点プレー"
        isOpen={openSections.myPlay}
        onToggle={() => toggleSection('myPlay')}
        hasContent={!!myPlay}
      >
        <textarea className="form-textarea" placeholder="例：ゴロをしっかり前に出て捕れた！"
          value={myPlay} onChange={e => setMyPlay(e.target.value)} maxLength={200} rows={2} />
        <p className="form-hint text-right">{myPlay.length}/200</p>
      </CollapsibleCard>

      {/* チームメイトのナイスプレー */}
      <CollapsibleCard
        title="👏 チームメイトのナイスプレー"
        isOpen={openSections.teammatePlay}
        onToggle={() => toggleSection('teammatePlay')}
        hasContent={!!teammatePlay}
      >
        <textarea className="form-textarea" placeholder="例：○○くんが難しいフライをとった！"
          value={teammatePlay} onChange={e => setTeammatePlay(e.target.value)} maxLength={200} rows={2} />
      </CollapsibleCard>

      {/* モヤっと */}
      <CollapsibleCard
        title="💭 モヤっとした場面"
        isOpen={openSections.concern}
        onToggle={() => toggleSection('concern')}
        hasContent={!!concern}
      >
        <textarea className="form-textarea" placeholder="例：バントがうまくいかなかった…"
          value={concern} onChange={e => setConcern(e.target.value)} maxLength={200} rows={2} />
      </CollapsibleCard>

      {/* 次にやること */}
      <CollapsibleCard
        title="🎯 次の練習でやること"
        isOpen={openSections.nextGoal}
        onToggle={() => toggleSection('nextGoal')}
        hasContent={!!nextGoal}
      >
        <textarea className="form-textarea" placeholder="例：バントの練習を10回する"
          value={nextGoal} onChange={e => setNextGoal(e.target.value)} maxLength={200} rows={2} />
      </CollapsibleCard>

      {/* 保存 */}
      <p className="text-sm text-hint text-center mb-sm">
        気分だけでも立派なきろくだよ
      </p>
      <button className="btn btn-success btn-lg mb-sm" onClick={handleSave} disabled={saving}>
        {saving ? '保存中...' : isEdit ? '✏️ 上書き保存する' : '✅ 今日の記録を保存！'}
      </button>

      <button className="btn btn-outline" onClick={() => navigate('/training')}>
        ⚾ 練習メニューも記録する →
      </button>

      {showSuccess && (
        <SuccessOverlay
          title={isEdit ? '上書き保存OK！' : 'きろく完了！'}
          message={isEdit ? '記録を更新したよ！' : 'すばらしい！今日もよくがんばった！'}
          onClose={() => { setShowSuccess(false); navigate('/') }}
        />
      )}
    </div>
  )
}

/** 折りたたみカードコンポーネント */
function CollapsibleCard({ title, isOpen, onToggle, hasContent, children }) {
  return (
    <div className="card" style={{ padding: isOpen ? undefined : '12px 20px', cursor: 'pointer' }}>
      <div className="flex-between" onClick={onToggle}>
        <div className="card-title" style={{ marginBottom: isOpen ? 12 : 0, fontSize: '0.9rem' }}>
          {title}
          {hasContent && !isOpen && (
            <span className="text-xs text-success" style={{ marginLeft: 6 }}>✅ 入力済み</span>
          )}
        </div>
        <span style={{
          fontSize: '1rem', color: 'var(--text-3)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>▼</span>
      </div>
      {isOpen && <div onClick={e => e.stopPropagation()}>{children}</div>}
    </div>
  )
}
