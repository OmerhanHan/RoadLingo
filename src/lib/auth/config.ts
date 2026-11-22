/**
 * Supabase settings shared by the browser and the server.
 *
 * Until a real project is filled in (.env.local), the app keeps the local
 * demo mode: mock sign-in, plan from the browser, in-memory counters.
 * NEXT_PUBLIC_* values are inlined at build time, so they are read literally.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/** New projects call it the publishable key; older ones the anon key. */
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** True once a real project URL and key are set (the .env.example placeholders do not count). */
export const supabaseConfigured = /^https?:\/\/\S+$/.test(SUPABASE_URL) && SUPABASE_PUBLIC_KEY.length >= 30

/** Same as the Supabase setting (Authentication → Providers → Email → Minimum password length). */
export const MIN_PASSWORD = 8

/** Same as the profiles_name_length check in the database. */
export const MAX_NAME = 80
