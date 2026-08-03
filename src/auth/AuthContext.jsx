import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'

const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
})

// Dev-only login bypass for local UI walkthroughs / screenshots. Active ONLY in
// a Vite dev build (`import.meta.env.DEV`) AND when the page is opened with
// `?devbypass=1`. In a production build `import.meta.env.DEV` is statically
// false, so this whole branch is dead-code-eliminated and can never ship.
const DEV_BYPASS =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('devbypass') === '1'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // If Supabase isn't configured yet, there's nothing to load — resolve immediately.
  const [loading, setLoading] = useState(isSupabaseConfigured && !DEV_BYPASS)

  useEffect(() => {
    if (!isSupabaseConfigured || DEV_BYPASS) return

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Fetch the current user's profile (role) whenever the user changes. If the
  // profiles table isn't migrated yet, this silently no-ops (role stays null).
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      setProfile(null)
      return
    }
    let active = true
    supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => active && setProfile(data ?? null))
    return () => {
      active = false
    }
  }, [userId])

  const value = DEV_BYPASS
    ? {
        session: { user: { id: 'dev-user', email: 'dev@local' } },
        user: { id: 'dev-user', email: 'dev@local' },
        profile: { id: 'dev-user', email: 'dev@local', role: 'owner' },
        isAdmin: true,
        loading: false,
        signOut: async () => {},
      }
    : {
        session,
        user: session?.user ?? null,
        profile,
        isAdmin: profile?.role === 'owner' || profile?.role === 'admin',
        loading,
        signOut: async () => {
          if (isSupabaseConfigured) await supabase.auth.signOut()
        },
      }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
