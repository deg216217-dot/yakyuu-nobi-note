import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import DailyRecord from './pages/DailyRecord'
import MyStats from './pages/MyStats'
import ParentView from './pages/ParentView'
import Settings from './pages/Settings'
import Badges from './pages/Badges'
import WeeklyGoal from './pages/WeeklyGoal'

/** ログイン済み or おためし中のみアクセス可 */
function AuthedRoute({ children }) {
  const { user, isTrial, loading } = useAuth()
  if (loading) return <Loading />
  return (user || isTrial) ? children : <Navigate to="/welcome" replace />
}

/** 子どものみ */
function ChildRoute({ children }) {
  const { isChild, loading } = useAuth()
  if (loading) return null
  return isChild ? children : <Navigate to="/" replace />
}

/**
 * Welcome ルート
 * ・未ログイン → Welcome表示
 * ・おためし中 + 設定から来た → 登録画面を表示
 * ・おためし中 + それ以外 → ホームへリダイレクト
 * ・登録済み → ホームへリダイレクト
 */
function WelcomeRoute() {
  const { user, isTrial, loading, isRegistered } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />

  // 登録済みなら常にホームへ
  if (isRegistered) return <Navigate to="/" replace />

  // おためし中で、設定画面から来た場合 → 登録画面を表示
  const fromSettings = location.state?.fromSettings
  if (isTrial && !fromSettings) return <Navigate to="/" replace />

  return <Welcome initialView={fromSettings ? 'register' : 'main'} />
}

export default function App() {
  const { loading } = useAuth()

  if (loading) return <Loading />

  return (
    <Routes>
      <Route path="/welcome" element={<WelcomeRoute />} />

      <Route path="/" element={<AuthedRoute><Layout /></AuthedRoute>}>
        <Route index element={<Home />} />
        <Route path="record" element={<ChildRoute><DailyRecord /></ChildRoute>} />
        <Route path="stats" element={<MyStats />} />
        <Route path="badges" element={<ChildRoute><Badges /></ChildRoute>} />
        <Route path="goal" element={<ChildRoute><WeeklyGoal /></ChildRoute>} />
        <Route path="parent" element={<ParentView />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Loading() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>⚾ よみこみ中...</p>
    </div>
  )
}
