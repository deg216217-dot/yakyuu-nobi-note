import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import DailyRecord from './pages/DailyRecord'
import TrainingMenu from './pages/TrainingMenu'
import MyStats from './pages/MyStats'
import TeamRanking from './pages/TeamRanking'
import ParentView from './pages/ParentView'
import Settings from './pages/Settings'

// ログイン必須ルート
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p style={{ fontWeight: 700 }}>よみこみ中...</p>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

// 子どものみアクセス可能
function ChildRoute({ children }) {
  const { isChild, loading } = useAuth()
  if (loading) return null
  return isChild ? children : <Navigate to="/" replace />
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>⚾ よみこみ中...</p>
      </div>
    )
  }

  return (
    <Routes>
      {/* ログイン画面（未ログイン時のみ） */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {/* ログイン必須ページ */}
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Home />} />
        <Route path="record" element={
          <ChildRoute><DailyRecord /></ChildRoute>
        } />
        <Route path="training" element={
          <ChildRoute><TrainingMenu /></ChildRoute>
        } />
        <Route path="stats" element={<MyStats />} />
        <Route path="ranking" element={<TeamRanking />} />
        <Route path="parent" element={<ParentView />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* 存在しないURLはホームへ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
