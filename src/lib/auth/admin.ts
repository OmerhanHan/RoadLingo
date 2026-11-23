/**
 * Server-only Supabase client with the secret key. It bypasses Row Level
 * Security, so it must never be imported from client code.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, supabaseConfigured } from './config'

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/** Server-side Supabase mode: a real project plus the secret key. */
export const serverSupabaseEnabled = supabaseConfigured && SECRET_KEY.length >= 30

if (supabaseConfigured && !serverSupabaseEnabled && typeof window === 'undefined') {
  console.error(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL is set but SUPABASE_SECRET_KEY is missing: plans and usage stay in demo mode.'
  )
}

let client: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!serverSupabaseEnabled) throw new Error('Supabase server mode is not configured')
  client ??= createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return client
}
