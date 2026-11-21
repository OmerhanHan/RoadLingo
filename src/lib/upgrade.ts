/**
 * Client-side handling of the server's daily-limit responses (429 quota_exceeded).
 *
 * Any screen that calls a paid AI endpoint runs `throwIfQuota(res)`: it opens
 * the upgrade prompt (rendered once in the app layout) and throws a
 * QuotaError so callers stop instead of falling back to mock results.
 */
import type { LimitKind } from '@/lib/plans'

export const QUOTA_EVENT = 'roadlingo:quota-exceeded'

export type QuotaEventDetail = { kind: LimitKind | null; message: string }

export class QuotaError extends Error {
  readonly kind: LimitKind | null
  constructor(detail: QuotaEventDetail) {
    super(detail.message)
    this.name = 'QuotaError'
    this.kind = detail.kind
  }
}

const KINDS: LimitKind[] = ['scoring', 'chat', 'generation']

/** Opens the upgrade prompt. */
export function reportQuota(detail: QuotaEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<QuotaEventDetail>(QUOTA_EVENT, { detail }))
}

/** Shows the upgrade prompt and throws a QuotaError if `res` is a daily-limit response. */
export async function throwIfQuota(res: Response): Promise<void> {
  if (res.status !== 429) return
  const body = (await res.clone().json().catch(() => ({}))) as { code?: string; kind?: string; error?: string }
  if (body.code !== 'quota_exceeded') return
  const detail: QuotaEventDetail = {
    kind: KINDS.includes(body.kind as LimitKind) ? (body.kind as LimitKind) : null,
    message: body.error || 'Bugünkü hakkın doldu.',
  }
  reportQuota(detail)
  throw new QuotaError(detail)
}

/** Plans page link that returns the user to where they were after upgrading. */
export function plansHref(from?: string) {
  return from && from.startsWith('/app/') && !from.startsWith('/app/plans')
    ? `/app/plans?from=${encodeURIComponent(from)}`
    : '/app/plans'
}
