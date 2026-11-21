'use client'
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getProfile, setProfile as saveProfile } from '@/lib/storage'
import { supabaseConfigured } from '@/lib/auth/config'
import { authErrorMessage, authRedirect, supabaseBrowser } from '@/lib/auth/client'
import { setAccessToken } from '@/lib/auth/token'
import { clearSubscription, planHeaders, saveSubscription, type SubscriptionState } from '@/lib/plans'

type User = { id: string | null; name: string; email: string } | null

export type RegisterResult = { needsConfirmation: boolean }

type AuthContextType = {
  user: User
  loading: boolean
  /** 'supabase' once a real project is configured; 'demo' is the local mock sign-in. */
  mode: 'supabase' | 'demo'
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<RegisterResult>
  loginWithGoogle: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return supabaseConfigured ? <SupabaseAuthProvider>{children}</SupabaseAuthProvider> : <DemoAuthProvider>{children}</DemoAuthProvider>
}

/* ── Supabase ── */

function userFrom(session: Session | null): User {
  const u = session?.user
  if (!u) return null
  const meta = u.user_metadata ?? {}
  const email = u.email ?? ''
  const name = String(meta.name || meta.full_name || email.split('@')[0] || '')
  return { id: u.id, name, email }
}

/** Caches the server's subscription for the UI (plan chip, plans page, limits). */
async function syncSubscription() {
  try {
    const res = await fetch('/api/subscription', { headers: planHeaders() })
    if (res.ok) saveSubscription((await res.json()) as SubscriptionState)
  } catch {
    /* offline: keep the cached copy */
  }
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = supabaseBrowser()
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setAccessToken(session?.access_token ?? null)
      setUser(userFrom(session))
      setLoading(false)
      // Supabase calls must not run inside this callback (they would wait on it).
      if (event === 'SIGNED_OUT') clearSubscription()
      else if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) setTimeout(syncSubscription, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      mode: 'supabase',
      async login(email, password) {
        const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password })
        if (error) throw new Error(authErrorMessage(error, 'Giriş yapılamadı.'))
      },
      async register(email, password, name) {
        const { data, error } = await supabaseBrowser().auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: authRedirect('/app/home') },
        })
        if (error) throw new Error(authErrorMessage(error, 'Kayıt yapılamadı.'))
        // With email confirmation on, there is no session until the link is clicked.
        return { needsConfirmation: !data.session }
      },
      async loginWithGoogle() {
        const { error } = await supabaseBrowser().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: authRedirect('/app/home') },
        })
        if (error) throw new Error(authErrorMessage(error, 'Google ile giriş başlatılamadı.'))
      },
      async resetPassword(email) {
        const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
          redirectTo: authRedirect('/auth/reset'),
        })
        if (error) throw new Error(authErrorMessage(error, 'Sıfırlama e-postası gönderilemedi.'))
      },
      async logout() {
        await supabaseBrowser().auth.signOut()
      },
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ── Demo (no Supabase yet): any email signs in, the profile lives in localStorage ── */

const noopSubscribe = () => () => {}
const DEMO_ONLY = 'Bu özellik için Supabase bağlantısı gerekiyor (.env.local).'

function DemoAuthProvider({ children }: { children: ReactNode }) {
  // false during SSR / hydration, true once running in the browser.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const storedUser = useMemo<User>(() => {
    const p = hydrated ? getProfile() : null
    return p ? { id: null, ...p } : null
  }, [hydrated])
  // undefined = not changed in this session yet → fall back to the stored profile.
  const [sessionUser, setUser] = useState<User | undefined>(undefined)
  const user = sessionUser !== undefined ? sessionUser : storedUser

  const value: AuthContextType = {
    user,
    loading: !hydrated,
    mode: 'demo',
    async login(email) {
      await new Promise((r) => setTimeout(r, 800))
      const profile = getProfile()
      const next = profile && profile.email === email ? profile : { name: email.split('@')[0], email }
      saveProfile(next)
      setUser({ id: null, ...next })
    },
    async register(email, _password, name) {
      await new Promise((r) => setTimeout(r, 800))
      const profile = { name, email }
      saveProfile(profile)
      setUser({ id: null, ...profile })
      return { needsConfirmation: false }
    },
    async loginWithGoogle() {
      throw new Error(DEMO_ONLY)
    },
    async resetPassword() {
      throw new Error(DEMO_ONLY)
    },
    async logout() {
      setUser(null)
      localStorage.removeItem('writer_profile')
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
