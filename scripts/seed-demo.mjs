#!/usr/bin/env node
/**
 * Fills a test account with fake work (scripts/seed/demo-data.mjs): 15 essays
 * at real length, 13 of them with a sample score, and 3 email exercises. Also
 * makes the writing vectors with Ollama and reports how similar related and
 * unrelated essays come out, to check the "similar writings" threshold.
 *
 *   npm run seed:demo                          # deneme@roaddash.test
 *   npm run seed:demo -- --email x@roaddash.test
 *   npm run seed:demo -- --reset               # remove the seeded rows
 *
 * Only @roaddash.test accounts are accepted, so real users are never touched.
 * Running it again adds nothing twice (rows are keyed by local_id "seed-…").
 * Needs .env.local (Supabase URL and secret key) and, for vectors, Ollama.
 */
import { createClient } from '@supabase/supabase-js'
import { EMAILS, WRITINGS } from './seed/demo-data.mjs'

const EMBEDDING_MODEL = 'nomic-embed-text'
const EMBEDDING_DIMENSIONS = 256
/** Same as SIMILARITY_FLOOR in src/lib/vectors/writings.ts. */
const SIMILAR_THRESHOLD = 0.7

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}

const email = String(arg('email', 'deneme@roaddash.test')).toLowerCase()
const reset = arg('reset', false) === true
if (!email.endsWith('@roaddash.test')) {
  console.error('Only @roaddash.test accounts can be seeded.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (run with --env-file=.env.local).')
  process.exit(1)
}
const db = createClient(url, secret, { auth: { persistSession: false } })

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000 - Math.floor(Math.random() * 6) * 3_600_000).toISOString()
const fail = (what, error) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

async function findUser(address) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    fail('list users', error)
    const user = data.users.find((u) => u.email?.toLowerCase() === address)
    if (user) return user
    if (data.users.length < 200) return null
  }
  return null
}

async function embed(texts) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
  const res = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => 'search_document: ' + t),
      dimensions: EMBEDDING_DIMENSIONS,
      truncate: true,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`Ollama: HTTP ${res.status}`)
  return (await res.json()).embeddings
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / Math.sqrt(na * nb)
}

const user = await findUser(email)
if (!user) {
  console.error(`No account ${email}. Create it first.`)
  process.exit(1)
}
const userId = user.id

if (reset) {
  const w = await db.from('writings').delete({ count: 'exact' }).eq('user_id', userId).like('local_id', 'seed-%')
  fail('delete writings', w.error)
  const e = await db.from('email_exercises').delete({ count: 'exact' }).eq('user_id', userId).like('local_id', 'seed-%')
  fail('delete emails', e.error)
  console.log(`Removed ${w.count} writings and ${e.count} email exercises from ${email}.`)
  process.exit(0)
}

// ── Writings ──
const { error: wError } = await db.from('writings').upsert(
  WRITINGS.map((w) => ({
    user_id: userId,
    mode: w.mode,
    topic: w.topic,
    content: w.content,
    word_count: countWords(w.content),
    source: 'app',
    local_id: `seed-${w.key}`,
    created_at: daysAgo(w.daysAgo),
  })),
  { onConflict: 'user_id,local_id', ignoreDuplicates: true }
)
fail('insert writings', wError)

const { data: saved, error: sError } = await db
  .from('writings')
  .select('id, local_id, created_at')
  .eq('user_id', userId)
  .like('local_id', 'seed-%')
fail('read writings', sError)
const idOf = Object.fromEntries(saved.map((r) => [r.local_id, r]))

const { error: fError } = await db.from('writing_feedback').upsert(
  WRITINGS.filter((w) => w.feedback).map((w) => ({
    writing_id: idOf[`seed-${w.key}`].id,
    user_id: userId,
    ...w.feedback,
    source: 'mock',
    model: null,
    created_at: idOf[`seed-${w.key}`].created_at,
  })),
  { onConflict: 'writing_id', ignoreDuplicates: true }
)
fail('insert feedback', fError)

// ── Email exercises ──
const { error: eError } = await db.from('email_exercises').upsert(
  EMAILS.map((e) => {
    return {
      user_id: userId,
      scenario_id: e.scenario_id,
      category: e.category,
      title_tr: e.title_tr,
      recipient: e.to,
      subject: e.subject,
      body: e.body,
      word_count: countWords(e.body),
      analysis: e.analysis,
      analysis_source: e.analysis ? 'mock' : null,
      source: 'app',
      local_id: `seed-${e.key}`,
      created_at: daysAgo(e.daysAgo),
    }
  }),
  { onConflict: 'user_id,local_id', ignoreDuplicates: true }
)
fail('insert emails', eError)

console.log(`${email}: ${WRITINGS.length} writings (${WRITINGS.filter((w) => w.feedback).length} scored as samples), ${EMAILS.length} email exercises.`)

// ── Vectors and the similarity check ──
let vectors
try {
  vectors = await embed(WRITINGS.map((w) => `${w.topic}\n\n${w.content}`))
} catch (err) {
  console.log(`Vectors skipped (${err.message}); the app makes them in the background after the next save.`)
  process.exit(0)
}
const { error: vError } = await db.from('writing_embeddings').upsert(
  WRITINGS.map((w, i) => ({
    writing_id: idOf[`seed-${w.key}`].id,
    user_id: userId,
    model: EMBEDDING_MODEL,
    embedding: `[${vectors[i].join(',')}]`,
  })),
  { onConflict: 'writing_id', ignoreDuplicates: true }
)
fail('insert vectors', vError)

const same = [], other = []
for (let i = 0; i < WRITINGS.length; i++) {
  for (let j = i + 1; j < WRITINGS.length; j++) {
    const s = cosine(vectors[i], vectors[j])
    ;(WRITINGS[i].group === WRITINGS[j].group ? same : other).push({ s, a: WRITINGS[i].key, b: WRITINGS[j].key })
  }
}
const fmt = (p) => `${p.s.toFixed(2)} (${p.a} ~ ${p.b})`
same.sort((x, y) => x.s - y.s)
other.sort((x, y) => y.s - x.s)
console.log(`\nVectors: ${WRITINGS.length}. Similarity (threshold ${SIMILAR_THRESHOLD}):`)
console.log(`  same theme      lowest  ${fmt(same[0])}, highest ${fmt(same[same.length - 1])}`)
console.log(`  different theme highest ${fmt(other[0])}`)
console.log(`  same-theme pairs under the threshold: ${same.filter((p) => p.s < SIMILAR_THRESHOLD).length}/${same.length}`)
console.log(`  different-theme pairs over it:        ${other.filter((p) => p.s >= SIMILAR_THRESHOLD).length}/${other.length}`)
