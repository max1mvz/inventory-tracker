import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext.jsx'
import Icon from '../ui/Icon.jsx'
import './Users.css'

async function callAdmin(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // Try to surface the function's JSON error message.
    let msg = error.message
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) msg = ctx.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notDeployed, setNotDeployed] = useState(false)

  // add form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await callAdmin({ action: 'list' })
      setUsers(data.users || [])
      setNotDeployed(false)
    } catch (e) {
      // A missing function / network failure usually means it isn't deployed.
      if (/not found|failed to fetch|non-2xx|404/i.test(e.message)) setNotDeployed(true)
      else setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addUser(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFlash(null)
    try {
      await callAdmin({ action: 'create', email: email.trim(), password, role })
      setFlash(`Added ${email.trim()}`)
      setEmail('')
      setPassword('')
      setRole('member')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(u) {
    if (!confirm(`Remove ${u.email}? They will no longer be able to sign in.`)) return
    setBusy(true)
    setError(null)
    try {
      await callAdmin({ action: 'delete', userId: u.id })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (notDeployed) {
    return (
      <section className="users">
        <h2 className="users-title">Users</h2>
        <div className="users-notice">
          <p>The admin function isn't deployed yet.</p>
          <p className="muted">
            Deploy the <code>admin-users</code> Edge Function (see the setup notes),
            then refresh this page.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="users">
      <h2 className="users-title">Users</h2>

      <form className="user-add" onSubmit={addUser}>
        <div className="user-add-row">
          <input
            type="email"
            placeholder="new.user@team.com"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Temporary password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn primary" type="submit" disabled={busy}>
            <Icon name="plus" size={16} />
            Add
          </button>
        </div>
        <p className="user-add-hint">
          They sign in with this email + password (share it with them). They can
          change it later via “Forgot password”.
        </p>
      </form>

      {flash && <p className="users-flash">{flash}</p>}
      {error && <p className="create-error">{error}</p>}

      {loading ? (
        <div className="looking">
          <span className="spinner" /> Loading users…
        </div>
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id} className="user-row">
              <span className="user-main">
                <span className="user-email">{u.email}</span>
                <span className={`role-badge role-${u.role}`}>{u.role}</span>
              </span>
              {u.id === user?.id ? (
                <span className="user-you">You</span>
              ) : (
                <button
                  className="btn small danger"
                  onClick={() => removeUser(u)}
                  disabled={busy}
                  title="Remove user"
                >
                  <Icon name="trash" size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
