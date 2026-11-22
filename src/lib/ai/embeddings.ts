/**
 * Text → vector (server only), with Ollama's nomic-embed-text.
 *
 * One model and one size for every vector in the database: vectors from
 * different models cannot be compared. EMBEDDING_DIMENSIONS must match the
 * vector(256) columns in supabase/migrations; changing the model or the size
 * means recomputing every vector.
 *
 * nomic-embed-text is trained with Matryoshka learning, so its first 256 of
 * 768 numbers keep most of the meaning at a third of the space. It expects a
 * task prefix: "search_document:" for stored texts, "search_query:" for a
 * search typed by the user.
 */

export const EMBEDDING_MODEL = 'nomic-embed-text'
export const EMBEDDING_DIMENSIONS = 256

/** Long enough for a 6000-character essay; the model reads up to 8192 tokens. */
const MAX_INPUT_CHARS = 8000
const TIMEOUT_MS = 20_000

export type EmbedKind = 'document' | 'query'

const PREFIX: Record<EmbedKind, string> = {
  document: 'search_document: ',
  query: 'search_query: ',
}

const baseUrl = () => (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')

/** EMBEDDINGS=0 turns vector work off (e.g. a server without Ollama). */
export const embeddingsEnabled = () => process.env.EMBEDDINGS !== '0'

/** One vector per text, in order. Throws when Ollama is unreachable or answers oddly. */
export async function embedTexts(texts: string[], kind: EmbedKind = 'document'): Promise<number[][]> {
  if (!texts.length) return []
  const res = await fetch(`${baseUrl()}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => PREFIX[kind] + t.slice(0, MAX_INPUT_CHARS)),
      dimensions: EMBEDDING_DIMENSIONS,
      truncate: true,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Ollama embed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { embeddings?: unknown }
  const vectors = data.embeddings
  if (
    !Array.isArray(vectors) ||
    vectors.length !== texts.length ||
    !vectors.every((v) => Array.isArray(v) && v.length === EMBEDDING_DIMENSIONS && v.every(Number.isFinite))
  ) {
    throw new Error('Ollama embed: unexpected answer (is the model pulled? ollama pull nomic-embed-text)')
  }
  return vectors as number[][]
}

/** pgvector's text form, e.g. "[0.1,0.2]". */
export const toPgVector = (v: number[]) => `[${v.join(',')}]`
