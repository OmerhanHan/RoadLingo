import { getSpeakingProvider } from '@/lib/speaking/providers'
import type { ChatMessage } from '@/lib/speaking/types'

const GENERATION_TIMEOUT_MS = 90_000

/**
 * Runs a single non-streaming completion through the configured AI provider
 * (Ollama by default) by collecting the streamed tokens.
 */
/** Output-token caps per kind of call (generous enough for valid JSON). */
export const MAX_TOKENS = {
  content: 2500,
  scoring: 1200,
} as const

export async function generateText(
  messages: ChatMessage[],
  signal?: AbortSignal,
  maxTokens: number = MAX_TOKENS.content,
  /** false skips hidden reasoning so it cannot eat the token cap (used for scoring). */
  think?: boolean
): Promise<string> {
  const timeout = AbortSignal.timeout(GENERATION_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  const provider = getSpeakingProvider()
  let text = ''
  for await (const chunk of provider.streamChat(messages, { signal: combined, maxTokens, think })) {
    if (chunk.type === 'error') throw new Error(chunk.error)
    if (chunk.type === 'token') text += chunk.content
    if (chunk.type === 'done') break
  }
  if (!text.trim()) throw new Error('AI returned an empty response')
  return text
}

/** Pulls the first JSON object out of a model reply (handles code fences / think tags). */
export function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('No JSON object in AI response')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export const LEVEL_GUIDE: Record<string, string> = {
  B1: 'CEFR B1 (intermediate): common everyday vocabulary, simple and compound sentences.',
  B2: 'CEFR B2 (upper-intermediate): some academic vocabulary, a mix of simple and complex sentences.',
  C1: 'CEFR C1 (advanced): academic vocabulary, complex sentences with subordinate clauses.',
}
