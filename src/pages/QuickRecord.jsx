/**
 * 30秒クイック入力モード
 * ステップ形式（1画面1質問）→ 認知負荷を最小化
 * 全てタップ操作 → テキスト入力ゼロで完了可能
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr } from '../utils/dateUtils'
import { getRecordByDate, saveRecord as saveLocal } from '../utils/localStore'
import { getSaveMessage } from '../utils/messages'
import { useToast } from '../contexts/ToastContext'

const MOODS = [
  { value: 'best',      emoji: '🤩', label: '最高！' },
  { value: 'good',      emoji: '😊', label: 'まあまあ' },
  { value: 'frustrate', emoji: '😤', label: 'くやしい' },
  { value: 'tired',     emoji: '😴', label: 'つかれた' },
  { value: 'moody',     emoji: '😶', label: 'モヤモヤ' },
]

const PRACTICE_TYPES = [
  { value: 'team', emoji: '⚾', label: 'チーム練習' },
  { value: 'self', emoji: '🏃', label: '自主練' },
  { value: 'game', emoji: '🏟️', label: '試合' },
  { value: 'rest', emoji: '💤', label: '休み' },
]

const QUICK_MENUS = [
  { key: 'swing',   label: '素振り' },
  { key: 'catch',   label: 'キャッチボール' },
  { key: 'ground',  label: 'ゴロ捕球' },
  { key: 'dash',    label: 'ダッシュ' },
  { key: 'stretch', label: 'ストレッチ' },
  { key: 'core',    label: '体幹' },
]

const MINUTES_PER_MENU = 10

export default function QuickRecord() {
  const { user, profile, isTrial } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const today = todayStr()

  const [step, setStep] = useState(1)
  const [mood, setMood] = useState('')
  const [practiceType, setPracticeType] = useState('')
  const [selectedMenus, setSelectedMenus] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const isRest = practiceType === 'rest'
  const totalSteps = isRest ? 2 : 3

  function toggleMenu(key) {
    setSelectedMenus(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function handlePracticeTypeSelect(value) {
    setPracticeType(value)
    if (value === 'rest') {
      // 休みの場合はステップ3をスキップして直接保存
      setSaving(true)
      saveRecord(value, []).then(() => {
        setSaving(false)
      })
    } else {
      setStep(3)
    }
  }

  async function saveRecord(pt, menus) {
    try {
      const estimatedMinutes = menus.length * MINUTES_PER_MENU
      const record = {
        date: today, mood, practiceType: pt,
        quickMenus: menus,
        isQuickEntry: true,
        totalMinutes: estimatedMinutes,
      }

      if (isTrial) {
        const existing = getRecordByDate(today) || {}
        saveLocal({ ...existing, ...record })
      } else if (user) {
        const docId = `${user.uid}_${today}`
        await setDoc(doc(db, 'privateRecords', docId), {
          uid: user.uid, ...record, updatedAt: serverTimestamp(),
        }, { merge: true })
        await setDoc(doc(db, 'publicSummaries', docId), {
          uid: user.uid,
          nickname: profile?.nickname || '',
          teamCode: profile?.teamCode || 'default',
          date: today, practiceType: pt, mood,
          totalMinutes: estimatedMinutes,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }

      if (pt === 'rest') {
        setSaveMsg('休むのも大事な練習だよ。明日また元気にがんばろう！')
      } else {
        setSaveMsg(getSaveMessage(mood))
      }
      setStep(4)
    } catch (e) {
      console.error(e)
      showToast('保存できませんでした', 'error')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveRecord(practiceType, selectedMenus)
    } finally { setSaving(false) }
  }

  // ===== ステップ1: 気分 =====
  if (step === 1) {
    return (
      <StepLayout step={1} total={3} title="今日の気分は？">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MOODS.map(m => (
            <button key={m.value} onClick={() => { setMood(m.value); setStep(2) }}
              className="card"
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', cursor: 'pointer',
                border: '1.5px solid var(--border)',
                transition: 'transform 0.1s',
              }}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '2.2rem' }}>{m.emoji}</span>
              <span className="font-extrabold" style={{ fontSize: '1.1rem' }}>{m.label}</span>
            </button>
          ))}
        </div>
      </StepLayout>
    )
  }

  // ===== ステップ2: 練習種類 =====
  if (step === 2) {
    return (
      <StepLayout step={2} total={3} title="今日は何をした？" onBack={() => setStep(1)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {PRACTICE_TYPES.map(t => (
            <button key={t.value}
              onClick={() => handlePracticeTypeSelect(t.value)}
              disabled={saving}
              className="card"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '24px 12px', cursor: saving ? 'wait' : 'pointer',
                borderColor: practiceType === t.value ? 'var(--primary)' : 'var(--border)',
                background: practiceType === t.value ? 'var(--primary-bg)' : 'var(--surface)',
                transition: 'transform 0.1s',
                opacity: saving ? 0.7 : 1,
              }}
            >
              <span style={{ fontSize: '2.2rem' }}>{t.emoji}</span>
              <span className="font-bold" style={{ fontSize: '1rem' }}>{t.label}</span>
            </button>
          ))}
        </div>
        {saving && (
          <p className="text-sm text-muted text-center mt-lg">保存中...</p>
        )}
      </StepLayout>
    )
  }

  // ===== ステップ3: やったメニュー（休み以外） =====
  if (step === 3) {
    return (
      <StepLayout step={3} total={3} title="何の練習をした？" onBack={() => setStep(2)}>
        <p className="text-sm text-muted mb-lg">
          やった練習をタップしてね（1つ{MINUTES_PER_MENU}分で計算するよ）
        </p>
        <div className="chip-grid mb-sm">
          {QUICK_MENUS.map(m => (
            <button key={m.key} onClick={() => toggleMenu(m.key)}
              className={`chip ${selectedMenus.includes(m.key) ? 'selected' : ''}`}
              style={{ padding: '12px 18px', fontSize: '0.95rem' }}>
              {m.label}
            </button>
          ))}
        </div>
        {selectedMenus.length > 0 && (
          <p className="text-sm text-primary font-bold mb-lg text-center">
            合計 約{selectedMenus.length * MINUTES_PER_MENU}分
          </p>
        )}

        <button onClick={handleSave} disabled={saving} className="btn btn-success btn-lg">
          {saving ? '保存中...' : '✅ 記録完了！'}
        </button>
      </StepLayout>
    )
  }

  // ===== ステップ4: 完了画面 =====
  const isRestComplete = practiceType === 'rest'
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: '4rem', animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {isRestComplete ? '😴' : mood === 'best' ? '🌟' : mood === 'frustrate' ? '💪' : '✅'}
      </div>
      <h2 className="font-extrabold" style={{ fontSize: '1.4rem', margin: '16px 0 8px' }}>
        {isRestComplete ? 'おつかれさま！' : '今日もえらい！'}
      </h2>
      <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: 24, lineHeight: 1.6, maxWidth: 280 }}>
        {saveMsg}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
        {isRestComplete ? (
          <>
            <button className="btn btn-outline" onClick={() => navigate('/record')}>
              📝 今日のきもちだけ書く
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              🏠 ホームに戻る
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-outline" onClick={() => navigate('/record')}>
              📝 もっとくわしく書く
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/training')}>
              ⚾ 練習時間も記録する
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              🏠 ホームに戻る
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StepLayout({ step, total, title, onBack, children }) {
  const progress = (step / total) * 100

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="flex-between mb-sm">
          {onBack ? (
            <button onClick={onBack} className="btn-ghost" style={{
              background: 'none', border: 'none', fontSize: '0.85rem',
              color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 600, padding: '4px 0',
            }}>
              ← もどる
            </button>
          ) : <span />}
          <span className="text-sm font-bold text-primary">{step}/{total}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <h2 className="page-title" style={{ marginBottom: 20 }}>{title}</h2>
      {children}
    </div>
  )
}
