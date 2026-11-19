import fs from 'fs'
import os from 'os'
import path from 'path'

export type TtsProviderId = 'pocket' | 'piper' | 'macos' | 'openai' | 'browser'

export type TtsConfig = {
  provider: TtsProviderId
  pocket: {
    baseUrl: string
    voice: string
    timeoutMs: number
  }
  piper: {
    bin: string
    modelPath: string
    pythonBin: string
  }
  macos: {
    voice: string
    rate: number
  }
  openai: {
    apiKey: string | null
    model: string
    voice: string
  }
  maxChars: number
}

function env(name: string, fallback?: string): string | undefined {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  return value
}

function resolvePiperBin(configured?: string): string {
  if (configured && configured !== 'piper' && fs.existsSync(configured)) {
    return configured
  }

  const home = os.homedir()
  const candidates = [
    configured,
    'piper',
    path.join(home, 'Library/Python/3.11/bin/piper'),
    path.join(home, 'Library/Python/3.12/bin/piper'),
    path.join(home, 'Library/Python/3.13/bin/piper'),
    path.join(home, '.local/bin/piper'),
    '/opt/homebrew/bin/piper',
    '/usr/local/bin/piper',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (candidate === 'piper') continue
    if (fs.existsSync(candidate)) return candidate
  }

  return configured || 'piper'
}

export function getTtsConfig(): TtsConfig {
  const provider = (env('TTS_PROVIDER', 'pocket') ?? 'pocket') as TtsProviderId
  const defaultModel = path.join(process.cwd(), 'models', 'tts', 'en_US-ryan-high.onnx')

  return {
    provider,
    pocket: {
      baseUrl: env('TTS_POCKET_URL', 'http://127.0.0.1:8765')!,
      voice: env('TTS_POCKET_VOICE', 'marius')!,
      timeoutMs: Number(env('TTS_POCKET_TIMEOUT_MS', '30000') ?? '30000'),
    },
    piper: {
      bin: resolvePiperBin(env('TTS_PIPER_BIN', 'piper')),
      modelPath: env('TTS_PIPER_MODEL', defaultModel)!,
      pythonBin: env('TTS_PYTHON_BIN', 'python3')!,
    },
    macos: {
      voice: env('TTS_MACOS_VOICE', 'Eddy')!,
      rate: Number(env('TTS_MACOS_RATE', '175') ?? '175'),
    },
    openai: {
      apiKey: env('OPENAI_API_KEY') ?? null,
      model: env('TTS_OPENAI_MODEL', 'gpt-4o-mini-tts')!,
      voice: env('TTS_OPENAI_VOICE', 'alloy')!,
    },
    maxChars: Number(env('TTS_MAX_CHARS', '1200') ?? '1200'),
  }
}
