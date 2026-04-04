import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import DailyRecord from './pages/DailyRecord'
import TrainingMenu from './pages/TrainingMenu'
import MyStats from './pages/MyStats'
import TeamRanking from './pages/TeamRanking'
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

export default function App() {
  const { user, isTrial, loading } = useAuth()

  if (loading) return <Loading />

  return (
    <Routes>
      {/* Welcome画面（未ログイン＆おためし未開始時） */}
      <Route
        path="/welcome"
        element={(user || isTrial) ? <Navigate to="/" replace /> : <Welcome />}
      />

      {/* メインアプリ */}
      <Route path="/" element={<AuthedRoute><Layout /></AuthedRoute>}>
        <Route index element={<Home />} />
        <Route path="record" element={<ChildRoute><DailyRecord /></ChildRoute>} />
        <Route path="training" element={<ChildRoute><TrainingMenu /></ChildRoute>} />
        <Route path="stats" element={<MyStats />} />
        <Route path="badges" element={<ChildRoute><Badges /></ChildRoute>} />
        <Route path="goal" element={<ChildRoute><WeeklyGoal /></ChildRoute>} />
        <Route path="ranking" element={<TeamRanking />} />
        <Route path="parent" element={<ParentView />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* 存在しないURLはWelcomeかホームへ */}
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
