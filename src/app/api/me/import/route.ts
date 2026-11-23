import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/auth/admin'
import { accountGuard, badRequest, readJson, serverError } from '@/lib/security/guard'
import {
  MAX_ESSAY_CHARS,
  MAX_HEADER_CHARS,
  MAX_TOPIC_CHARS,
  checkEmailAnalysis,
  countWords,
  normalizeEssayScore,
} from '@/lib/scoring/server'
import { embedInBackground } from '@/lib/vectors/writings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Per request; the browser sends its newest items first. */
const MAX_ITEMS = 50
/** 50 writings and 50 emails of up to 6000 characters, with feedback. */
const MAX_IMPORT_BYTES = 1_200_000

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const localId = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,80}$/.test(v) ? v : null)

/** The browser's date, if it is a real date in the past; otherwise now. */
function pastDate(v: unknown): string {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) && t <= Date.now() ? new Date(t).toISOString() : new Date().toISOString()
}

/**
 * One-time move of the writings and email exercises a browser kept before
 * the account existed. Rows are marked 'import' (their scores were made in
 * the browser, so they are kept apart from server scores). Sending the same
 * items again adds nothing: each keeps its browser id (local_id).
 */
export async function POST(req: NextRequest) {
  const g = await accountGuard(req, 'account')
  if (!g.ok) return g.response
  const parsed = await readJson<{ writings?: unknown; emails?: unknown }>(req, MAX_IMPORT_BYTES)
  if (!parsed.ok) return parsed.response
  const writings = Array.isArray(parsed.body.writings) ? parsed.body.writings.filter(isObj) : []
  const emails = Array.isArray(parsed.body.emails) ? parsed.body.emails.filter(isObj) : []
  if (writings.length > MAX_ITEMS || emails.length > MAX_ITEMS) return badRequest('Bir seferde en fazla 50 kayıt aktarılır', 413)

  const db = supabaseAdmin()
  try {
    /* Writings and their feedback */
    const writingRows = writings
      .map((w) => {
        const content = str(w.content, MAX_ESSAY_CHARS)
        const topic = str(w.topic, MAX_TOPIC_CHARS)
        const id = localId(w.id)
        if (!content || !topic || !id) return null
        return {
          user_id: g.userId,
          mode: w.mode === 'random' ? 'random' : 'predetermined',
          topic,
          content,
          word_count: countWords(content),
          source: 'import',
          local_id: id,
          created_at: pastDate(w.created_at),
        }
      })
      .filter((r) => r !== null)

    let importedWritings = 0
    if (writingRows.length) {
      const { data, error } = await db
        .from('writings')
        .upsert(writingRows, { onConflict: 'user_id,local_id', ignoreDuplicates: true })
        .select('id, local_id')
      if (error) throw error
      importedWritings = data.length
      const newIds = data.map((r) => r.id)
      after(() => embedInBackground(newIds))
      const byLocal = new Map(writings.map((w) => [localId(w.id), w]))
      const feedbackRows = data.flatMap((row) => {
        const fb = byLocal.get(row.local_id)?.feedback
        if (!isObj(fb)) return []
        try {
          return [{ writing_id: row.id, user_id: g.userId, ...normalizeEssayScore(fb), source: 'import' }]
        } catch {
          return [] // incomplete feedback: keep the writing without it
        }
      })
      if (feedbackRows.length) {
        const { error: fbError } = await db
          .from('writing_feedback')
          .upsert(feedbackRows, { onConflict: 'writing_id', ignoreDuplicates: true })
        if (fbError) throw fbError
      }
    }

    /* Email exercises */
    const emailRows = emails
      .map((e) => {
        const id = localId(e.id)
        const scenarioId = localId(e.scenario_id)
        const category = typeof e.category === 'string' && /^[a-z_]{1,40}$/.test(e.category) ? e.category : null
        if (!id || !scenarioId || !category) return null
        const body = str(e.body, MAX_ESSAY_CHARS)
        let analysis = null
        if (isObj(e.analysis)) {
          try {
            analysis = checkEmailAnalysis(e.analysis)
          } catch {
            analysis = null
          }
        }
        return {
          user_id: g.userId,
          scenario_id: scenarioId,
          category,
          title_tr: str(e.title_tr, MAX_HEADER_CHARS),
          recipient: str(e.to, MAX_HEADER_CHARS),
          subject: str(e.subject, MAX_HEADER_CHARS),
          body,
          word_count: countWords(body),
          analysis,
          analysis_source: analysis ? 'import' : null,
          source: 'import',
          local_id: id,
          created_at: pastDate(e.created_at),
        }
      })
      .filter((r) => r !== null)

    let importedEmails = 0
    if (emailRows.length) {
      const { data, error } = await db
        .from('email_exercises')
        .upsert(emailRows, { onConflict: 'user_id,local_id', ignoreDuplicates: true })
        .select('id')
      if (error) throw error
      importedEmails = data.length
    }

    return NextResponse.json({ writings: importedWritings, emails: importedEmails })
  } catch (err) {
    return serverError('me/import', err, 'Eski çalışmalar aktarılamadı')
  }
}
