import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, collection, writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import {
  getLocalProfile, setLocalProfile,
  exportAllLocal, clearAllLocal,
} from '../utils/localStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)           // Firebase Auth ユーザー
  const [profile, setProfile] = useState(null)     // Firestore or ローカルプロフィール
  const [isTrial, setIsTrial] = useState(false)    // おためしモードか
  const [loading, setLoading] = useState(true)

  // ===== 初期化 =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 本登録ユーザー
        setUser(firebaseUser)
        setIsTrial(false)
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setProfile(snap.exists() ? snap.data() : null)
      } else {
        setUser(null)
        // おためしプロフィールがあれば復元
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

  // ===== おためしモード開始 =====
  function startTrial(nickname) {
    const p = {
      nickname,
      role: 'child',
      teamCode: '',
      isTrial: true,
      createdAt: Date.now(),
    }
    setLocalProfile(p)
    setProfile(p)
    setIsTrial(true)
  }

  // ===== 本登録（子ども） =====
  async function registerChild({ email, password, nickname, teamCode }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: nickname })
    const userData = {
      uid: cred.user.uid,
      email,
      nickname,
      role: 'child',
      teamCode: teamCode || 'default',
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userData)
    // おためしデータを移行
    await migrateTrialData(cred.user.uid, nickname, teamCode || 'default')
    setProfile(userData)
    setIsTrial(false)
  }

  // ===== 本登録（親） =====
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

  // ===== ログイン =====
  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, 'users', cred.user.uid))
    if (snap.exists()) setProfile(snap.data())
    setIsTrial(false)
  }

  // ===== ログアウト =====
  async function logout() {
    await signOut(auth)
    setProfile(null)
    setIsTrial(false)
  }

  // ===== おためし → Firebase 移行 =====
  async function migrateTrialData(uid, nickname, teamCode) {
    const { records, menus } = exportAllLocal()
    if (records.length === 0 && menus.length === 0) {
      clearAllLocal()
      return
    }
    const batch = writeBatch(db)
    for (const rec of records) {
      const docId = `${uid}_${rec.date}`
      // privateRecords（詳細）
      batch.set(doc(db, 'privateRecords', docId), {
        uid,
        date: rec.date,
        practiceType: rec.practiceType || '',
        myPlay: rec.myPlay || '',
        teammatePlay: rec.teammatePlay || '',
        concern: rec.concern || '',
        nextGoal: rec.nextGoal || '',
        hitokoto: rec.hitokoto || '',
        mood: rec.mood || '',
        totalMinutes: rec.totalMinutes || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      // publicSummaries（チーム公開用要約）
      batch.set(doc(db, 'publicSummaries', docId), {
        uid,
        nickname,
        teamCode,
        date: rec.date,
        totalMinutes: rec.totalMinutes || 0,
        practiceType: rec.practiceType || '',
        mood: rec.mood || '',
        hitokoto: rec.hitokoto || '',
        nextGoal: rec.nextGoal || '',
        updatedAt: serverTimestamp(),
      })
    }
    for (const menu of menus) {
      const mId = `${uid}_${menu.date}_${menu.id}`
      batch.set(doc(db, 'trainingMenus', mId), {
        uid,
        date: menu.date,
        menuKey: menu.menuKey,
        menuLabel: menu.menuLabel,
        minutes: menu.minutes,
        createdAt: serverTimestamp(),
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
