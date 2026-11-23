import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/auth/admin'
import { accountGuard, badRequest, readJson, serverError, textField } from '@/lib/security/guard'
import { MAX_ESSAY_CHARS, MAX_TOPIC_CHARS, countWords } from '@/lib/scoring/server'
import { WRITING_SELECT, toWriting, type WritingRow } from '@/lib/data/rows'
import { embedInBackground } from '@/lib/vectors/writings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Saves a writing to the account (Supabase mode). Only the text is taken from
 * the browser; the word count and the date are set here, and the score comes
 * later from /api/writings/[id]/feedback. Its vector is made after the
 * answer is sent (the user does not wait for it).
 */
export async function POST(req: NextRequest) {
  const g = await accountGuard(req, 'data')
  if (!g.ok) return g.response
  const parsed = await readJson<{ mode?: unknown; topic?: unknown; content?: unknown }>(req)
  if (!parsed.ok) return parsed.response

  const mode = parsed.body.mode
  const topic = textField(parsed.body.topic, MAX_TOPIC_CHARS)
  const content = textField(parsed.body.content, MAX_ESSAY_CHARS)
  if (mode !== 'predetermined' && mode !== 'random') return badRequest('Geçersiz yazı türü')
  if (topic === null) return badRequest('Konu çok uzun')
  if (content === null) return badRequest('Metin çok uzun')
  if (!topic || !content) return badRequest('Konu ve metin gerekli')

  try {
    const { data, error } = await supabaseAdmin()
      .from('writings')
      .insert({ user_id: g.userId, mode, topic, content, word_count: countWords(content) })
      .select(WRITING_SELECT)
      .single<WritingRow>()
    if (error) throw error
    after(() => embedInBackground([data.id]))
    return NextResponse.json(toWriting(data), { status: 201 })
  } catch (err) {
    return serverError('writings', err, 'Yazı kaydedilemedi')
  }
}
