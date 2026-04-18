import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  IconBaseball, IconHome, IconPencil, IconBarChart,
  IconGear, IconBook, IconLogout,
} from './Icons'

const NAV_CHILD = [
  { path: '/',         Icon: IconHome,     label: 'ホーム' },
  { path: '/record',   Icon: IconPencil,   label: 'きろく' },
  { path: '/stats',    Icon: IconBarChart, label: 'せいちょう' },
  { path: '/settings', Icon: IconGear,     label: 'せってい' },
]

const NAV_PARENT = [
  { path: '/',         Icon: IconHome, label: 'ホーム' },
  { path: '/parent',   Icon: IconBook, label: 'みまもり' },
  { path: '/settings', Icon: IconGear, label: 'せってい' },
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
          <span className="header-logo">
            <IconBaseball size={20} color="currentColor" />
          </span>
          <h1>野球のびノート</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isTrial && <span className="header-badge">おためし</span>}
          {!isTrial && (
            <button
              className="header-icon-btn"
              onClick={logout}
              title="ログアウト"
              aria-label="ログアウト"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IconLogout size={16} color="currentColor" />
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>ログアウト</span>
            </button>
          )}
        </div>
      </header>

      <main className="page-content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="メインメニュー">
        {navItems.map(({ path, Icon, label }) => (
          <button
            key={path}
            className={`nav-item ${pathname === path ? 'active' : ''}`}
            onClick={() => navigate(path)}
            aria-current={pathname === path ? 'page' : undefined}
            aria-label={label}
          >
            <span className="nav-icon">
              <Icon size={22} />
            </span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
