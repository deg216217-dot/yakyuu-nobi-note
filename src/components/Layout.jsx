import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS_CHILD = [
  { path: '/',        icon: '🏠', label: 'ホーム' },
  { path: '/record',  icon: '📝', label: 'きろく' },
  { path: '/stats',   icon: '📊', label: 'せいちょう' },
  { path: '/ranking', icon: '🏆', label: 'ランキング' },
  { path: '/settings',icon: '⚙️', label: '設定' },
]

const NAV_ITEMS_PARENT = [
  { path: '/',        icon: '🏠', label: 'ホーム' },
  { path: '/parent',  icon: '👀', label: 'みまもり' },
  { path: '/settings',icon: '⚙️', label: '設定' },
]

export default function Layout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const navItems = profile?.role === 'parent' ? NAV_ITEMS_PARENT : NAV_ITEMS_CHILD

  const handleNav = (path) => navigate(path)

  return (
    <div className="app-container">
      {/* ヘッダー */}
      <header className="app-header">
        <span style={{ fontSize: '1.3rem' }}>⚾</span>
        <h1>野球のびノート</h1>
        <button className="header-icon-btn" onClick={logout} title="ログアウト">
          🚪
        </button>
      </header>

      {/* メインコンテンツ */}
      <main className="page-content">
        <Outlet />
      </main>

      {/* ボトムナビゲーション */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${pathname === item.path ? 'active' : ''}`}
            onClick={() => handleNav(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
