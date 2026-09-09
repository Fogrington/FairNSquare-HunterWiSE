import { NavLink } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/judges', label: 'Judges', icon: '👤' },
  { to: '/categories', label: 'Categories', icon: '📁' },
  { to: '/results', label: 'Results', icon: '📊' },
]

export default function Sidebar() {
  const { adminLogout } = useAdmin()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandName}>FairN²</span>
        <span className={styles.brandSub}>Admin Panel</span>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <span className={styles.navIcon}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <button className={styles.logoutBtn} onClick={adminLogout}>
          Log Out
        </button>
        <div className={styles.footerBrand}>
          <span style={{ fontWeight: 700 }}>HUNTER</span>
          <span style={{ fontStyle: 'italic', color: 'var(--blue-dark)' }}>wise</span>
        </div>
      </div>
    </aside>
  )
}
