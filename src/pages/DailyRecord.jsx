import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, formatDateJP } from '../utils/dateUtils'
import {
  getRecordByDate, saveRecord as saveLocal,
  getMenusByDate,
} from '../utils/localStore'
import SuccessOverlay from '../components/SuccessOverlay'

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

  useEffect(() => { loadExisting() }, [user, isTrial])

  async function loadExisting() {
    try {
      if (isTrial) {
        const rec = getRecordByDate(today)
        if (rec) fillForm(rec)
      } else if (user) {
        const q = query(collection(db, 'privateRecords'), where('uid', '==', user.uid), where('date', '==', today))
        const snap = await getDocs(q)
        if (!snap.empty) fillForm(snap.docs[0].data())
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
  }

  async function handleSave() {
    if (!mood) { alert('今日の気分を選んでね！'); return }
    setSaving(true)
    try {
      // 練習時間の合計を取得
      let totalMinutes = 0
      if (isTrial) {
        totalMinutes = getMenusByDate(today).reduce((s, m) => s + (m.minutes || 0), 0)
      } else if (user) {
        const mq = query(collection(db, 'trainingMenus'), where('uid', '==', user.uid), where('date', '==', today))
        const ms = await getDocs(mq)
        ms.forEach(d => { totalMinutes += d.data().minutes || 0 })
      }

      const record = {
        date: today,
        practiceType,
        myPlay: myPlay.trim(),
        teammatePlay: teammatePlay.trim(),
        concern: concern.trim(),
        nextGoal: nextGoal.trim(),
        hitokoto: hitokoto.trim(),
        mood,
        totalMinutes,
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
        // 公開要約も同時更新
        await setDoc(doc(db, 'publicSummaries', docId), {
          uid: user.uid,
          nickname: profile?.nickname || '',
          teamCode: profile?.teamCode || 'default',
          date: today,
          totalMinutes,
          practiceType,
          mood,
          hitokoto: hitokoto.trim(),
          nextGoal: nextGoal.trim(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
      setShowSuccess(true)
    } catch (e) {
      console.error(e)
      alert('保存できませんでした。もう一度ためしてね。')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>
      <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
    </div>
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
        📝 今日のふりかえり
      </h2>

      <div className="card" style={{ padding: '12px 16px' }}>
        <span style={{ fontWeight: 700, color: '#374151' }}>📅 {formatDateJP(today)}</span>
      </div>

      {/* 練習の種類 */}
      <div className="card">
        <div className="card-title">今日の練習は？</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PRACTICE_TYPES.map(t => (
            <button key={t.value}
              className={`menu-chip ${practiceType === t.value ? 'selected' : ''}`}
              onClick={() => setPracticeType(t.value)}
              style={{ borderRadius: 10, padding: '12px 8px', fontSize: '0.9rem' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 気分 */}
      <div className="card">
        <div className="card-title">😊 今日の気分は？</div>
        <div className="mood-grid">
          {MOODS.map(m => (
            <button key={m.value}
              className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
              onClick={() => setMood(m.value)}>
              <span className="mood-emoji">{m.emoji}</span>
              <span className="mood-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 100点プレー */}
      <div className="card">
        <div className="card-title">⭐ 今日の自分の100点プレー</div>
        <textarea className="form-textarea" placeholder="例：ゴロをしっかり前に出て捕れた！"
          value={myPlay} onChange={e => setMyPlay(e.target.value)} maxLength={200} rows={2} />
        <Counter current={myPlay.length} max={200} />
      </div>

      {/* チームメイトのナイスプレー */}
      <div className="card">
        <div className="card-title">👏 チームメイトのナイスプレー</div>
        <textarea className="form-textarea" placeholder="例：○○くんが難しいフライをとった！"
          value={teammatePlay} onChange={e => setTeammatePlay(e.target.value)} maxLength={200} rows={2} />
      </div>

      {/* モヤっと */}
      <div className="card">
        <div className="card-title">💭 モヤっとした場面（あれば）</div>
        <textarea className="form-textarea" placeholder="例：バントがうまくいかなかった…"
          value={concern} onChange={e => setConcern(e.target.value)} maxLength={200} rows={2} />
      </div>

      {/* 次にやること */}
      <div className="card">
        <div className="card-title">🎯 次の練習でやること</div>
        <textarea className="form-textarea" placeholder="例：バントの練習を10回する"
          value={nextGoal} onChange={e => setNextGoal(e.target.value)} maxLength={200} rows={2} />
      </div>

      {/* 今日のひとこと */}
      <div className="card">
        <div className="card-title">💬 今日のひとこと</div>
        <textarea className="form-textarea" placeholder="例：明日もがんばるぞ！"
          value={hitokoto} onChange={e => setHitokoto(e.target.value)} maxLength={100} rows={1} />
        <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>
          ※ ひとことはチームのみんなにも見えます
        </p>
      </div>

      {/* 保存 */}
      <button className="btn btn-success" onClick={handleSave} disabled={saving}
        style={{ fontSize: '1.1rem', marginBottom: 8 }}>
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

function Counter({ current, max }) {
  return <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'right' }}>{current}/{max}</p>
}
