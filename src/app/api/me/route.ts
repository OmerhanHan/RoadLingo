import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth/admin'
import { forgetPlan } from '@/lib/auth/server'
import { accountGuard, serverError } from '@/lib/security/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Deletes the account and everything stored for it (KVKK: right to erasure).
 * Deleting the auth user removes the profile, subscription, payments,
 * writings, feedback and email exercises (on delete cascade). The usage
 * counters are keyed by text ('u:<id>'), so they are removed here first.
 */
export async function DELETE(req: NextRequest) {
  const g = await accountGuard(req, 'account')
  if (!g.ok) return g.response
  const db = supabaseAdmin()
  try {
    const subject = `u:${g.userId}`
    const usage = await db.from('usage_daily').delete().eq('subject', subject)
    if (usage.error) throw usage.error
    const limits = await db.from('rate_limits').delete().like('key', `%:${subject}`)
    if (limits.error) throw limits.error
    const { error } = await db.auth.admin.deleteUser(g.userId)
    if (error) throw error
    forgetPlan(g.userId)
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return serverError('me/delete', err, 'Hesap silinemedi')
  }
}
