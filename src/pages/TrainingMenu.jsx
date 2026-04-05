import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { todayStr } from '../utils/dateUtils'
import {
  getMenusByDate, addMenu as addLocal,
  deleteMenu as deleteLocal, getRecordByDate, saveRecord as saveLocalRec,
} from '../utils/localStore'

const MENU_LIST = [
  { value: 'swing',   label: '⚾ 素振り' },
  { value: 'tee',     label: '🏏 ティー' },
  { value: 'catch',   label: '🤝 キャッチボール' },
  { value: 'wall',    label: '🧱 壁当て' },
  { value: 'ground',  label: '⬇️ ゴロ捕球' },
  { value: 'fly',     label: '☁️ フライ捕球' },
  { value: 'dash',    label: '💨 ダッシュ' },
  { value: 'core',    label: '💪 体幹' },
  { value: 'stretch', label: '🧘 ストレッチ' },
  { value: 'other',   label: '📌 その他' },
]

const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

export default function TrainingMenu() {
  const { user, isTrial, profile } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const today = todayStr()

  const [items, setItems] = useState([])
  const [selectedMenu, setSelectedMenu] = useState('')
  const [selectedTime, setSelectedTime] = useState(10)
  const [saving, setSaving] = useState(false)
  const [miniSuccess, setMiniSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMenus() }, [user, isTrial])

  async function loadMenus() {
    try {
      if (isTrial) {
        setItems(getMenusByDate(today))
      } else if (user) {
        const q = query(collection(db, 'trainingMenus'), where('uid', '==', user.uid), where('date', '==', today))
        const snap = await getDocs(q)
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!selectedMenu) { showToast('練習の種類を選んでね！', 'warning'); return }
    setSaving(true)
    try {
      const menuLabel = MENU_LIST.find(m => m.value === selectedMenu)?.label || selectedMenu
      if (isTrial) {
        const m = { date: today, menuKey: selectedMenu, menuLabel, minutes: selectedTime }
        addLocal(m)
        const updated = getMenusByDate(today)
        setItems(updated)
        updateLocalTotal(updated)
      } else if (user) {
        const id = `${user.uid}_${today}_${Date.now()}`
        const newItem = {
          uid: user.uid, date: today,
          teamCode: profile?.teamCode || 'default',
          menuKey: selectedMenu, menuLabel, minutes: selectedTime,
          createdAt: serverTimestamp(),
        }
        await setDoc(doc(db, 'trainingMenus', id), newItem)
        const updated = [...items, { id, ...newItem }]
        setItems(updated)
        await updateFirestoreTotal(updated)
      }
      setSelectedMenu('')
      setMiniSuccess(true)
      setTimeout(() => setMiniSuccess(false), 1500)
    } catch (e) { console.error(e); showToast('保存できませんでした', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(itemId) {
    try {
      if (isTrial) {
        deleteLocal(itemId)
        const updated = getMenusByDate(today)
        setItems(updated)
        updateLocalTotal(updated)
      } else {
        await deleteDoc(doc(db, 'trainingMenus', itemId))
        const updated = items.filter(i => i.id !== itemId)
        setItems(updated)
        await updateFirestoreTotal(updated)
      }
    } catch (e) { console.error(e) }
  }

  function updateLocalTotal(menuItems) {
    const total = menuItems.reduce((s, i) => s + (i.minutes || 0), 0)
    const existing = getRecordByDate(today) || { date: today }
    saveLocalRec({ ...existing, totalMinutes: total })
  }

  async function updateFirestoreTotal(menuItems) {
    const total = menuItems.reduce((s, i) => s + (i.minutes || 0), 0)
    const docId = `${user.uid}_${today}`
    await setDoc(doc(db, 'privateRecords', docId), {
      uid: user.uid, date: today, totalMinutes: total, updatedAt: serverTimestamp(),
    }, { merge: true })
    await setDoc(doc(db, 'publicSummaries', docId), {
      uid: user.uid, nickname: profile?.nickname || '', teamCode: profile?.teamCode || 'default',
      date: today, totalMinutes: total, updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  const totalMinutes = items.reduce((s, i) => s + (i.minutes || 0), 0)

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div>
      <h2 className="page-title">⚾ 練習メニュー記録</h2>

      {/* 今日の合計 */}
      <div className="stat-card text-center mb-lg" style={{
        background: 'linear-gradient(135deg, var(--primary), #6366F1)',
        color: '#fff', border: 'none', padding: '20px 16px',
      }}>
        <p className="text-sm" style={{ opacity: 0.85 }}>今日の合計練習時間</p>
        <p className="font-extrabold" style={{ fontSize: '2.2rem', lineHeight: 1.2 }}>
          {totalMinutes}<span style={{ fontSize: '0.9rem' }}>分</span>
        </p>
        {totalMinutes >= 60 && (
          <p className="text-sm" style={{ marginTop: 4, opacity: 0.9 }}>🏅 1時間達成！すごい！</p>
        )}
      </div>

      {/* メニュー選択 */}
      <div className="card">
        <div className="card-title">➕ 練習を追加する</div>
        <div className="form-group">
          <label className="form-label">練習の種類</label>
          <div className="chip-grid">
            {MENU_LIST.map(m => (
              <button key={m.value}
                className={`chip ${selectedMenu === m.value ? 'selected' : ''}`}
                onClick={() => setSelectedMenu(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">時間</label>
          <div className="chip-grid">
            {TIME_OPTIONS.map(t => (
              <button key={t}
                className={`chip ${selectedTime === t ? 'selected' : ''}`}
                onClick={() => setSelectedTime(t)}
                style={{ minWidth: 56, textAlign: 'center' }}>
                {t}分
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !selectedMenu}>
          {saving ? '追加中...' : '＋ 追加する'}
        </button>
        {miniSuccess && (
          <div className="text-center mt-md text-success font-bold" style={{ animation: 'fadeIn 0.3s' }}>
            ✅ 追加したよ！
          </div>
        )}
      </div>

      {/* 今日の記録リスト */}
      <div className="card">
        <div className="card-title">📋 今日やった練習</div>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚾</div>
            <p>まだ記録がないよ</p>
            <p className="empty-hint">上から追加してみよう！</p>
          </div>
        ) : (
          <>
            {items.map(item => (
              <div key={item.id} className="training-item">
                <div className="menu-name">{item.menuLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="menu-time">{item.minutes}分</span>
                  <button className="delete-btn" onClick={() => handleDelete(item.id)} title="削除">🗑️</button>
                </div>
              </div>
            ))}
            <div className="flex-between mt-md" style={{
              padding: '10px 14px', background: 'var(--primary-bg)',
              borderRadius: 'var(--r-sm)', fontWeight: 700,
            }}>
              <span>合計</span>
              <span className="text-primary">{totalMinutes}分</span>
            </div>
          </>
        )}
      </div>

      <button className="btn btn-outline mb-sm" onClick={() => navigate('/record')}>
        📝 ふりかえりも書く →
      </button>
      <button className="btn btn-success" onClick={() => navigate('/')}>
        🏠 ホームに戻る
      </button>
    </div>
  )
}
