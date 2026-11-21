'use client'
/**
 * Browser Supabase client. The session is kept in localStorage (not cookies)
 * so the same code works in the Capacitor app, where the API is called on a
 * remote server; requests carry the access token instead (planHeaders()).
 */
import { createClient, type AuthError, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, supabaseConfigured } from './config'

let client: SupabaseClient | null = null

export function supabaseBrowser(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Supabase is not configured')
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // Finishes the Google sign-in (and the password reset link) on /auth/callback.
      detectSessionInUrl: true,
      storageKey: 'roadlingo-auth',
    },
  })
  return client
}

/** Where Supabase sends the browser back after Google sign-in or an email link. */
export function authRedirect(next = '/app/home'): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-posta veya şifre hatalı.',
  email_not_confirmed: 'Önce e-postana gelen doğrulama bağlantısına tıklaman gerekiyor.',
  user_already_exists: 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.',
  email_exists: 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.',
  weak_password: 'Şifre çok zayıf. En az 6 karakter kullan, harf ve rakam karıştır.',
  over_email_send_rate_limit: 'Çok fazla e-posta istendi. Birkaç dakika sonra tekrar dene.',
  over_request_rate_limit: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  email_address_invalid: 'Geçerli bir e-posta adresi gir.',
  validation_failed: 'Bilgileri kontrol edip tekrar dene.',
  same_password: 'Yeni şifre eskisiyle aynı olamaz.',
  provider_disabled: 'Bu giriş yöntemi şu an kapalı.',
}

/** A Turkish message for a Supabase auth error. */
export function authErrorMessage(err: AuthError | Error | null | undefined, fallback: string): string {
  const code = err && 'code' in err ? (err.code as string | undefined) : undefined
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (err && /fetch|network/i.test(err.message)) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'
  return fallback
}
