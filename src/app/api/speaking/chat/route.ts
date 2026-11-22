import type { NextRequest } from 'next/server'
import { getSpeakingConfig } from '@/lib/speaking/config'
import { SPEAKING_SYSTEM_PROMPT } from '@/lib/speaking/prompts'
import { getSpeakingProvider } from '@/lib/speaking/providers'
import { buildTopicSystemPrompt, getTopic, TOPIC_TOTAL_ANSWERS } from '@/lib/speaking/topics'
import { SSE_HEADERS, streamChunksToSse } from '@/lib/speaking/sse'
import type { ChatMessage } from '@/lib/speaking/types'
import { consumeQuota, quotaExceeded } from '@/lib/usage/quota'
import { badRequest, guard, readJson, serverError } from '@/lib/security/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Only the most recent turns are sent to the model (the stage plan lives in the system prompt). */
const HISTORY_MESSAGES = 8
/** Caps one learner message (a long dictation should not blow up the prompt). */
const MAX_MESSAGE_CHARS = 1500
/** Replies are meant to be 2–4 spoken sentences. */
const MAX_REPLY_TOKENS = 260
/** Messages accepted in one request (only the last HISTORY_MESSAGES are used). */
const MAX_INCOMING_MESSAGES = 40

type Body = {
  messages?: Array<{ role?: string; content?: string }>
  /** Optional category conversation (history, literature, art, sports). */
  topic?: string
  /** Number of answers the student has given so far. */
  step?: number
}

function isRole(value: unknown): value is ChatMessage['role'] {
  return value === 'system' || value === 'user' || value === 'assistant'
}

export async function POST(req: NextRequest) {
  const denied = await guard(req, 'ai', { auth: true })
  if (denied) return denied
  const parsed = await readJson<Body>(req, 64_000)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  try {
    const incoming = Array.isArray(body.messages) ? body.messages.slice(-MAX_INCOMING_MESSAGES) : []

    const messages: ChatMessage[] = incoming
      .filter((m) => isRole(m.role) && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({
        role: m.role as ChatMessage['role'],
        content: (m.content as string).trim().slice(0, MAX_MESSAGE_CHARS),
      }))

    if (messages.length === 0) return badRequest('messages required')

    const quota = await consumeQuota(req, 'chat')
    if (!quota.ok) return quotaExceeded('chat', quota.limit)

    const topic = getTopic(body.topic)
    const step = Math.max(0, Math.min(TOPIC_TOTAL_ANSWERS, Math.floor(Number(body.step) || 0)))
    const systemPrompt = topic ? buildTopicSystemPrompt(topic, step) : SPEAKING_SYSTEM_PROMPT

    // The system prompt is always decided server-side.
    const withSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.filter((m) => m.role !== 'system').slice(-HISTORY_MESSAGES),
    ]

    const config = getSpeakingConfig()
    const provider = getSpeakingProvider()
    const stream = streamChunksToSse(
      provider.streamChat(withSystem, { signal: req.signal, maxTokens: MAX_REPLY_TOKENS, think: false }),
      req.signal
    )

    return new Response(stream, {
      headers: {
        ...SSE_HEADERS,
        'X-Speaking-Provider': provider.id,
        'X-Speaking-Model':
          config.provider === 'ollama'
            ? config.ollama.model
            : config.provider === 'openai'
              ? config.openai.model
              : config.gemini.model,
      },
    })
  } catch (err) {
    return serverError('speaking/chat', err, 'Konuşma başlatılamadı')
  }
}
