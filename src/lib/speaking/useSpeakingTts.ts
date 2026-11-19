'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type TtsStatus = 'idle' | 'loading' | 'playing' | 'error'

function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
  return (parts ?? [cleaned]).map((p) => p.trim()).filter((p) => p.length > 1)
}

function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Browser TTS yok'))
      return
    }

    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = 1
    utter.onend = () => resolve()
    utter.onerror = () => reject(new Error('Browser TTS hatası'))

    const voices = window.speechSynthesis.getVoices()
    const en = voices.find((v) => v.lang.startsWith('en') && /Samantha|Karen|Google|Premium|Neural/i.test(v.name))
      ?? voices.find((v) => v.lang.startsWith('en'))
    if (en) utter.voice = en

    window.speechSynthesis.speak(utter)
  })
}

type QueueItem = { text: string; voice?: string }

export type DialogueLine = { text: string; voice?: string }

async function fetchServerTts(
  text: string,
  voice: string | undefined,
  signal?: AbortSignal
): Promise<{ blob: Blob; provider: string; model: string }> {
  const res = await fetch('/api/speaking/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || `TTS HTTP ${res.status}`)
  }
  return {
    blob: await res.blob(),
    provider: res.headers.get('X-TTS-Provider') ?? 'server',
    model: res.headers.get('X-TTS-Model') ?? '',
  }
}

export function useSpeakingTts() {
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState<TtsStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ provider: string; model: string } | null>(null)

  const queueRef = useRef<QueueItem[]>([])
  const playingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    queueRef.current = []
    playingRef.current = false
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setStatus('idle')
  }, [])

  useEffect(() => () => stop(), [stop])

  const playBlob = useCallback((blob: Blob) => {
    return new Promise<void>((resolve, reject) => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('Ses oynatılamadı'))
      void audio.play().catch(reject)
    })
  }, [])

  const drain = useCallback(async () => {
    if (playingRef.current) return
    playingRef.current = true

    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()
      if (!next) break

      const ac = new AbortController()
      abortRef.current = ac
      setStatus('loading')
      setError(null)

      try {
        const { blob, provider, model } = await fetchServerTts(next.text, next.voice, ac.signal)
        setMeta({ provider, model })
        setStatus('playing')
        await playBlob(blob)
      } catch (err) {
        if (ac.signal.aborted) break
        // Fallback: browser SpeechSynthesis
        try {
          setMeta({ provider: 'browser', model: 'speechSynthesis' })
          setStatus('playing')
          await speakBrowser(next.text)
        } catch (browserErr) {
          const message =
            err instanceof Error ? err.message : 'TTS başarısız'
          setError(message)
          setStatus('error')
          console.warn('[tts]', err, browserErr)
          break
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null
      }
    }

    playingRef.current = false
    setStatus((s) => (s === 'error' ? s : 'idle'))
  }, [playBlob])

  const enqueue = useCallback(
    (text: string, opts?: { voice?: string }) => {
      if (!enabled) return
      const chunks = splitSentences(text)
      if (!chunks.length) return
      queueRef.current.push(...chunks.map((c) => ({ text: c, voice: opts?.voice })))
      void drain()
    },
    [drain, enabled]
  )

  const speakFull = useCallback(
    (text: string, opts?: { voice?: string }) => {
      stop()
      enqueue(text, opts)
    },
    [enqueue, stop]
  )

  /** Plays several lines in order, each with its own voice (e.g. a two-person dialogue). */
  const speakDialogue = useCallback(
    (lines: DialogueLine[]) => {
      stop()
      for (const line of lines) enqueue(line.text, { voice: line.voice })
    },
    [enqueue, stop]
  )

  return {
    enabled,
    setEnabled,
    status,
    error,
    meta,
    enqueue,
    speakFull,
    speakDialogue,
    stop,
    isSpeaking: status === 'loading' || status === 'playing',
  }
}
