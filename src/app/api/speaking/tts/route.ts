import { NextRequest, NextResponse } from 'next/server'
import { getTtsConfig, synthesizeWithFallback } from '@/lib/speaking/tts'
import { readTtsCache, ttsCacheKey, writeTtsCache } from '@/lib/speaking/tts/cache'
import { consumeBudget, refundBudget } from '@/lib/usage/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  text?: string
  provider?: string
  /** Optional voice name (pocket-tts only, e.g. "marius", "alba"). */
  voice?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const config = getTtsConfig()

    if (!text) {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }

    if (text.length > config.maxChars) {
      return NextResponse.json(
        { error: `text too long (max ${config.maxChars})` },
        { status: 400 }
      )
    }

    // The provider is the server's choice (TTS_PROVIDER) in production: a client
    // must not be able to pick a paid voice (openai). Outside production it can
    // still be overridden for testing.
    const prefer =
      process.env.NODE_ENV !== 'production' &&
      (body.provider === 'pocket' ||
        body.provider === 'piper' ||
        body.provider === 'macos' ||
        body.provider === 'openai')
        ? body.provider
        : undefined

    const voice =
      typeof body.voice === 'string' && /^[a-z_]{2,32}$/.test(body.voice) ? body.voice : undefined

    // Same text + voice → served from the disk cache instead of re-synthesizing.
    const wanted = prefer ?? config.provider
    const cacheKey = ttsCacheKey(text, voice, wanted)
    const cached = readTtsCache(cacheKey)

    // Cached audio costs nothing; only new synthesis counts against the daily
    // character budget. Past it the clients fall back to the browser voice.
    if (!cached && !consumeBudget(req, 'ttsChars', text.length)) {
      return NextResponse.json(
        { error: 'Bugünkü sunucu sesi sınırı doldu; tarayıcı sesi kullanılacak.', code: 'tts_limit' },
        { status: 429, headers: { 'Retry-After': '3600' } }
      )
    }

    let result
    try {
      result =
        cached ??
        (await synthesizeWithFallback(text, {
          signal: req.signal,
          prefer,
          voice,
        }))
    } catch (err) {
      if (!cached) refundBudget(req, 'ttsChars', text.length)
      throw err
    }
    // Only cache the intended provider's voice, not a lower-quality fallback.
    if (!cached && result.provider === wanted) writeTtsCache(cacheKey, result)

    return new NextResponse(new Uint8Array(result.audio), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'no-store',
        'X-TTS-Provider': result.provider,
        'X-TTS-Model': result.model,
        'X-TTS-Cache': cached ? 'hit' : 'miss',
      },
    })
  } catch (err) {
    console.error('[speaking/tts]', err)
    return NextResponse.json(
      {
        error: 'TTS failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
