'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ClipSegment = { text: string; voice?: string; speaker?: string }

type Prepared = { url: string | null; text: string }

export type ClipPlayerStatus = 'idle' | 'preparing' | 'playing'

function speakBrowser(text: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) return resolve()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    signal.addEventListener('abort', () => { synth.cancel(); resolve() }, { once: true })
    synth.speak(utter)
  })
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(id); resolve() }, { once: true })
  })

/**
 * Pre-synthesizes recordings (clips made of voiced segments) through
 * /api/speaking/tts and plays them back gap-free. Segments are fetched one
 * after another in the background, so playback can start before all are ready.
 * If server TTS fails for a segment, the browser voice reads it instead.
 */
export function useClipPlayer() {
  const [status, setStatus] = useState<ClipPlayerStatus>('idle')
  const [ready, setReady] = useState(0)
  const [total, setTotal] = useState(0)
  /** Index of the segment being played (for highlighting), -1 when idle. */
  const [current, setCurrent] = useState(-1)
  const [fallbackUsed, setFallbackUsed] = useState(false)

  const clipsRef = useRef<Promise<Prepared>[][]>([])
  const urlsRef = useRef<string[]>([])
  const loadAbortRef = useRef<AbortController | null>(null)
  const playAbortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    playAbortRef.current?.abort()
    playAbortRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setCurrent(-1)
    setStatus('idle')
  }, [])

  const reset = useCallback(() => {
    stop()
    loadAbortRef.current?.abort()
    loadAbortRef.current = null
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    urlsRef.current = []
    clipsRef.current = []
    setReady(0)
    setTotal(0)
    setFallbackUsed(false)
  }, [stop])

  useEffect(() => reset, [reset])

  /** Starts synthesizing every segment of every clip, in order. */
  const prepare = useCallback((clips: ClipSegment[][]) => {
    reset()
    const ac = new AbortController()
    loadAbortRef.current = ac
    setTotal(clips.reduce((n, c) => n + c.length, 0))

    let chain: Promise<unknown> = Promise.resolve()
    clipsRef.current = clips.map((segments) =>
      segments.map((seg) => {
        const job = chain.then(async (): Promise<Prepared> => {
          try {
            const res = await fetch('/api/speaking/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: seg.text, voice: seg.voice }),
              signal: ac.signal,
            })
            if (!res.ok) throw new Error(`TTS HTTP ${res.status}`)
            const url = URL.createObjectURL(await res.blob())
            urlsRef.current.push(url)
            return { url, text: seg.text }
          } catch (err) {
            if (!ac.signal.aborted) {
              console.warn('[listening] server TTS failed, using browser voice', err)
              setFallbackUsed(true)
            }
            return { url: null, text: seg.text }
          } finally {
            if (!ac.signal.aborted) setReady((n) => n + 1)
          }
        })
        chain = job
        return job
      })
    )
  }, [reset])

  /** Plays one clip from the start. Resolves when it has finished (or was stopped). */
  const play = useCallback(async (clipIndex = 0): Promise<boolean> => {
    const segments = clipsRef.current[clipIndex]
    if (!segments) return false
    stop()
    const ac = new AbortController()
    playAbortRef.current = ac
    setStatus('playing')

    for (let i = 0; i < segments.length; i++) {
      if (ac.signal.aborted) break
      setCurrent(i)
      const seg = await segments[i]
      if (ac.signal.aborted) break
      if (seg.url) {
        await new Promise<void>((resolve) => {
          const audio = new Audio(seg.url!)
          audioRef.current = audio
          audio.onended = () => resolve()
          audio.onerror = () => resolve()
          ac.signal.addEventListener('abort', () => resolve(), { once: true })
          audio.play().catch(() => resolve())
        })
      } else {
        await speakBrowser(seg.text, ac.signal)
      }
      if (i < segments.length - 1) await pause(250, ac.signal)
    }

    const finished = !ac.signal.aborted
    if (playAbortRef.current === ac) {
      playAbortRef.current = null
      audioRef.current = null
      setCurrent(-1)
      setStatus('idle')
    }
    return finished
  }, [stop])

  return { status, ready, total, current, fallbackUsed, prepare, play, stop, reset }
}
