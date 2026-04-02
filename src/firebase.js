// ★★★ ここにFirebaseの設定を貼り付けてください ★★★
// Firebase Console → プロジェクト設定 → マイアプリ → firebaseConfig をコピーする

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCuHF2Op5AjDJll52v3dloVnMq3IISvKaw",
  authDomain: "yakyuu-nobi-note.firebaseapp.com",
  projectId: "yakyuu-nobi-note",
  storageBucket: "yakyuu-nobi-note.firebasestorage.app",
  messagingSenderId: "119933094538",
  appId: "1:119933094538:web:29a5dad9c2a359093bbb73"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
