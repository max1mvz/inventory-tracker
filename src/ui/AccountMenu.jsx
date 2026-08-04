import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/** Avatar + email in the top bar; opens a small menu with role + sign out. */
export default function AccountMenu({ email, role, onSignOut, compact }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const initial = (email?.[0] || '?').toUpperCase()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="account" ref={ref}>
      <button className="account-btn" onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{initial}</span>
        {!compact && <span className="account-email">{email}</span>}
        {!compact && <Icon name="chevron-down" size={16} />}
      </button>
      {open && (
        <div className="account-menu">
          <div className="account-menu-head">
            <span className="avatar lg">{initial}</span>
            <div className="account-info">
              <div className="account-name" title={email}>
                {email}
              </div>
              {role && (
                <div className="account-role">
                  <span className={`role-badge role-${role}`}>{role}</span>
                </div>
              )}
            </div>
          </div>
          <button className="account-signout" onClick={onSignOut}>
            <Icon name="logout" size={16} />
            Sign out
          </button>
          <div className="account-version" title={`Built ${__BUILD_DATE__}`}>
            Version {__APP_VERSION__}
          </div>
        </div>
      )}
    </div>
  )
}
