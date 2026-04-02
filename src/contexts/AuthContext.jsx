import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Firebase Auth ユーザー
  const [profile, setProfile] = useState(null) // Firestore の追加情報
  const [loading, setLoading] = useState(true)

  // ログイン状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Firestoreからプロフィール取得
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
          setProfile(snap.data())
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // 新規登録（子ども）
  async function registerChild({ email, password, nickname, teamCode }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nickname })
    const userData = {
      uid: cred.user.uid,
      email,
      nickname,
      role: 'child',        // 'child' | 'parent' | 'coach'
      teamCode: teamCode || 'default',
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userData)
    setProfile(userData)
  }

  // 新規登録（親）
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
    setProfile(userData)
  }

  // ログイン
  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, 'users', cred.user.uid))
    if (snap.exists()) setProfile(snap.data())
  }

  // ログアウト
  async function logout() {
    await signOut(auth)
  }

  const value = {
    user,
    profile,
    loading,
    registerChild,
    registerParent,
    login,
    logout,
    isChild: profile?.role === 'child',
    isParent: profile?.role === 'parent',
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
