import { useState } from 'react'
import Scanner from './Scanner.jsx'
import StockList from './stock/StockList.jsx'
import StockTable from './stock/StockTable.jsx'
import ActivityFeed from './history/ActivityFeed.jsx'
import Overview from './dashboard/Overview.jsx'
import Users from './admin/Users.jsx'
import Expenses from './expenses/Expenses.jsx'
import BarcodeStudio from './barcode/BarcodeStudio.jsx'
import Login from './auth/Login.jsx'
import { useAuth } from './auth/AuthContext.jsx'
import { useOffline } from './offline/OfflineContext.jsx'
import { ProductViewProvider } from './product/ProductViewContext.jsx'
import { useIsDesktop } from './layout/useMediaQuery'
import Icon from './ui/Icon.jsx'
import ThemeToggle from './ui/ThemeToggle.jsx'
import AccountMenu from './ui/AccountMenu.jsx'
import UpdatePrompt from './ui/UpdatePrompt.jsx'
import './App.css'

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'scan', label: 'Scan', icon: 'scan', mobileOnly: true },
  { id: 'stock', label: 'Stock', icon: 'stock' },
  { id: 'barcodes', label: 'Barcodes', icon: 'barcode' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'users', label: 'Users', icon: 'users', adminOnly: true },
]

const TITLES = {
  overview: 'Overview',
  scan: 'Scan',
  stock: 'Stock',
  barcodes: 'Barcode studio',
  expenses: 'Expenses',
  activity: 'Activity',
  users: 'Users',
}

function SyncChip() {
  const { online, pending, flush } = useOffline()
  if (online && pending === 0) return null
  const label = !online ? `Offline · ${pending} pending` : `Syncing ${pending}…`
  return (
    <button
      className={`sync-chip ${online ? 'syncing' : 'offline'}`}
      onClick={() => online && flush()}
      title={online ? 'Tap to sync now' : 'Changes are saved and will sync when back online'}
    >
      <span className="sync-dot" />
      {label}
    </button>
  )
}

function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 512 512" className="brand-mark" aria-hidden="true">
        <g stroke="var(--accent)" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M256 104 L392 176 L392 336 L256 408 L120 336 L120 176 Z" />
          <path d="M120 176 L256 248 L392 176" />
          <path d="M256 248 L256 408" />
        </g>
      </svg>
      <span>Inventory Tracker</span>
    </div>
  )
}

function ViewContent({ view, isDesktop }) {
  if (view === 'overview') return <Overview />
  if (view === 'scan') return <Scanner />
  if (view === 'stock') return isDesktop ? <StockTable /> : <StockList />
  if (view === 'barcodes') return <BarcodeStudio />
  if (view === 'expenses') return <Expenses />
  if (view === 'users') return <Users />
  return <ActivityFeed />
}

export default function App() {
  const { user, loading, signOut, isAdmin, profile } = useAuth()
  const isDesktop = useIsDesktop()
  // Honour the manifest shortcuts (?view=scan / ?view=stock) on a cold launch.
  const [picked, setPicked] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('view')
    return NAV.some((n) => n.id === v) ? v : null
  })
  const rawView = picked ?? (isDesktop ? 'overview' : 'scan')
  // Scan is mobile-only; if the view lands on it while on desktop, fall back.
  const view = isDesktop && rawView === 'scan' ? 'overview' : rawView
  const navItems = NAV.filter(
    (n) => (!n.adminOnly || isAdmin) && !(n.mobileOnly && isDesktop),
  )

  if (loading) {
    return (
      <div className="app">
        <main className="app-main">
          <p className="app-loading">Loading…</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <main className="app-main">
          <Login />
        </main>
      </div>
    )
  }

  return (
    <ProductViewProvider>
      <UpdatePrompt />
      {isDesktop ? (
        <div className="shell">
          <aside className="sidebar">
            <Brand />
            <nav className="side-nav">
              {navItems.map((n) => (
                <button
                  key={n.id}
                  className={`side-link ${view === n.id ? 'on' : ''}`}
                  onClick={() => setPicked(n.id)}
                >
                  <Icon name={n.icon} size={18} />
                  {n.label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="main-col">
            <header className="topbar">
              <div className="topbar-title">{TITLES[view]}</div>
              <div className="topbar-right">
                <SyncChip />
                <ThemeToggle compact />
                <AccountMenu email={user.email} role={profile?.role} onSignOut={signOut} />
              </div>
            </header>
            <main className="content">
              <div className="content-inner">
                <ViewContent view={view} isDesktop />
              </div>
            </main>
          </div>
        </div>
      ) : (
        <div className="app">
          <header className="app-header">
            <div className="app-header-row">
              <div>
                <h1>Inventory Tracker</h1>
                <p className="tagline">Scan a barcode to check or update stock.</p>
              </div>
              <div className="app-header-actions">
                <SyncChip />
                <ThemeToggle compact />
                <AccountMenu email={user.email} role={profile?.role} onSignOut={signOut} compact />
              </div>
            </div>
            <nav className="app-nav">
              {navItems.map((n) => (
                <button
                  key={n.id}
                  className={`nav-btn ${view === n.id ? 'on' : ''}`}
                  onClick={() => setPicked(n.id)}
                >
                  <Icon name={n.icon} size={18} />
                  <span>{n.label}</span>
                </button>
              ))}
            </nav>
          </header>
          <main className="app-main">
            <ViewContent view={view} isDesktop={false} />
          </main>
        </div>
      )}
    </ProductViewProvider>
  )
}
