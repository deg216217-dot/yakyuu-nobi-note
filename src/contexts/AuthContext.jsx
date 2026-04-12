import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, writeBatch,
  serverTimestamp, collection, query, where, getDocs,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import {
  getLocalProfile, setLocalProfile,
  exportAllLocal, clearAllLocal,
} from '../utils/localStore'

const AuthContext = createContext(null)

/** 6文字の招待コードを生成（英大文字+数字、紛らわしい文字除外） */
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** 重複チェック付き招待コード生成（最大5回試行） */
async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const q = query(collection(db, 'users'), where('inviteCode', '==', code))
    const snap = await getDocs(q)
    if (snap.empty) return code
  }
  return randomCode()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isTrial, setIsTrial] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        setIsTrial(false)
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setProfile(snap.exists() ? snap.data() : null)
      } else {
        setUser(null)
        const local = getLocalProfile()
        if (local) {
          setIsTrial(true)
          setProfile(local)
        } else {
          setIsTrial(false)
          setProfile(null)
        }
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  function startTrial(nickname) {
    const p = {
      nickname,
      role: 'child',
      isTrial: true,
      createdAt: Date.now(),
    }
    setLocalProfile(p)
    setProfile(p)
    setIsTrial(true)
  }

  async function registerChild({ email, password, nickname }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nickname })
    const inviteCode = await generateUniqueInviteCode()
    const userData = {
      uid: cred.user.uid,
      email,
      nickname,
      role: 'child',
      inviteCode,
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userData)
    await migrateTrialData(cred.user.uid)
    setProfile(userData)
    setIsTrial(false)
  }

  async function lookupChildByCode(code) {
    if (!code) return ''
    const trimmed = code.trim().toUpperCase()
    const q = query(collection(db, 'users'), where('inviteCode', '==', trimmed), where('role', '==', 'child'))
    const snap = await getDocs(q)
    if (snap.empty) return ''
    return snap.docs[0].data().uid
  }

  async function registerParent({ email, password, nickname, inviteCode }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nickname })
    const childUid = await lookupChildByCode(inviteCode)
    const userData = {
      uid: cred.user.uid,
      email,
      nickname,
      role: 'parent',
      childUid: childUid || '',
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userData)
    if (childUid) {
      await setDoc(doc(db, 'parentChildLinks', `${cred.user.uid}_${childUid}`), {
        parentUid: cred.user.uid,
        childUid,
        createdAt: serverTimestamp(),
      })
    }
    setProfile(userData)
    setIsTrial(false)
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, 'users', cred.user.uid))
    if (snap.exists()) setProfile(snap.data())
    setIsTrial(false)
  }

  async function logout() {
    await signOut(auth)
    setProfile(null)
    setIsTrial(false)
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  }

  function updateProfileState(partial) {
    setProfile(prev => prev ? { ...prev, ...partial } : partial)
  }

  async function migrateTrialData(uid) {
    const { records } = exportAllLocal()
    if (records.length === 0) {
      clearAllLocal()
      return
    }
    const batch = writeBatch(db)
    for (const rec of records) {
      const docId = `${uid}_${rec.date}`
      batch.set(doc(db, 'dailyRecords', docId), {
        uid,
        date: rec.date,
        practiceType: rec.practiceType || '',
        practiceMemo: rec.practiceMemo || '',
        myPlay: rec.myPlay || '',
        nicePlay: rec.nicePlay || rec.teammatePlay || '',
        concern: rec.concern || '',
        nextGoal: rec.nextGoal || '',
        mood: rec.mood || '',
        totalMinutes: rec.totalMinutes || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    clearAllLocal()
  }

  const value = {
    user,
    profile,
    isTrial,
    loading,
    startTrial,
    registerChild,
    registerParent,
    login,
    logout,
    resetPassword,
    lookupChildByCode,
    updateProfileState,
    isChild: profile?.role === 'child',
    isParent: profile?.role === 'parent',
    isRegistered: !!user && !isTrial,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
