import { supabaseBrowser } from '@/lib/auth/client'

/** The shared browser Supabase client (see src/lib/auth/client.ts). */
export function createClient() {
  return supabaseBrowser()
}

export type Writing = {
  id: string
  user_id: string
  mode: 'predetermined' | 'random'
  topic: string
  content: string
  word_count: number
  created_at: string
  has_feedback: boolean
  feedback?: Feedback
}

export type Feedback = {
  id: string
  writing_id: string
  grammar_score: number
  band_score: number
  coherence_score: number
  vocabulary_score: number
  grammar_errors: GrammarError[]
  suggestions: string[]
  overall_comment: string
  created_at: string
}

export type GrammarError = {
  word: string
  suggestion: string
  explanation: string
}

export type Profile = {
  id: string
  username: string
  avatar_url: string | null
  created_at: string
}
