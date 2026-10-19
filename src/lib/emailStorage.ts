import type { EmailAnalysis } from './emailAnalysis'
import type { EmailCategory } from './emailAnalysis'

const EMAIL_EXERCISES_KEY = 'writer_email_exercises'

export type EmailExercise = {
  id: string
  scenario_id: string
  category: EmailCategory
  title_tr: string
  to: string
  subject: string
  body: string
  word_count: number
  analysis: EmailAnalysis | null
  created_at: string
}

export function getEmailExercises(): EmailExercise[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(EMAIL_EXERCISES_KEY) || '[]')
  } catch {
    return []
  }
}

export function getEmailExerciseById(id: string): EmailExercise | null {
  return getEmailExercises().find(e => e.id === id) || null
}

export function saveEmailExercise(
  exercise: Omit<EmailExercise, 'id' | 'created_at'>,
): EmailExercise {
  const list = getEmailExercises()
  const saved: EmailExercise = {
    ...exercise,
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  }
  list.unshift(saved)
  localStorage.setItem(EMAIL_EXERCISES_KEY, JSON.stringify(list))
  return saved
}

export function updateEmailExerciseAnalysis(id: string, analysis: EmailAnalysis): void {
  const list = getEmailExercises()
  const idx = list.findIndex(e => e.id === id)
  if (idx === -1) return
  list[idx].analysis = analysis
  localStorage.setItem(EMAIL_EXERCISES_KEY, JSON.stringify(list))
}
