import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, getDocs,
  doc, setDoc, updateDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

const MENU_LIST = [
  { value: 'swing',    label: '⚾ 素振り' },
  { value: 'tee',      label: '🏏 ティー' },
  { value: 'catch',    label: '🤝 キャッチボール' },
  { value: 'wall',     label: '🧱 壁当て' },
  { value: 'ground',   label: '⬇️ ゴロ捕球' },
  { value: 'fly',      label: '☁️ フライ捕球' },
  { value: 'dash',     label: '💨 ダッシュ' },
  { value: 'core',     label: '💪 体幹' },
  { value: 'stretch',  label: '🧘 ストレッチ' },
  { value: 'other',    label: '📌 その他' },
]

const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

export default function TrainingMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayStr()

  const [items, setItems] = useState([])      // 今日追加済みのメニュー
  const [selectedMenu, setSelectedMenu] = useState('')
  const [selectedTime, setSelectedTime] = useState(10)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  // 今日の練習メニューをロード
  useEffect(() => {
    if (!user) return
    loadMenus()
  }, [user])

  async function loadMenus() {
    try {
      const q = query(
        collection(db, 'trainingMenus'),
        where('uid', '==', user.uid),
        where('date', '==', today)
      )
      const snap = await getDocs(q)
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setItems(loaded)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // メニューを追加
  async function handleAdd() {
    if (!selectedMenu) {
      alert('練習の種類を選んでね！')
      return
    }
    setSaving(true)
    try {
      const id = `${user.uid}_${today}_${Date.now()}`
      const menuLabel = MENU_LIST.find(m => m.value === selectedMenu)?.label || selectedMenu
      const newItem = {
        id,
        uid: user.uid,
        date: today,
        menuKey: selectedMenu,
        menuLabel,
        minutes: selectedTime,
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'trainingMenus', id), newItem)

      const updated = [...items, newItem]
      setItems(updated)
      setSelectedMenu('')

      // dailyRecords の totalMinutes を更新
      await updateDailyTotal(updated)

      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 1500)
    } catch (e) {
      console.error(e)
      alert('保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  // メニューを削除
  async function handleDelete(itemId) {
    try {
      const { doc: firestoreDoc, deleteDoc } = await import('firebase/firestore')
      await deleteDoc(firestoreDoc(db, 'trainingMenus', itemId))
      const updated = items.filter(i => i.id !== itemId)
      setItems(updated)
      await updateDailyTotal(updated)
    } catch (e) {
      console.error(e)
    }
  }

  // dailyRecords の合計時間を更新
  async function updateDailyTotal(menuItems) {
    const total = menuItems.reduce((sum, i) => sum + (i.minutes || 0), 0)
    const docId = `${user.uid}_${today}`
    try {
      await setDoc(
        doc(db, 'dailyRecords', docId),
        { uid: user.uid, date: today, totalMinutes: total, updatedAt: serverTimestamp() },
        { merge: true }
      )
    } catch (e) {
      console.error('total update error', e)
    }
  }

  const totalMinutes = items.reduce((s, i) => s + (i.minutes || 0), 0)

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
        ⚾ 練習メニュー記録
      </h2>

      {/* 今日の合計 */}
      <div style={{
        background: 'linear-gradient(135deg, #1a3a5c, #2563eb)',
        borderRadius: 12,
        padding: '16px',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
      }}>
        <p style={{ fontSize: '0.85rem', opacity: 0.85 }}>今日の合計練習時間</p>
        <p style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.2 }}>
          {totalMinutes}<span style={{ fontSize: '1rem' }}>分</span>
        </p>
        {totalMinutes >= 60 && (
          <p style={{ fontSize: '0.85rem', marginTop: 4, opacity: 0.9 }}>
            🏅 1時間達成！すごい！
          </p>
        )}
      </div>

      {/* メニュー選択 */}
      <div className="card">
        <div className="card-title">➕ 練習を追加する</div>

        <div className="form-group">
          <label className="form-label">練習の種類</label>
          <div className="menu-chips">
            {MENU_LIST.map(m => (
              <button
                key={m.value}
                className={`menu-chip ${selectedMenu === m.value ? 'selected' : ''}`}
                onClick={() => setSelectedMenu(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">時間</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TIME_OPTIONS.map(t => (
              <button
                key={t}
                className={`menu-chip ${selectedTime === t ? 'selected' : ''}`}
                onClick={() => setSelectedTime(t)}
                style={{ minWidth: 60, textAlign: 'center' }}
              >
                {t}分
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={saving || !selectedMenu}
        >
          {saving ? '追加中...' : '＋ 追加する'}
        </button>

        {/* ミニ達成アニメ */}
        {showSuccess && (
          <div style={{
            textAlign: 'center',
            padding: '10px',
            color: '#16a34a',
            fontWeight: 900,
            fontSize: '1.1rem',
            animation: 'fadeIn 0.3s',
          }}>
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
          items.map(item => (
            <div key={item.id} className="training-item">
              <div>
                <div className="menu-name">{item.menuLabel}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="menu-time">{item.minutes}分</span>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(item.id)}
                  title="削除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}

        {items.length > 0 && (
          <div style={{
            marginTop: 12,
            padding: '10px 12px',
            background: '#e0f2fe',
            borderRadius: 10,
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 700,
          }}>
            <span>合計</span>
            <span style={{ color: '#1d4ed8' }}>{totalMinutes}分</span>
          </div>
        )}
      </div>

      {/* 振り返りへ */}
      <button
        className="btn btn-outline"
        onClick={() => navigate('/record')}
        style={{ marginBottom: 8 }}
      >
        📝 ふりかえりも書く →
      </button>
      <button
        className="btn btn-success"
        onClick={() => navigate('/')}
      >
        🏠 ホームに戻る
      </button>
    </div>
  )
}
