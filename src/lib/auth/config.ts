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

/**
 * Same as Supabase's "Password Requirements": lowercase, uppercase letters,
 * digits and symbols. Supabase counts only these characters (ASCII letters,
 * so ç, ş, ğ do not count as letters), and so does this check.
 */
const PASSWORD_RULES: Array<[RegExp, string]> = [
  [/[a-z]/, 'küçük harf'],
  [/[A-Z]/, 'büyük harf'],
  [/[0-9]/, 'rakam'],
  [/[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]/, 'sembol (ör. ! ? * #)'],
]

/** One line for the password field. */
export const PASSWORD_HINT = `En az ${MIN_PASSWORD} karakter; büyük harf, küçük harf, rakam ve sembol`

/** What the password still needs (Turkish sentence), or null when Supabase will accept it. */
export function passwordProblem(password: string): string | null {
  const missing = PASSWORD_RULES.filter(([re]) => !re.test(password)).map(([, label]) => label)
  if (password.length < MIN_PASSWORD) {
    return `Şifre en az ${MIN_PASSWORD} karakter olmalı` + (missing.length ? ` ve şunları içermeli: ${missing.join(', ')}.` : '.')
  }
  return missing.length ? `Şifrede şunlar eksik: ${missing.join(', ')}.` : null
}

/** Same as the profiles_name_length check in the database. */
export const MAX_NAME = 80
