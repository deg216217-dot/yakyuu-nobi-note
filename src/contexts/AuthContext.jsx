import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import {
  getLocalProfile, setLocalProfile,
  exportAllLocal, clearAllLocal,
} from '../utils/localStore'

const AuthContext = createContext(null)

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
    const userData = {
      uid: cred.user.uid,
      email,
      nickname,
      role: 'child',
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userData)
    await migrateTrialData(cred.user.uid)
    setProfile(userData)
    setIsTrial(false)
  }

  async function registerParent({ email, password, nickname, childUid }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nickname })
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
