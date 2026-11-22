/**
 * Writing vectors (server only): one per writing, made in the background.
 *
 * A writing without a vector is waiting in line. After each save the server
 * makes the new writing's vector and catches up on a few older ones, so
 * writings saved while Ollama was down get their vectors once it is back.
 * Nothing here ever fails a user's request: errors are logged and the work
 * is retried next time.
 */
import { supabaseAdmin } from '@/lib/auth/admin'
import { EMBEDDING_MODEL, embedTexts, embeddingsEnabled, toPgVector } from '@/lib/ai/embeddings'
import { errorMessage } from '@/lib/security/guard'

/** Older writings handled per save, on top of the new one. */
const CATCH_UP = 5

let lastError = 0

function logOnce(err: unknown) {
  // Once a minute is enough to notice (e.g. Ollama is not running).
  if (Date.now() - lastError < 60_000) return
  lastError = Date.now()
  console.warn('[vectors] writing vectors postponed:', errorMessage(err))
}

/** The text a writing's vector is made from. */
const writingText = (w: { topic: string; content: string }) => `${w.topic}\n\n${w.content}`

/** Makes vectors for the given writings (skips any that already have one). Returns how many were made. */
export async function embedWritings(ids: string[]): Promise<number> {
  if (!ids.length || !embeddingsEnabled()) return 0
  const db = supabaseAdmin()
  const { data: rows, error } = await db
    .from('writings')
    .select('id, user_id, topic, content, writing_embeddings(writing_id)')
    .in('id', ids)
  if (error) throw error
  const todo = (rows ?? []).filter((r) => {
    const e = r.writing_embeddings as unknown
    return !e || (Array.isArray(e) && e.length === 0)
  })
  if (!todo.length) return 0
  const vectors = await embedTexts(todo.map(writingText), 'document')
  const { error: upError } = await db.from('writing_embeddings').upsert(
    todo.map((r, i) => ({
      writing_id: r.id,
      user_id: r.user_id,
      model: EMBEDDING_MODEL,
      embedding: toPgVector(vectors[i]),
    })),
    { onConflict: 'writing_id', ignoreDuplicates: true }
  )
  if (upError) throw upError
  return todo.length
}

/** Writings still waiting for a vector, oldest first. */
async function pendingWritings(limit: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin().rpc('writings_missing_embedding', { p_limit: limit })
  if (error) throw error
  return ((data ?? []) as { id: string }[]).map((r) => r.id)
}

/** Background job after a save: the new writings first, then a few that are still waiting. Never throws. */
export async function embedInBackground(newIds: string[] = []): Promise<void> {
  if (!embeddingsEnabled()) return
  try {
    await embedWritings(newIds)
    const waiting = (await pendingWritings(CATCH_UP)).filter((id) => !newIds.includes(id))
    await embedWritings(waiting)
  } catch (err) {
    logOnce(err)
  }
}

export type SimilarWriting = {
  id: string
  topic: string
  created_at: string
  band_score: number | null
  similarity: number
}

/**
 * Below this the writings are about different things. Measured with
 * nomic-embed-text at 256 dimensions: two essays on free university ≈ 0.85,
 * unrelated essays 0.5–0.65.
 */
export const SIMILARITY_FLOOR = 0.75

/** The user's other writings closest in meaning to this one ([] while it has no vector yet). */
export async function similarWritings(userId: string, writingId: string, count = 3): Promise<SimilarWriting[]> {
  const db = supabaseAdmin()
  const { data: matches, error } = await db.rpc('similar_writings', {
    p_user_id: userId,
    p_writing_id: writingId,
    p_count: count,
  })
  if (error) throw error
  const close = ((matches ?? []) as { writing_id: string; similarity: number }[]).filter(
    (m) => m.similarity >= SIMILARITY_FLOOR
  )
  if (!close.length) return []
  const { data: rows, error: rowError } = await db
    .from('writings')
    .select('id, topic, created_at, writing_feedback(band_score, source)')
    .eq('user_id', userId)
    .in('id', close.map((m) => m.writing_id))
  if (rowError) throw rowError
  const byId = new Map((rows ?? []).map((r) => [r.id, r]))
  return close.flatMap((m) => {
    const r = byId.get(m.writing_id)
    if (!r) return []
    const fbRaw = r.writing_feedback as unknown
    const fb = (Array.isArray(fbRaw) ? fbRaw[0] : fbRaw) as { band_score: number | string; source: string } | null
    return [
      {
        id: r.id,
        topic: r.topic,
        created_at: r.created_at,
        band_score: fb && fb.source !== 'mock' ? Number(fb.band_score) : null,
        similarity: Math.round(m.similarity * 100) / 100,
      },
    ]
  })
}
