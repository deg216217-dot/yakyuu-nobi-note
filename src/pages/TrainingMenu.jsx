import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
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
    if (!selectedMenu) { alert('練習の種類を選んでね！'); return }
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
    } catch (e) { console.error(e); alert('保存できませんでした') }
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

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>
    <div className="spinner" style={{ margin: '0 auto', borderColor: '#e5e7eb', borderTopColor: '#2563eb' }} />
  </div>

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1a3a5c', marginBottom: 16 }}>
        ⚾ 練習メニュー記録
      </h2>

      {/* 今日の合計 */}
      <div style={{
        background: 'linear-gradient(135deg, #1a3a5c, #2563eb)',
        borderRadius: 12, padding: 16, color: '#fff', textAlign: 'center', marginBottom: 16,
      }}>
        <p style={{ fontSize: '0.85rem', opacity: 0.85 }}>今日の合計練習時間</p>
        <p style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.2 }}>
          {totalMinutes}<span style={{ fontSize: '1rem' }}>分</span>
        </p>
        {totalMinutes >= 60 && (
          <p style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.9 }}>🏅 1時間達成！すごい！</p>
        )}
      </div>

      {/* メニュー選択 */}
      <div className="card">
        <div className="card-title">➕ 練習を追加する</div>
        <div className="form-group">
          <label className="form-label">練習の種類</label>
          <div className="menu-chips">
            {MENU_LIST.map(m => (
              <button key={m.value}
                className={`menu-chip ${selectedMenu === m.value ? 'selected' : ''}`}
                onClick={() => setSelectedMenu(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">時間</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TIME_OPTIONS.map(t => (
              <button key={t}
                className={`menu-chip ${selectedTime === t ? 'selected' : ''}`}
                onClick={() => setSelectedTime(t)}
                style={{ minWidth: 60, textAlign: 'center' }}>
                {t}分
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !selectedMenu}>
          {saving ? '追加中...' : '＋ 追加する'}
        </button>
        {miniSuccess && (
          <div style={{ textAlign: 'center', padding: 10, color: '#16a34a', fontWeight: 900, fontSize: '1.1rem', animation: 'fadeIn 0.3s' }}>
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
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>上から追加してみよう！</p>
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
            <div style={{
              marginTop: 12, padding: '10px 12px', background: '#e0f2fe', borderRadius: 10,
              display: 'flex', justifyContent: 'space-between', fontWeight: 700,
            }}>
              <span>合計</span>
              <span style={{ color: '#1d4ed8' }}>{totalMinutes}分</span>
            </div>
          </>
        )}
      </div>

      <button className="btn btn-outline" onClick={() => navigate('/record')} style={{ marginBottom: 8 }}>
        📝 ふりかえりも書く →
      </button>
      <button className="btn btn-success" onClick={() => navigate('/')}>
        🏠 ホームに戻る
      </button>
    </div>
  )
}
