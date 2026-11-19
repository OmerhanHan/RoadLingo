'use client'
import { createContext, useContext, useMemo, useState, useSyncExternalStore, ReactNode } from 'react'
import { getProfile, setProfile as saveProfile } from '@/lib/storage'

type User = { name: string; email: string } | null

type AuthContextType = {
  user: User
  login: (email: string, password: string, name?: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const noopSubscribe = () => () => {}

export function AuthProvider({ children }: { children: ReactNode }) {
  // false during SSR / hydration, true once running in the browser.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const storedUser = useMemo<User>(() => (hydrated ? getProfile() : null), [hydrated])
  // undefined = not changed in this session yet → fall back to the stored profile.
  const [sessionUser, setUser] = useState<User | undefined>(undefined)
  const user = sessionUser !== undefined ? sessionUser : storedUser
  const loading = !hydrated

  const login = async (email: string) => {
    // Mock login - just check if profile exists
    await new Promise(r => setTimeout(r, 800))
    const profile = getProfile()
    if (profile && profile.email === email) {
      setUser(profile)
    } else {
      // Create guest profile
      const guestProfile = { name: email.split('@')[0], email }
      saveProfile(guestProfile)
      setUser(guestProfile)
    }
  }

  const register = async (email: string, _password: string, name: string) => {
    await new Promise(r => setTimeout(r, 800))
    const profile = { name, email }
    saveProfile(profile)
    setUser(profile)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('writer_profile')
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
