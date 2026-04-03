import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_CHILD = [
  { path: '/',        icon: '🏠', label: 'ホーム' },
  { path: '/record',  icon: '📝', label: 'きろく' },
  { path: '/stats',   icon: '📊', label: 'せいちょう' },
  { path: '/ranking', icon: '🏆', label: 'ランキング' },
  { path: '/settings',icon: '⚙️', label: '設定' },
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
        <span style={{ fontSize: '1.3rem' }}>⚾</span>
        <h1>野球のびノート</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isTrial && (
            <span style={{
              fontSize: '0.6rem', background: 'rgba(255,255,255,0.25)',
              borderRadius: 8, padding: '2px 8px', fontWeight: 700,
            }}>
              おためし
            </span>
          )}
          {!isTrial && (
            <button className="header-icon-btn" onClick={logout} title="ログアウト">🚪</button>
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
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
