import { NextRequest, NextResponse } from 'next/server'
import { usageFor } from '@/lib/usage/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Today's AI usage and limits for this device (shown on the plans page). */
export function GET(req: NextRequest) {
  return NextResponse.json(usageFor(req), { headers: { 'Cache-Control': 'no-store' } })
}
