import { NextRequest, NextResponse } from 'next/server'
import { usageFor } from '@/lib/usage/quota'
import { rateLimit } from '@/lib/security/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Today's AI usage and limits for the caller (shown on the plans page). */
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, 'content')
  if (limited) return limited
  return NextResponse.json(await usageFor(req), { headers: { 'Cache-Control': 'no-store' } })
}
