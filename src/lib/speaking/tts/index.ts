import { getTtsConfig, type TtsProviderId } from './config'
import {
  createMacosSayProvider,
  createOpenAiTtsProvider,
  createPiperProvider,
  createPocketTtsProvider,
} from './providers'
import type { TtsProvider, TtsResult } from './types'

export function getTtsProvider(override?: TtsProviderId): TtsProvider {
  const config = getTtsConfig()
  const id = override ?? config.provider

  switch (id) {
    case 'pocket':
      return createPocketTtsProvider(config.pocket)
    case 'macos':
      return createMacosSayProvider(config.macos)
    case 'openai':
      return createOpenAiTtsProvider(config.openai)
    case 'browser':
      throw new Error('browser TTS yalnızca istemci tarafında çalışır')
    case 'piper':
    default:
      return createPiperProvider(config.piper)
  }
}

/** Try preferred provider, then local fallbacks (pocket → piper → macos). */
export async function synthesizeWithFallback(
  text: string,
  options?: { signal?: AbortSignal; prefer?: TtsProviderId; voice?: string }
): Promise<TtsResult> {
  const config = getTtsConfig()
  const prefer = options?.prefer ?? config.provider
  const chain: TtsProviderId[] = []
  const push = (id: TtsProviderId) => {
    if (id === 'browser') return
    if (!chain.includes(id)) chain.push(id)
  }

  push(prefer)
  push('pocket')
  push('piper')
  push('macos')

  let lastError: Error | null = null

  for (const id of chain) {
    try {
      const provider = getTtsProvider(id)
      return await provider.synthesize(text, { signal: options?.signal, voice: options?.voice })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[tts] ${id} failed:`, lastError.message)
    }
  }

  throw lastError ?? new Error('TTS başarısız')
}

export type { TtsProvider, TtsResult }
export { getTtsConfig }
