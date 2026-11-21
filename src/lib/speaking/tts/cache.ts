/**
 * Disk cache for synthesized speech (server only). The same text + voice is
 * synthesized once and then served from disk — banked listening content and
 * dialogue lines are identical for every user, so most requests become hits.
 *
 * Env: TTS_CACHE_DIR (default .cache/tts), TTS_CACHE_MAX_MB (default 500, 0 = off).
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { TtsResult } from './types'

const dir = () => path.resolve(process.env.TTS_CACHE_DIR || path.join(process.cwd(), '.cache', 'tts'))
const maxBytes = () => {
  const mb = Number(process.env.TTS_CACHE_MAX_MB ?? 500)
  return Number.isFinite(mb) ? mb * 1024 * 1024 : 0
}

export function ttsCacheEnabled() {
  return maxBytes() > 0
}

export function ttsCacheKey(text: string, voice: string | undefined, provider: string): string {
  return crypto.createHash('sha1').update(`${provider}|${voice ?? ''}|${text}`).digest('hex')
}

type Meta = Omit<TtsResult, 'audio'>

export function readTtsCache(key: string): TtsResult | null {
  if (!ttsCacheEnabled()) return null
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir(), `${key}.json`), 'utf8')) as Meta
    const audio = fs.readFileSync(path.join(dir(), `${key}.audio`))
    return { ...meta, audio }
  } catch {
    return null
  }
}

let writesSincePrune = 0

export function writeTtsCache(key: string, result: TtsResult) {
  if (!ttsCacheEnabled()) return
  try {
    fs.mkdirSync(dir(), { recursive: true })
    const { audio, ...meta } = result
    fs.writeFileSync(path.join(dir(), `${key}.audio`), audio)
    fs.writeFileSync(path.join(dir(), `${key}.json`), JSON.stringify(meta))
    if (++writesSincePrune >= 50) {
      writesSincePrune = 0
      pruneTtsCache()
    }
  } catch (err) {
    console.warn('[tts-cache] write failed:', err instanceof Error ? err.message : err)
  }
}

/** Deletes the oldest entries until the cache is under its size limit. */
export function pruneTtsCache() {
  const limit = maxBytes()
  try {
    const files = fs
      .readdirSync(dir())
      .filter((f) => f.endsWith('.audio'))
      .map((f) => {
        const st = fs.statSync(path.join(dir(), f))
        return { key: f.slice(0, -6), size: st.size, time: st.atimeMs || st.mtimeMs }
      })
      .sort((a, b) => a.time - b.time)
    let total = files.reduce((n, f) => n + f.size, 0)
    for (const f of files) {
      if (total <= limit) break
      fs.rmSync(path.join(dir(), `${f.key}.audio`), { force: true })
      fs.rmSync(path.join(dir(), `${f.key}.json`), { force: true })
      total -= f.size
    }
  } catch {
    /* cache dir missing: nothing to prune */
  }
}
