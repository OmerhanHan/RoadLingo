'use client'
import { useSyncExternalStore } from 'react'

/** Returned during SSR / hydration, before localStorage can be read. */
export const STORED_SSR = '__ssr__'

const noopSubscribe = () => () => {}

/** Reads a localStorage key without hydration mismatch (server snapshot = STORED_SSR). */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => STORED_SSR
  )
}
