import { useState } from 'react'
import {
  doc, setDoc, deleteDoc, serverTimestamp,
  collection, query, where, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr } from '../utils/dateUtils'

/**
 * 「ナイス！」ボタン
 * 1日に同じ相手に1回だけ送れる
 * 送ると小さなアニメーション
 */
export default function NiceButton({ targetUid, targetNickname }) {
  const { user, isTrial } = useAuth()
  const [sent, setSent] = useState(false)
  const [count, setCount] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // 初回ロード
  if (!loaded && user && !isTrial) {
    loadNiceState()
    setLoaded(true)
  }

  async function loadNiceState() {
    try {
      const today = todayStr()
      // 自分が今日この相手に送ったか
      const myNiceId = `${user.uid}_${targetUid}_${today}`
      const mySnap = await getDocs(
        query(collection(db, 'nices'),
          where('fromUid', '==', user.uid),
          where('toUid', '==', targetUid),
          where('date', '==', today))
      )
      setSent(!mySnap.empty)

      // この相手が今日もらった合計
      const totalSnap = await getDocs(
        query(collection(db, 'nices'),
          where('toUid', '==', targetUid),
          where('date', '==', today))
      )
      setCount(totalSnap.size)
    } catch (e) { console.error(e) }
  }

  async function handleNice() {
    if (!user || isTrial || sent || targetUid === user.uid) return
    try {
      setAnimating(true)
      const today = todayStr()
      const niceId = `${user.uid}_${targetUid}_${today}`
      await setDoc(doc(db, 'nices', niceId), {
        fromUid: user.uid,
        toUid: targetUid,
        date: today,
        createdAt: serverTimestamp(),
      })
      setSent(true)
      setCount(c => c + 1)
      setTimeout(() => setAnimating(false), 600)
    } catch (e) {
      console.error(e)
      setAnimating(false)
    }
  }

  // おためしモードか自分自身の場合は表示しない
  if (isTrial || !user || targetUid === user.uid) return null

  return (
    <button
      onClick={handleNice}
      disabled={sent}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '6px 12px', borderRadius: 20,
        border: sent ? '2px solid #f59e0b' : '2px solid #e5e7eb',
        background: sent ? '#fef3c7' : '#fff',
        color: sent ? '#92400e' : '#6b7280',
        fontSize: '0.78rem', fontWeight: 700,
        cursor: sent ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transform: animating ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <span style={{ fontSize: '1rem' }}>{sent ? '👍' : '👋'}</span>
      {sent ? 'ナイス済み' : 'ナイス！'}
      {count > 0 && (
        <span style={{
          background: sent ? '#f59e0b' : '#e5e7eb',
          color: sent ? '#fff' : '#6b7280',
          borderRadius: '50%', width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 900,
        }}>
          {count}
        </span>
      )}
    </button>
  )
}
