/**
 * The user's work, as the screens see it (browser).
 *
 * Supabase mode: writings and email exercises live on the server. Reads go
 * straight to Supabase (row level security shows only the user's own rows);
 * saving and scoring go through the API, because only the server may write a
 * score. Demo mode: everything stays in this browser (src/lib/storage.ts,
 * src/lib/emailStorage.ts), as before.
 */
import { supabaseConfigured } from '@/lib/auth/config'
import { supabaseBrowser } from '@/lib/auth/client'
import { planHeaders } from '@/lib/plans'
import { reportQuota, throwIfQuota } from '@/lib/upgrade'
import { analyzeWriting } from '@/lib/mockAI'
import { analyzeEmail, type EmailScenario } from '@/lib/emailAnalysis'
import type { Writing } from '@/lib/supabase'
import {
  computeStats,
  getWritingById,
  getWritings,
  saveWriting,
  updateWritingFeedback,
  type WritingStats,
} from '@/lib/storage'
import { getEmailExercises, saveEmailExercise, type EmailExercise } from '@/lib/emailStorage'
import {
  EMAIL_SELECT,
  WRITING_SELECT,
  toEmailExercise,
  toWriting,
  type EmailExerciseRow,
  type WritingRow,
} from './rows'

/** True when the work is kept on the server (Supabase configured). */
export const cloudData = supabaseConfigured

/** Enough for the lists and the stats; older items are still kept. */
const LIST_LIMIT = 500

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...planHeaders(), ...init.headers },
  })
  await throwIfQuota(res)
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

/* ── Writings ── */

export async function listWritings(): Promise<Writing[]> {
  if (!cloudData) return getWritings()
  const { data, error } = await supabaseBrowser()
    .from('writings')
    .select(WRITING_SELECT)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
    .returns<WritingRow[]>()
  if (error) throw new Error(error.message)
  return (data ?? []).map(toWriting)
}

export async function getWriting(id: string): Promise<Writing | null> {
  if (!cloudData) return getWritingById(id)
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await supabaseBrowser()
    .from('writings')
    .select(WRITING_SELECT)
    .eq('id', id)
    .maybeSingle<WritingRow>()
  if (error) throw new Error(error.message)
  return data ? toWriting(data) : null
}

export async function loadStats(): Promise<WritingStats> {
  return computeStats(await listWritings())
}

export async function createWriting(input: { mode: Writing['mode']; topic: string; content: string }): Promise<Writing> {
  if (!cloudData) {
    const word_count = input.content.trim().split(/\s+/).filter(Boolean).length
    return saveWriting({ ...input, user_id: '', word_count, has_feedback: false })
  }
  return api<Writing>('/api/writings', { method: 'POST', body: JSON.stringify(input) })
}

/** Scores a saved writing and returns it with its feedback. Throws QuotaError at the daily limit. */
export async function scoreWriting(writing: Writing): Promise<Writing> {
  if (!cloudData) {
    const feedback = await analyzeWriting(writing.content, writing.topic)
    updateWritingFeedback(writing.id, feedback)
    return getWritingById(writing.id) ?? { ...writing, has_feedback: true, feedback }
  }
  return api<Writing>(`/api/writings/${writing.id}/feedback`, { method: 'POST', body: '{}' })
}

export type SimilarWriting = {
  id: string
  topic: string
  created_at: string
  band_score: number | null
  similarity: number
}

/** The user's earlier writings closest in meaning (Supabase mode; by vector). */
export async function listSimilarWritings(id: string): Promise<SimilarWriting[]> {
  if (!cloudData) return []
  const res = await api<{ similar: SimilarWriting[] }>(`/api/writings/${id}/similar`)
  return res.similar
}

/* ── Email exercises ── */

export async function listEmailExercises(): Promise<EmailExercise[]> {
  if (!cloudData) return getEmailExercises()
  const { data, error } = await supabaseBrowser()
    .from('email_exercises')
    .select(EMAIL_SELECT)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
    .returns<EmailExerciseRow[]>()
  if (error) throw new Error(error.message)
  return (data ?? []).map(toEmailExercise)
}

export type EmailSubmission = { exercise: EmailExercise; error: string | null }

/**
 * Saves a finished email and scores it. The email is kept even if scoring
 * fails; `error` then says why (the daily limit also opens the upgrade prompt).
 */
export async function submitEmailExercise(params: {
  scenario: EmailScenario
  to: string
  subject: string
  body: string
}): Promise<EmailSubmission> {
  const { scenario: sc, to, subject, body } = params
  const scenarioText = `${sc.subject}\n${sc.prompt}`

  if (!cloudData) {
    let analysis = null
    let error: string | null = null
    try {
      analysis = await analyzeEmail({ to, subject, body, scenario: scenarioText })
    } catch (e) {
      error = e instanceof Error && e.name === 'QuotaError' ? e.message : 'Analiz tamamlanamadı. Tekrar deneyebilirsin.'
    }
    const exercise = saveEmailExercise({
      scenario_id: sc.id,
      category: sc.category,
      title_tr: sc.title_tr,
      to,
      subject,
      body,
      word_count: body.trim().split(/\s+/).filter(Boolean).length,
      analysis,
    })
    return { exercise, error }
  }

  const res = await api<{ exercise: EmailExercise; error: string | null; quota: { kind: 'scoring' } | null }>(
    '/api/email-exercises',
    {
      method: 'POST',
      body: JSON.stringify({
        scenario_id: sc.id,
        category: sc.category,
        title_tr: sc.title_tr,
        scenario: scenarioText,
        to,
        subject,
        body,
      }),
    }
  )
  if (res.quota && res.error) reportQuota({ kind: 'scoring', message: res.error })
  return { exercise: res.exercise, error: res.error }
}
