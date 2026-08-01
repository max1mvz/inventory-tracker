import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin') // signin | reset | reset-sent
  const [status, setStatus] = useState('idle') // idle | working
  const [error, setError] = useState(null)

  if (!isSupabaseConfigured) {
    return (
      <div className="login">
        <div className="login-card notice">
          <h2>Almost there</h2>
          <p>
            Supabase isn't connected yet. Create a <code>.env</code> file (copy{' '}
            <code>.env.example</code>) with your project URL and anon key, then
            restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  async function signIn(e) {
    e.preventDefault()
    setStatus('working')
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setError(
        /invalid login/i.test(error.message)
          ? 'Wrong email or password.'
          : error.message,
      )
      setStatus('idle')
    }
    // On success, the auth listener swaps this screen for the app.
  }

  async function sendReset(e) {
    e.preventDefault()
    setStatus('working')
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) {
      setError(error.message)
      setStatus('idle')
    } else {
      setMode('reset-sent')
      setStatus('idle')
    }
  }

  if (mode === 'reset-sent') {
    return (
      <div className="login">
        <div className="login-card">
          <h2>Check your email</h2>
          <p>
            If <strong>{email.trim()}</strong> has an account, a password-reset
            link is on its way.
          </p>
          <button className="btn" onClick={() => setMode('signin')}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'reset') {
    return (
      <div className="login">
        <form className="login-card" onSubmit={sendReset}>
          <h2>Reset password</h2>
          <p className="login-sub">We'll email you a reset link.</p>
          <input
            className="login-input"
            type="email"
            autoComplete="email"
            placeholder="you@team.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn primary" type="submit" disabled={status === 'working'}>
            {status === 'working' ? 'Sending…' : 'Send reset link'}
          </button>
          {error && <p className="login-error">{error}</p>}
          <button type="button" className="login-link" onClick={() => setMode('signin')}>
            Back to sign in
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={signIn}>
        <h2>Inventory Tracker</h2>
        <p className="login-sub">Sign in to your account.</p>
        <input
          className="login-input"
          type="email"
          autoComplete="email"
          placeholder="you@team.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="login-input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          className="btn primary"
          type="submit"
          disabled={status === 'working' || !email.trim() || !password}
        >
          {status === 'working' ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="login-error">{error}</p>}
        <button type="button" className="login-link" onClick={() => setMode('reset')}>
          Forgot password?
        </button>
      </form>
    </div>
  )
}
