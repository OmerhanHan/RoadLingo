'use client'
import { useEffect, useState } from 'react'
import { getSubscription, SUBSCRIPTION_EVENT, type SubscriptionState } from '@/lib/plans'

/**
 * The current subscription, kept up to date. With Supabase it arrives from
 * the server shortly after sign-in and changes after a checkout or cancel;
 * both fire SUBSCRIPTION_EVENT.
 *
 * Only for components rendered client-only (AppLayout waits for auth), so
 * reading localStorage in the initial state is safe.
 */
export function useSubscription(): SubscriptionState {
  const [sub, setSub] = useState(() => getSubscription())
  useEffect(() => {
    const refresh = () => setSub(getSubscription())
    window.addEventListener(SUBSCRIPTION_EVENT, refresh)
    return () => window.removeEventListener(SUBSCRIPTION_EVENT, refresh)
  }, [])
  return sub
}
