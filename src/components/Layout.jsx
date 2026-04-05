import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_CHILD = [
  { path: '/',         icon: '🏠', label: 'ホーム' },
  { path: '/record',   icon: '📝', label: 'きろく' },
  { path: '/training', icon: '⚾', label: '練習' },
  { path: '/stats',    icon: '📊', label: 'せいちょう' },
  { path: '/ranking',  icon: '🏆', label: 'チーム' },
]

const NAV_PARENT = [
  { path: '/',        icon: '🏠', label: 'ホーム' },
  { path: '/parent',  icon: '👀', label: 'みまもり' },
  { path: '/settings',icon: '⚙️', label: '設定' },
]

export default function Layout() {
  const { profile, isTrial, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const navItems = profile?.role === 'parent' ? NAV_PARENT : NAV_CHILD

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">⚾</span>
          <h1>野球のびノート</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isTrial && <span className="header-badge">おためし</span>}
          <button className="header-icon-btn" onClick={() => navigate('/settings')}
            title="設定" style={{ opacity: pathname === '/settings' ? 1 : 0.6 }}>
            ⚙️
          </button>
          {!isTrial && (
            <button className="header-icon-btn" onClick={logout} title="ログアウト">
              🚪
            </button>
          )}
        </div>
      </header>

      <main className="page-content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.path}
            className={`nav-item ${pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
