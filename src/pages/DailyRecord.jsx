/**
 * きょうのふりかえり — メイン記録画面
 * 4つのコア項目を1つの流れで軽く書ける構成
 * 気分・練習種類・練習メモはオプショナル
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, formatDateJP, nDaysAgoStr } from '../utils/dateUtils'
import { getRecordByDate, saveRecord as saveLocal, getAllRecords } from '../utils/localStore'
import SuccessOverlay from '../components/SuccessOverlay'
import { useToast } from '../contexts/ToastContext'
import { getSaveMessage } from '../utils/saveMessages'

const PRACTICE_TYPES = [
  { value: 'team', label: 'チーム練習' },
  { value: 'self', label: '自主練' },
  { value: 'game', label: '試合' },
  { value: 'rest', label: '休み' },
]

const MOODS = [
  { value: 'best',      emoji: '🤩', label: '最高！' },
  { value: 'good',      emoji: '😊', label: 'いい感じ' },
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
  const [practiceMemo, setPracticeMemo] = useState('')
  const [myPlay, setMyPlay] = useState('')
  const [nicePlay, setNicePlay] = useState('')
  const [concern, setConcern] = useState('')
  const [nextGoal, setNextGoal] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [followUp, setFollowUp] = useState(null)

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
          const short = prev.length > 40 ? prev.slice(0, 40) + '…' : prev
          setFollowUp(`前回「${short}」って書いたね。その後どうかな？`)
        }
      } else if (user) {
        const q = query(collection(db, 'dailyRecords'), where('uid', '==', user.uid), where('date', '==', today))
        const snap = await getDocs(q)
        if (!snap.empty) fillForm(snap.docs[0].data())
        const fromDate = nDaysAgoStr(30)
        const prevQ = query(collection(db, 'dailyRecords'), where('uid', '==', user.uid), where('date', '>=', fromDate), where('date', '<', today))
        const prevSnap = await getDocs(prevQ)
        const prevRecs = prevSnap.docs.map(d => d.data()).sort((a, b) => b.date.localeCompare(a.date))
        for (const d of prevRecs) {
          if (d.concern) {
            const short = d.concern.length > 40 ? d.concern.slice(0, 40) + '…' : d.concern
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
    setPracticeMemo(d.practiceMemo || '')
    setMyPlay(d.myPlay || '')
    setNicePlay(d.nicePlay || d.teammatePlay || '')
    setConcern(d.concern || '')
    setNextGoal(d.nextGoal || '')
    setMood(d.mood || '')
    if (d.mood || d.practiceType || d.practiceMemo) setShowOptions(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const record = {
        date: today, practiceType, practiceMemo: practiceMemo.trim(),
        myPlay: myPlay.trim(), nicePlay: nicePlay.trim(),
        concern: concern.trim(), nextGoal: nextGoal.trim(), mood,
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
      setSuccessMsg(getSaveMessage(mood, { myPlay: myPlay.trim(), concern: concern.trim(), nextGoal: nextGoal.trim() }))
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
      <h2 className="page-title">きょうのふりかえり</h2>
      <p className="page-subtitle">{formatDateJP(today)}</p>

      {/* 前回のモヤっとフォローアップ */}
      {followUp && (
        <div style={{
          padding: '12px 16px', background: 'var(--primary-bg)',
          borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-lg)',
          fontSize: '0.82rem', color: 'var(--primary-dark)', lineHeight: 1.6,
        }}>
          💬 {followUp}
        </div>
      )}

      {/* ===== 4つのコア項目（1枚のカードに統合） ===== */}
      <div className="card">
        {/* 100点プレー */}
        <div className="record-field">
          <label className="record-label">
            <span className="record-icon">⭐</span>
            今日の100点プレー
          </label>
          <textarea className="form-textarea" placeholder="ゴロをしっかり前に出て捕れた！"
            value={myPlay} onChange={e => setMyPlay(e.target.value)} maxLength={200} rows={2} />
        </div>

        <div className="record-divider" />

        {/* 友達のナイスプレー */}
        <div className="record-field">
          <label className="record-label">
            <span className="record-icon">👏</span>
            友達のナイスプレー
          </label>
          <textarea className="form-textarea" placeholder="○○くんが難しいフライをとった！"
            value={nicePlay} onChange={e => setNicePlay(e.target.value)} maxLength={200} rows={2} />
        </div>

        <div className="record-divider" />

        {/* モヤっと */}
        <div className="record-field">
          <label className="record-label">
            <span className="record-icon">💭</span>
            モヤっとしたこと
          </label>
          <textarea className="form-textarea" placeholder="バントがうまくいかなかった…"
            value={concern} onChange={e => setConcern(e.target.value)} maxLength={200} rows={2} />
        </div>

        <div className="record-divider" />

        {/* 次の目標 */}
        <div className="record-field">
          <label className="record-label">
            <span className="record-icon">🎯</span>
            次やること・がんばること
          </label>
          <textarea className="form-textarea" placeholder="バントの練習を10回する"
            value={nextGoal} onChange={e => setNextGoal(e.target.value)} maxLength={200} rows={2} />
        </div>
      </div>

      <p className="text-xs text-hint text-center" style={{ marginBottom: 12 }}>
        全部書かなくてOK。書けるところだけで大丈夫！
      </p>

      {/* ===== オプション ===== */}
      <button onClick={() => setShowOptions(!showOptions)}
        className="options-toggle">
        <span className="options-arrow" style={{
          transform: showOptions ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
        もっと記録する（気分・練習内容）
        {(mood || practiceType || practiceMemo) && !showOptions && (
          <span className="text-xs text-success" style={{ marginLeft: 6 }}>入力済み</span>
        )}
      </button>

      {showOptions && (
        <div className="card" style={{ marginTop: 8 }}>
          {/* 気分 */}
          <div className="record-field">
            <label className="record-label">
              <span className="record-icon">😊</span>
              今日の気分
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MOODS.map(m => (
                <button key={m.value}
                  className={`mood-chip ${mood === m.value ? 'selected' : ''}`}
                  onClick={() => setMood(mood === m.value ? '' : m.value)}>
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="record-divider" />

          {/* 練習の種類 */}
          <div className="record-field">
            <label className="record-label">
              <span className="record-icon">⚾</span>
              練習の種類
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRACTICE_TYPES.map(t => (
                <button key={t.value}
                  className={`chip ${practiceType === t.value ? 'selected' : ''}`}
                  onClick={() => setPracticeType(practiceType === t.value ? '' : t.value)}
                  style={{ borderRadius: 'var(--r-full)' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="record-divider" />

          {/* 練習メモ */}
          <div className="record-field">
            <label className="record-label">
              <span className="record-icon">📋</span>
              練習メモ（自由）
            </label>
            <input className="form-input" type="text"
              placeholder="例：素振り50回、ノック20球"
              value={practiceMemo} onChange={e => setPracticeMemo(e.target.value)}
              maxLength={100} />
          </div>
        </div>
      )}

      {/* 保存 */}
      <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}
        style={{ marginTop: 'var(--sp-lg)', marginBottom: 'var(--sp-md)' }}>
        {saving ? '保存中...' : isEdit ? '上書き保存する' : 'きょうのきろくを保存！'}
      </button>

      {showSuccess && (
        <SuccessOverlay
          title={isEdit ? '更新できたよ！' : 'きろく完了！'}
          message={successMsg}
          onClose={() => { setShowSuccess(false); navigate('/') }}
        />
      )}
    </div>
  )
}
