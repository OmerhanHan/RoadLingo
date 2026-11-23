/**
 * Account-level data in the browser: onboarding choices and the one-time
 * move of old browser data to the account.
 *
 * The screens keep reading the choices from localStorage (selectedExam,
 * targetScore, placementResult), which works offline and without a round
 * trip. With Supabase the profile is the source: it is copied into
 * localStorage at sign-in, every change is written back, and sign-out clears
 * the copy so the next person on the device starts clean.
 */
import { supabaseConfigured } from '@/lib/auth/config'
import { supabaseBrowser } from '@/lib/auth/client'
import { planHeaders } from '@/lib/plans'
import { WRITINGS_KEY } from '@/lib/storage'
import { EMAIL_EXERCISES_KEY } from '@/lib/emailStorage'

const EXAM_KEY = 'selectedExam'
const TARGET_KEY = 'targetScore'
const PLACEMENT_KEY = 'placementResult'

export type Prefs = {
  selectedExam?: 'toefl' | 'ielts' | null
  targetScore?: number | null
  placement?: Record<string, unknown> | null
}

type ProfilePrefsRow = {
  selected_exam: 'toefl' | 'ielts' | null
  target_score: number | string | null
  placement: Record<string, unknown> | null
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

function localPrefs(): ProfilePrefsRow {
  const exam = read(EXAM_KEY)
  const target = Number(read(TARGET_KEY))
  let placement: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(read(PLACEMENT_KEY) ?? 'null') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) placement = parsed as Record<string, unknown>
  } catch {
    placement = null
  }
  return {
    selected_exam: exam === 'toefl' || exam === 'ielts' ? exam : null,
    target_score: read(TARGET_KEY) !== null && Number.isFinite(target) ? target : null,
    placement,
  }
}

function toRow(prefs: Prefs): Partial<ProfilePrefsRow> {
  const row: Partial<ProfilePrefsRow> = {}
  if (prefs.selectedExam !== undefined) row.selected_exam = prefs.selectedExam
  if (prefs.targetScore !== undefined) row.target_score = prefs.targetScore
  if (prefs.placement !== undefined) row.placement = prefs.placement
  return row
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabaseBrowser().auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Saves onboarding choices: at once in this browser, then on the profile
 * (Supabase mode). A failed profile write is retried at the next sign-in,
 * because the local copy is pushed when the profile is still empty.
 */
export async function savePrefs(prefs: Prefs): Promise<void> {
  if (prefs.selectedExam !== undefined) write(EXAM_KEY, prefs.selectedExam)
  if (prefs.targetScore !== undefined) write(TARGET_KEY, prefs.targetScore === null ? null : String(prefs.targetScore))
  if (prefs.placement !== undefined) write(PLACEMENT_KEY, prefs.placement === null ? null : JSON.stringify(prefs.placement))
  if (!supabaseConfigured) return
  try {
    const userId = await currentUserId()
    if (!userId) return
    const { error } = await supabaseBrowser().from('profiles').update(toRow(prefs)).eq('id', userId)
    if (error) throw error
  } catch (err) {
    console.warn('[prefs] could not save to the profile:', (err as { message?: string })?.message ?? err)
  }
}

/** Profile → this browser; or, for an account that has none yet, this browser → profile. */
async function syncPrefs(userId: string) {
  const db = supabaseBrowser()
  const { data, error } = await db
    .from('profiles')
    .select('selected_exam, target_score, placement')
    .eq('id', userId)
    .maybeSingle<ProfilePrefsRow>()
  if (error) throw error
  const local = localPrefs()
  if (data?.selected_exam) {
    write(EXAM_KEY, data.selected_exam)
    write(TARGET_KEY, data.target_score === null ? null : String(Number(data.target_score)))
    write(PLACEMENT_KEY, data.placement ? JSON.stringify(data.placement) : null)
  } else if (local.selected_exam) {
    const { error: upError } = await db.from('profiles').update(local).eq('id', userId)
    if (upError) throw upError
  }
}

function readList(key: string): unknown[] {
  try {
    const parsed = JSON.parse(read(key) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const IMPORT_BATCH = 50

/** Moves writings and email exercises kept in this browser to the account, then removes them here. */
async function importLocalWork() {
  const writings = readList(WRITINGS_KEY)
  const emails = readList(EMAIL_EXERCISES_KEY)
  if (!writings.length && !emails.length) return
  for (let i = 0; i < Math.max(writings.length, emails.length); i += IMPORT_BATCH) {
    const res = await fetch('/api/me/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...planHeaders() },
      body: JSON.stringify({
        writings: writings.slice(i, i + IMPORT_BATCH),
        emails: emails.slice(i, i + IMPORT_BATCH),
      }),
    })
    if (!res.ok) throw new Error(`import failed: HTTP ${res.status}`)
  }
  // Only after every batch is in: a failed import is simply tried again next time.
  write(WRITINGS_KEY, null)
  write(EMAIL_EXERCISES_KEY, null)
}

/** At sign-in (Supabase mode): onboarding choices and the one-time import. Never throws. */
export async function syncAccount(userId: string): Promise<void> {
  const results = await Promise.allSettled([syncPrefs(userId), importLocalWork()])
  for (const r of results) {
    if (r.status === 'rejected') console.warn('[account] sync step failed:', (r.reason as { message?: string })?.message ?? r.reason)
  }
}

/** At sign-out: the copy of the account's choices leaves this browser. */
export function clearAccountCache() {
  for (const key of [EXAM_KEY, TARGET_KEY, PLACEMENT_KEY]) write(key, null)
}

/** After deleting the account or demo data: everything this app keeps in the browser for the user. */
export function clearLocalWork() {
  clearAccountCache()
  write(WRITINGS_KEY, null)
  write(EMAIL_EXERCISES_KEY, null)
}
