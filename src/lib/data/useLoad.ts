'use client'
import { useEffect, useRef, useState } from 'react'

type State<T> = { key: string | null; data?: T; error?: string }

/**
 * Loads data for a screen and reloads when `key` changes (null: do not load).
 * Answers that arrive after the key changed or the screen closed are dropped.
 */
export function useLoad<T>(key: string | null, load: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ key: null })
  const [version, setVersion] = useState(0)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null) return
    let alive = true
    loadRef.current().then(
      (data) => alive && setState({ key, data }),
      (err: unknown) => {
        console.warn('[load]', key, err)
        if (alive) setState({ key, error: err instanceof Error ? err.message : String(err) })
      }
    )
    return () => {
      alive = false
    }
  }, [key, version])

  const current: State<T> = state.key === key ? state : { key }
  return {
    data: current.data,
    error: current.error ?? null,
    loading: key !== null && current.data === undefined && current.error === undefined,
    reload: () => setVersion((v) => v + 1),
  }
}
