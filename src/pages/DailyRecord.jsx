import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

const PRACTICE_TYPES = [
  { value: 'team',  label: '⚾ チーム練習' },
  { value: 'self',  label: '🏃 自主練' },
  { value: 'game',  label: '🏟️ 試合' },
  { value: 'rest',  label: '💤 休み' },
]

const MOODS = [
  { value: 'best',      emoji: '🤩', label: '最高！' },
  { value: 'good',      emoji: '😊', label: 'まあまあ' },
  { value: 'frustrate', emoji: '😤', label: 'くやしい' },
  { value: 'tired',     emoji: '😴', label: 'つかれた' },
  { value: 'moody',     emoji: '😶', label: 'モヤモヤ' },
]

export default function DailyRecord() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const today = todayStr()

  const [existingDocId, setExistingDocId] = useState(null)
  const [practiceType, setPracticeType] = useState('team')
  const [myPlay, setMyPlay] = useState('')
  const [teammatePlay, setTeammatePlay] = useState('')
  const [concern, setConcern] = useState('')
  const [nextGoal, setNextGoal] = useState('')
  const [mood, setMood] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // 既存の今日の記録を読み込む
  useEffect(() => {
    if (!user) return
    loadTodayRecord()
  }, [user])

  async function loadTodayRecord() {
    try {
      const q = query(
        collection(db, 'dailyRecords'),
        where('uid', '==', user.uid),
        where('date', '==', today)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        const d = snap.docs[0]
        const data = d.data()
        setExistingDocId(d.id)
        setPracticeType(data.practiceType || 'team')
        setMyPlay(data.myPlay || '')
        setTeammatePlay(data.teammatePlay || '')
        setConcern(data.concern || '')
        setNextGoal(data.nextGoal || '')
        setMood(data.mood || '')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!mood) {
      alert('今日の気分を選んでね！')
      return
    }
    setSaving(true)
    try {
      const docId = existingDocId || `${user.uid}_${today}`
      const data = {
        uid: user.uid,
        nickname: profile?.nickname || '',
        teamCode: profile?.teamCode || 'default',
        date: today,
        practiceType,
        myPlay: myPlay.trim(),
        teammatePlay: teammatePlay.trim(),
        concern: concern.trim(),
        nextGoal: nextGoal.trim(),
        mood,
        totalMinutes: 0, // TrainingMenu で更新
        updatedAt: serverTimestamp(),
      }
      if (!existingDocId) {
        data.createdAt = serverTimestamp()
      }
      await setDoc(doc(db, 'dailyRecords', docId), data, { merge: true })
      setExistingDocId(docId)
      setShowSuccess(true)
    } catch (e) {
      console.error(e)
      alert('保存できませんでした。もう一度試してください。')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
        📝 今日のふりかえり
      </h2>

      {/* 日付 */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <span style={{ fontWeight: 700, color: '#374151' }}>📅 {formatDateJP(today)}</span>
      </div>

      {/* 練習の種類 */}
      <div className="card">
        <div className="card-title">今日の練習は？</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PRACTICE_TYPES.map(t => (
            <button
              key={t.value}
              className={`menu-chip ${practiceType === t.value ? 'selected' : ''}`}
              onClick={() => setPracticeType(t.value)}
              style={{ borderRadius: 10, padding: '12px 8px', fontSize: '0.9rem' }}
            >
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
            <button
              key={m.value}
              className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
              onClick={() => setMood(m.value)}
            >
              <span className="mood-emoji">{m.emoji}</span>
              <span className="mood-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 100点プレー */}
      <div className="card">
        <div className="card-title">⭐ 今日の自分の100点プレー</div>
        <textarea
          className="form-textarea"
          placeholder="例：ゴロをしっかり前に出て捕れた！"
          value={myPlay}
          onChange={e => setMyPlay(e.target.value)}
          maxLength={200}
          rows={3}
        />
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right' }}>
          {myPlay.length}/200
        </p>
      </div>

      {/* チームメイトのナイスプレー */}
      <div className="card">
        <div className="card-title">👏 チームメイトのナイスプレー</div>
        <textarea
          className="form-textarea"
          placeholder="例：○○くんが難しいフライをとった！"
          value={teammatePlay}
          onChange={e => setTeammatePlay(e.target.value)}
          maxLength={200}
          rows={3}
        />
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'right' }}>
          {teammatePlay.length}/200
        </p>
      </div>

      {/* モヤっとした場面 */}
      <div className="card">
        <div className="card-title">💭 モヤっとした場面（あれば）</div>
        <textarea
          className="form-textarea"
          placeholder="例：バントがうまくいかなかった…"
          value={concern}
          onChange={e => setConcern(e.target.value)}
          maxLength={200}
          rows={3}
        />
      </div>

      {/* 次にやること */}
      <div className="card">
        <div className="card-title">🎯 次の練習でやること</div>
        <textarea
          className="form-textarea"
          placeholder="例：バントの練習を10回する"
          value={nextGoal}
          onChange={e => setNextGoal(e.target.value)}
          maxLength={200}
          rows={3}
        />
      </div>

      {/* 保存ボタン */}
      <button
        className="btn btn-success"
        onClick={handleSave}
        disabled={saving}
        style={{ fontSize: '1.1rem', marginBottom: 8 }}
      >
        {saving ? '保存中...' : existingDocId ? '✏️ 上書き保存する' : '✅ 今日の記録を保存！'}
      </button>

      <button
        className="btn btn-outline"
        onClick={() => navigate('/training')}
      >
        ⚾ 練習メニューも記録する →
      </button>

      {/* 達成演出 */}
      {showSuccess && (
        <SuccessOverlay
          isNew={!existingDocId}
          onClose={() => {
            setShowSuccess(false)
            navigate('/')
          }}
        />
      )}
    </div>
  )
}

function SuccessOverlay({ isNew, onClose }) {
  return (
    <div className="success-overlay" onClick={onClose}>
      <div className="success-card" onClick={e => e.stopPropagation()}>
        <div className="success-icon">{isNew ? '🎉' : '✅'}</div>
        <h2>{isNew ? 'きろく完了！' : '上書き保存OK！'}</h2>
        <p style={{ marginBottom: 20 }}>
          {isNew
            ? 'すばらしい！今日もよくがんばった！'
            : '記録を更新したよ！'}
        </p>
        <button className="btn btn-primary btn-sm" style={{ width: 'auto', padding: '10px 32px' }} onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  )
}

function formatDateJP(str) {
  const [y, m, d] = str.split('-')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const dt = new Date(+y, +m - 1, +d)
  return `${+y}年${+m}月${+d}日（${days[dt.getDay()]}）`
}
