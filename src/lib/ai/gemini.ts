/**
 * Gemini model used by scoring (analyze, analyze/email) and topic generation.
 * Google retires model names regularly (gemini-1.5-flash and gemini-2.0-flash
 * are gone), so the name lives here and can be changed with GEMINI_MODEL
 * without touching the routes. Check https://ai.google.dev/gemini-api/docs/deprecations
 * before changing the default.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

/** Tried when the main model is busy (503) or slow. GEMINI_FALLBACK_MODEL=off disables it. */
export const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.6-flash'

export function geminiFallbackModel(): string | null {
  const value = process.env.GEMINI_FALLBACK_MODEL?.trim()
  if (value === 'off') return null
  return value || DEFAULT_GEMINI_FALLBACK_MODEL
}
