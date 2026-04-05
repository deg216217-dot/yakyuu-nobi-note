import { useState, useEffect } from 'react'
import {
  doc, setDoc, deleteDoc, serverTimestamp,
  collection, query, where, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { todayStr } from '../utils/dateUtils'

export default function NiceButton({ targetUid, targetNickname }) {
  const { user, isTrial } = useAuth()
  const [sent, setSent] = useState(false)
  const [count, setCount] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (!user || isTrial) return
    loadNiceState()
  }, [user, isTrial, targetUid])

  async function loadNiceState() {
    try {
      const today = todayStr()
      const mySnap = await getDocs(
        query(collection(db, 'nices'),
          where('fromUid', '==', user.uid),
          where('toUid', '==', targetUid),
          where('date', '==', today))
      )
      setSent(!mySnap.empty)

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

  if (isTrial || !user || targetUid === user.uid) return null

  return (
    <button
      onClick={handleNice}
      disabled={sent}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '6px 12px', borderRadius: 'var(--r-full)',
        border: sent ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
        background: sent ? 'var(--warning-bg)' : 'var(--surface)',
        color: sent ? 'var(--accent-dark)' : 'var(--text-2)',
        fontSize: '0.82rem', fontWeight: 700,
        cursor: sent ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transform: animating ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <span style={{ fontSize: '0.95rem' }}>{sent ? '👍' : '👋'}</span>
      {sent ? 'ナイス済み' : 'ナイス！'}
      {count > 0 && (
        <span style={{
          background: sent ? 'var(--accent)' : 'var(--border)',
          color: sent ? '#fff' : 'var(--text-2)',
          borderRadius: '50%', width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800,
        }}>
          {count}
        </span>
      )}
    </button>
  )
}
