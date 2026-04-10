/**
 * きょうのふりかえり — メイン記録画面
 * 4つのコア項目（100点プレー、ナイスプレー、モヤっと、次の目標）が常時表示
 * 気分・練習種類はオプショナル（折りたたみ）
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, formatDateJP } from '../utils/dateUtils'
import { getRecordByDate, saveRecord as saveLocal, getAllRecords } from '../utils/localStore'
import SuccessOverlay from '../components/SuccessOverlay'
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
  const [practiceType, setPracticeType] = useState('')
  const [myPlay, setMyPlay] = useState('')
  const [nicePlay, setNicePlay] = useState('')
  const [concern, setConcern] = useState('')
  const [nextGoal, setNextGoal] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followUp, setFollowUp] = useState(null)

  // オプション折りたたみ
  const [showOptions, setShowOptions] = useState(false)

  useEffect(() => { loadExisting() }, [user, isTrial])

  async function loadExisting() {
    try {
      if (isTrial) {
        const rec = getRecordByDate(today)
        if (rec) fillForm(rec)
        const allRecs = getAllRecords().filter(r => r.date < today && r.concern).sort((a, b) => b.date.localeCompare(a.date))
        if (allRecs.length > 0) {
          const prev = allRecs[0].concern
          const short = prev.length > 50 ? prev.slice(0, 50) + '…' : prev
          setFollowUp(`前回「${short}」って書いたね。その後どうかな？`)
        }
      } else if (user) {
        const q = query(collection(db, 'dailyRecords'), where('uid', '==', user.uid), where('date', '==', today))
        const snap = await getDocs(q)
        if (!snap.empty) fillForm(snap.docs[0].data())
        const prevQ = query(collection(db, 'dailyRecords'), where('uid', '==', user.uid), where('date', '<', today))
        const prevSnap = await getDocs(prevQ)
        const prevRecs = prevSnap.docs.map(d => d.data()).sort((a, b) => b.date.localeCompare(a.date))
        for (const d of prevRecs) {
          if (d.concern) {
            const short = d.concern.length > 50 ? d.concern.slice(0, 50) + '…' : d.concern
            setFollowUp(`前回「${short}」って書いたね。その後どうかな？`)
            break
          }
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function fillForm(d) {
    setIsEdit(true)
    setPracticeType(d.practiceType || '')
    setMyPlay(d.myPlay || '')
    setNicePlay(d.nicePlay || d.teammatePlay || '')
    setConcern(d.concern || '')
    setNextGoal(d.nextGoal || '')
    setMood(d.mood || '')
    if (d.mood || d.practiceType) setShowOptions(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const record = {
        date: today,
        practiceType,
        myPlay: myPlay.trim(),
        nicePlay: nicePlay.trim(),
        concern: concern.trim(),
        nextGoal: nextGoal.trim(),
        mood,
      }

      if (isTrial) {
        saveLocal(record)
      } else if (user) {
        const docId = `${user.uid}_${today}`
        await setDoc(doc(db, 'dailyRecords', docId), {
          uid: user.uid, ...record,
          ...(isEdit ? {} : { createdAt: serverTimestamp() }),
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

  const hasCoreContent = myPlay || nicePlay || concern || nextGoal

  return (
    <div>
      <h2 className="page-title">📝 きょうのふりかえり</h2>

      <div style={{
        padding: '10px 16px', background: 'var(--surface)',
        borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-lg)',
      }}>
        <span className="font-bold text-sm">📅 {formatDateJP(today)}</span>
      </div>

      {/* 前回のモヤっとフォローアップ */}
      {followUp && (
        <div className="card card-highlight">
          <div className="card-title">💬 前回のつづき</div>
          <p className="text-sm text-primary" style={{ lineHeight: 1.6 }}>{followUp}</p>
        </div>
      )}

      {/* ===== 4つのコア項目（常時表示） ===== */}
      <div className="card">
        <div className="card-title">⭐ 今日の100点プレー</div>
        <textarea className="form-textarea" placeholder="例：ゴロをしっかり前に出て捕れた！"
          value={myPlay} onChange={e => setMyPlay(e.target.value)} maxLength={200} rows={2} />
        <p className="form-hint text-right">{myPlay.length}/200</p>
      </div>

      <div className="card">
        <div className="card-title">👏 ナイスプレー</div>
        <textarea className="form-textarea" placeholder="例：○○くんが難しいフライをとった！"
          value={nicePlay} onChange={e => setNicePlay(e.target.value)} maxLength={200} rows={2} />
      </div>

      <div className="card">
        <div className="card-title">💭 モヤっとした場面</div>
        <textarea className="form-textarea" placeholder="例：バントがうまくいかなかった…"
          value={concern} onChange={e => setConcern(e.target.value)} maxLength={200} rows={2} />
      </div>

      <div className="card">
        <div className="card-title">🎯 次の練習でやること</div>
        <textarea className="form-textarea" placeholder="例：バントの練習を10回する"
          value={nextGoal} onChange={e => setNextGoal(e.target.value)} maxLength={200} rows={2} />
      </div>

      {/* ===== オプション（気分・練習種類） ===== */}
      <div style={{ marginBottom: 'var(--sp-lg)' }}>
        <button onClick={() => setShowOptions(!showOptions)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', fontSize: '0.85rem', fontWeight: 600,
            color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 0',
          }}>
          <span style={{
            transform: showOptions ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s', display: 'inline-block',
          }}>▼</span>
          気分や練習の種類も記録する
          {(mood || practiceType) && !showOptions && (
            <span className="text-xs text-success" style={{ marginLeft: 4 }}>✅</span>
          )}
        </button>

        {showOptions && (
          <>
            {/* 気分 */}
            <div className="card" style={{ marginTop: 'var(--sp-sm)' }}>
              <div className="card-title">😊 今日の気分は？</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {MOODS.map(m => (
                  <button key={m.value}
                    className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
                    onClick={() => setMood(mood === m.value ? '' : m.value)}
                    style={{ padding: '14px 8px' }}>
                    <span className="mood-emoji" style={{ fontSize: '2.2rem' }}>{m.emoji}</span>
                    <span className="mood-label">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 練習の種類 */}
            <div className="card">
              <div className="card-title">今日の練習は？</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PRACTICE_TYPES.map(t => (
                  <button key={t.value}
                    className={`chip ${practiceType === t.value ? 'selected' : ''}`}
                    onClick={() => setPracticeType(practiceType === t.value ? '' : t.value)}
                    style={{ borderRadius: 10, padding: '12px 8px', fontSize: '0.88rem', width: '100%' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 保存 */}
      <p className="text-sm text-hint text-center mb-sm">
        何も書かない日があっても大丈夫。書けるときに書こう。
      </p>
      <button className="btn btn-primary btn-lg mb-sm" onClick={handleSave} disabled={saving}>
        {saving ? '保存中...' : isEdit ? '✏️ 上書き保存する' : '✅ きょうのきろくを保存！'}
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
