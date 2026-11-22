/**
 * Database rows → the shapes the screens use (shared by the browser and the server).
 */
import type { Feedback, GrammarError, Writing } from '@/lib/supabase'
import type { EmailExercise } from '@/lib/emailStorage'
import type { EmailAnalysis, EmailCategory } from '@/lib/emailAnalysis'

type ScoreSource = 'ai' | 'mock' | 'import'

export type FeedbackRow = {
  band_score: number | string
  grammar_score: number
  coherence_score: number
  vocabulary_score: number
  grammar_errors: GrammarError[]
  suggestions: string[]
  overall_comment: string
  source: ScoreSource
  created_at: string
}

export type WritingRow = {
  id: string
  user_id: string
  mode: Writing['mode']
  topic: string
  content: string
  word_count: number
  created_at: string
  // One-to-one embed: PostgREST returns an object (or null); an array is accepted too.
  writing_feedback: FeedbackRow | FeedbackRow[] | null
}

export const FEEDBACK_COLUMNS =
  'band_score, grammar_score, coherence_score, vocabulary_score, grammar_errors, suggestions, overall_comment, source, created_at'

export const WRITING_SELECT = `id, user_id, mode, topic, content, word_count, created_at, writing_feedback(${FEEDBACK_COLUMNS})`

export function toWriting(row: WritingRow): Writing {
  const fb = Array.isArray(row.writing_feedback) ? row.writing_feedback[0] : row.writing_feedback
  const feedback: Feedback | undefined = fb
    ? {
        id: row.id,
        writing_id: row.id,
        band_score: Number(fb.band_score),
        grammar_score: fb.grammar_score,
        coherence_score: fb.coherence_score,
        vocabulary_score: fb.vocabulary_score,
        grammar_errors: fb.grammar_errors ?? [],
        suggestions: fb.suggestions ?? [],
        overall_comment: fb.overall_comment,
        created_at: fb.created_at,
        source: fb.source,
      }
    : undefined
  return {
    id: row.id,
    user_id: row.user_id,
    mode: row.mode,
    topic: row.topic,
    content: row.content,
    word_count: row.word_count,
    created_at: row.created_at,
    has_feedback: Boolean(feedback),
    feedback,
  }
}

export type EmailExerciseRow = {
  id: string
  scenario_id: string
  category: EmailCategory
  title_tr: string
  recipient: string
  subject: string
  body: string
  word_count: number
  analysis: EmailAnalysis | null
  analysis_source: ScoreSource | null
  created_at: string
}

export const EMAIL_SELECT =
  'id, scenario_id, category, title_tr, recipient, subject, body, word_count, analysis, analysis_source, created_at'

export function toEmailExercise(row: EmailExerciseRow): EmailExercise {
  return {
    id: row.id,
    scenario_id: row.scenario_id,
    category: row.category,
    title_tr: row.title_tr,
    to: row.recipient,
    subject: row.subject,
    body: row.body,
    word_count: row.word_count,
    analysis: row.analysis,
    analysis_source: row.analysis_source,
    created_at: row.created_at,
  }
}
