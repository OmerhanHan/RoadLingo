/**
 * The signed-in user's current access token, kept in sync by AuthProvider
 * (Supabase refreshes it in the background). Kept apart from the Supabase
 * client so request helpers can read it synchronously without loading it.
 */
let token: string | null = null

export function setAccessToken(value: string | null) {
  token = value
}

export function accessToken(): string | null {
  return token
}
