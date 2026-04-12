/**
 * きょうのふりかえり — メイン記録画面
 * 4つのコア項目を1つの流れで軽く書ける構成
 * 気分・練習種類・練習メモはオプショナル
 *
 * 【下書き機能】
 * - 入力途中で他ページに移動しても、戻ってきたときに内容が復元される
 * - キー: nobi_draft_{today} (localStore.js の getDraft/saveDraft/clearDraft)
 * - 保存完了（handleSave 成功）時に下書きを消去する
 * - 保存済みレコードが既にある日は、下書きより保存済みデータを優先する
 * - おためし／会員どちらも同じ下書きキーを使う
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr, formatDateJP, nDaysAgoStr } from '../utils/dateUtils'
import { getRecordByDate, saveRecord as saveLocal, getAllRecords, getDraft, saveDraft, clearDraft } from '../utils/localStore'
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

  // 下書き自動保存用：初期ロード完了後だけ保存するためのフラグ
  const isLoadedRef = useRef(false)

  // ----- 初期ロード -----
  useEffect(() => { loadExisting() }, [user, isTrial])

  async function loadExisting() {
    try {
      if (isTrial) {
        const rec = getRecordByDate(today)
        if (rec) {
          // 保存済みレコードがあればそちらを優先
          fillForm(rec)
          clearDraft(today) // 保存済みがあれば下書きは不要
        } else {
          // 保存済みがなければ下書きを復元
          const draft = getDraft(today)
          if (draft) fillFormFromDraft(draft)
        }
        const allRecs = getAllRecords().filter(r => r.date < today && r.concern).sort((a, b) => b.date.localeCompare(a.date))
        if (allRecs.length > 0) {
          const prev = allRecs[0].concern
          const short = prev.length > 40 ? prev.slice(0, 40) + '…' : prev
          setFollowUp(`前回「${short}」って書いたね。その後どうかな？`)
        }
      } else if (user) {
        const q = query(collection(db, 'dailyRecords'), where('uid', '==', user.uid), where('date', '==', today))
        const snap = await getDocs(q)
        if (!snap.empty) {
          // 保存済みレコードがあればそちらを優先
          fillForm(snap.docs[0].data())
          clearDraft(today)
        } else {
          // 保存済みがなければ下書きを復元
          const draft = getDraft(today)
          if (draft) fillFormFromDraft(draft)
        }
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
    finally {
      setLoading(false)
      // ロード完了後から下書き自動保存を有効にする。
      // setTimeout(0) で1タスク遅らせることで、同一マウント時に autosave effect が
      // 空値（初期 state）で下書きを上書きするバグを防ぐ。
      // （React は useEffect を宣言順に実行するため、loadExisting が isLoadedRef を
      //   同期セットすると、直後の autosave effect が commit 前の空 state で保存してしまう）
      setTimeout(() => { isLoadedRef.current = true }, 0)
    }
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

  /** 下書きから復元（isEdit は立てない） */
  function fillFormFromDraft(d) {
    setPracticeType(d.practiceType || '')
    setPracticeMemo(d.practiceMemo || '')
    setMyPlay(d.myPlay || '')
    setNicePlay(d.nicePlay || '')
    setConcern(d.concern || '')
    setNextGoal(d.nextGoal || '')
    setMood(d.mood || '')
    if (d.mood || d.practiceType || d.practiceMemo) setShowOptions(true)
  }

  // ----- 下書き自動保存 -----
  // いずれかの入力値が変わったら debounce なしで即保存
  // （navigateは即座に起きるため、debounce を挟むと間に合わない）
  useEffect(() => {
    if (!isLoadedRef.current) return
    saveDraft(today, { practiceType, practiceMemo, myPlay, nicePlay, concern, nextGoal, mood })
  }, [practiceType, practiceMemo, myPlay, nicePlay, concern, nextGoal, mood])

  // ----- 保存処理 -----
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

      // 保存完了後に下書きを消去
      clearDraft(today)

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
        <div aria-live="polite" style={{
          padding: '10px 14px', background: 'var(--primary-bg)',
          borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-lg)',
          fontSize: '0.86rem', color: 'var(--primary-dark)', lineHeight: 1.6,
        }}>
          <span aria-hidden="true">💬 </span>{followUp}
        </div>
      )}

      {/* ===== 4つのコア項目 ===== */}
      <div className="card" style={{ padding: 'var(--sp-lg)' }}>
        {/* 気分（カード冒頭・軽量） */}
        <fieldset style={{ border: 'none', padding: 0, marginBottom: 'var(--sp-md)' }}>
          <legend className="record-label" style={{ marginBottom: 6 }}>
            <span className="record-icon" aria-hidden="true">😊</span>
            今日の気分
          </legend>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="気分を選ぶ">
            {MOODS.map(m => (
              <button key={m.value}
                className={`mood-chip ${mood === m.value ? 'selected' : ''}`}
                onClick={() => setMood(mood === m.value ? '' : m.value)}
                aria-pressed={mood === m.value}>
                <span aria-hidden="true">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="record-divider" role="separator" />

        {/* 100点プレー */}
        <div className="record-field">
          <label className="record-label" htmlFor="rec-myplay">
            <span className="record-icon" aria-hidden="true">⭐</span>
            今日の100点プレー
          </label>
          <textarea id="rec-myplay" className="form-textarea" placeholder="例：ゴロを前に出てしっかり捕れた"
            value={myPlay} onChange={e => setMyPlay(e.target.value)}
            maxLength={200} rows={2}
            style={{ minHeight: 56 }} />
        </div>

        <div className="record-divider" role="separator" />

        {/* 友達のナイスプレー */}
        <div className="record-field">
          <label className="record-label" htmlFor="rec-niceplay">
            <span className="record-icon" aria-hidden="true">👏</span>
            友達のナイスプレー
          </label>
          <textarea id="rec-niceplay" className="form-textarea" placeholder="例：○○くんが難しいフライをとった"
            value={nicePlay} onChange={e => setNicePlay(e.target.value)}
            maxLength={200} rows={2}
            style={{ minHeight: 56 }} />
        </div>

        <div className="record-divider" role="separator" />

        {/* モヤっと */}
        <div className="record-field">
          <label className="record-label" htmlFor="rec-concern">
            <span className="record-icon" aria-hidden="true">💭</span>
            モヤっとしたこと
          </label>
          <textarea id="rec-concern" className="form-textarea" placeholder="例：バントがうまくいかなかった"
            value={concern} onChange={e => setConcern(e.target.value)}
            maxLength={200} rows={2}
            style={{ minHeight: 56 }} />
        </div>

        <div className="record-divider" role="separator" />

        {/* 次の目標 */}
        <div className="record-field">
          <label className="record-label" htmlFor="rec-nextgoal">
            <span className="record-icon" aria-hidden="true">🎯</span>
            次やること・がんばること
          </label>
          <textarea id="rec-nextgoal" className="form-textarea" placeholder="例：バントの練習を10回する"
            value={nextGoal} onChange={e => setNextGoal(e.target.value)}
            maxLength={200} rows={2}
            style={{ minHeight: 56 }} />
        </div>
      </div>

      <p className="text-xs text-hint text-center" style={{ marginBottom: 12 }}>
        全部書かなくてOK！書けるところだけで大丈夫。
      </p>

      {/* ===== オプション（練習内容） ===== */}
      <button onClick={() => setShowOptions(!showOptions)}
        className="options-toggle"
        aria-expanded={showOptions}>
        <span className="options-arrow" aria-hidden="true" style={{
          transform: showOptions ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
        練習したこともメモする（任意）
        {(practiceType || practiceMemo) && !showOptions && (
          <span className="text-xs text-success" style={{ marginLeft: 6 }}>入力済み</span>
        )}
      </button>

      {showOptions && (
        <div className="card" style={{ marginTop: 8, padding: 'var(--sp-lg)' }}>
          {/* 練習の種類 */}
          <fieldset style={{ border: 'none', padding: 0 }} className="record-field">
            <legend className="record-label">
              <span className="record-icon" aria-hidden="true">⚾</span>
              練習の種類
            </legend>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="練習の種類を選ぶ">
              {PRACTICE_TYPES.map(t => (
                <button key={t.value}
                  className={`chip ${practiceType === t.value ? 'selected' : ''}`}
                  onClick={() => setPracticeType(practiceType === t.value ? '' : t.value)}
                  aria-pressed={practiceType === t.value}
                  style={{ borderRadius: 'var(--r-full)' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="record-divider" role="separator" />

          {/* 練習メモ */}
          <div className="record-field">
            <label className="record-label" htmlFor="rec-practicememo">
              <span className="record-icon" aria-hidden="true">📋</span>
              やったこと
            </label>
            <input id="rec-practicememo" className="form-input" type="text"
              placeholder="例：素振り10分、キャッチボール15分"
              value={practiceMemo} onChange={e => setPracticeMemo(e.target.value)}
              maxLength={100} />
            <p className="form-hint">素振り10分、キャッチボール15分 みたいに書けるよ</p>
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
