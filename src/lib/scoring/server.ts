/**
 * Essay and email scoring with Gemini (server only).
 *
 * Shared by the stateless routes (/api/analyze, /api/analyze/email: demo mode)
 * and the routes that store the result (/api/writings/[id]/feedback,
 * /api/email-exercises: Supabase mode). The model's numbers are clamped to
 * their ranges before anything is returned or saved.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { geminiFallbackModel, geminiModel } from '@/lib/ai/gemini'
import { normalizeEmailAnalysis, type EmailAnalysis } from '@/lib/emailAnalysis'
import type { GrammarError } from '@/lib/supabase'

/** Longer texts are rejected rather than paid for. */
export const MAX_ESSAY_CHARS = 6000
export const MAX_TOPIC_CHARS = 400
export const MAX_SCENARIO_CHARS = 2000
export const MAX_HEADER_CHARS = 200

export type EssayScore = {
  band_score: number
  grammar_score: number
  coherence_score: number
  vocabulary_score: number
  grammar_errors: GrammarError[]
  suggestions: string[]
  overall_comment: string
}

/** Where a score came from: the model, the sample scorer, or the browser (import). */
export type ScoreSource = 'ai' | 'mock' | 'import'

export const scoringConfigured = () => Boolean(process.env.GOOGLE_AI_API_KEY)

/**
 * Outside production a sample score stands in when the model is missing or
 * fails, so the flows can be tried locally. It is saved as 'mock' and shown
 * as a sample. In production the user gets an error instead.
 */
export const mockScoringAllowed = () => process.env.NODE_ENV !== 'production'

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

const ESSAY_PROMPT = `You are an expert IELTS Writing examiner and English language teacher.
Analyze the given essay and return ONLY a valid JSON object with no markdown, no code fences, no extra text.

The JSON must have exactly this shape:
{
  "grammar_score": <integer 0-10>,
  "coherence_score": <integer 0-10>,
  "vocabulary_score": <integer 0-10>,
  "band_score": <float 0.0-9.0, one decimal>,
  "grammar_errors": [
    { "word": "<problematic word or phrase>", "suggestion": "<corrected form>", "explanation": "<brief explanation>" }
  ],
  "suggestions": [
    "<actionable improvement suggestion>"
  ],
  "overall_comment": "<2-3 sentence overall assessment in English>"
}

Scoring guide:
- grammar_score: 10 = flawless, 7-9 = minor errors, 4-6 = noticeable errors, 0-3 = severe errors
- coherence_score: 10 = perfect flow and structure, 7-9 = well-structured, 4-6 = some structural issues, 0-3 = poor organization
- vocabulary_score: 10 = sophisticated academic vocabulary, 7-9 = good range, 4-6 = limited but functional, 0-3 = very basic
- band_score: calculate based on IELTS band descriptors (Task Achievement, Coherence, Lexical Resource, Grammatical Range)
- grammar_errors: list 1-4 actual errors found in the text (or an empty array if none)
- suggestions: list exactly 3-5 concrete, specific improvement tips
- overall_comment: honest, encouraging, specific to this essay

IMPORTANT: Return raw JSON only. No markdown. No explanation outside the JSON.`

const EMAIL_PROMPT = `Sen kıdemli bir Yapay Zeka Denetçisi ve Akademik Metin Değerlendirme Uzmanısın. Görevin; kullanıcı tarafından gönderilen metinleri (özellikle TOEFL e-postaları, akademik yazılar ve profesyonel yazışmaları) 6 üzerinden objektif bir şekilde analiz etmek ve yapılandırılmış JSON formatında raporlamaktır.

Değerlendirme Kriterlerin:
1. Task Fulfillment (Görev Tamamlama): İstenen gereksinimlerin ve senaryonun tam olarak karşılanıp karşılanmadığı.
2. Organization & Flow (Organizasyon ve Akıcılık): Metin yapısı, açılış/kapanış uyumu ve mantıksal akış.
3. Language Use & Grammar (Dil Kullanımı ve Gramer): Kelime çeşitliliği, tense uyumları ve imza/hitap kuralları.
4. Tone & Register (Ton ve Üslup): Hedef kitleye (profesör, yetkili vb.) uygun akademik/resmi ton.

Kurallar:
- Puanlamayı kesinlikle 6 üzerinden yap (Örn: 4.5). Yarım puanlara izin ver (0.5 adımlarla).
- Açıklamaları ve yorumları kesinlikle Türkçe yaz.
- Çıktıyı *kesinlikle* yalnızca aşağıdaki JSON şablonuna birebir uyarak ver. Markdown, kod bloğu, sohbet metni veya ekstra açıklama ekleme.

JSON şablonu:
{
  "scores": {
    "task_fulfillment": <number 0-6>,
    "organization_flow": <number 0-6>,
    "language_grammar": <number 0-6>,
    "tone_register": <number 0-6>
  },
  "comments": {
    "task_fulfillment": "<Türkçe kısa gerekçe>",
    "organization_flow": "<Türkçe kısa gerekçe>",
    "language_grammar": "<Türkçe kısa gerekçe>",
    "tone_register": "<Türkçe kısa gerekçe>"
  },
  "overall_score": <number 0-6, dört kriterin ortalamasına yakın>,
  "strengths": ["<Türkçe güçlü yan 1>", "<Türkçe güçlü yan 2>"],
  "improvements": ["<Türkçe gelişim önerisi 1>", "<Türkçe gelişim önerisi 2>", "<Türkçe gelişim önerisi 3>"],
  "overall_comment": "<2-3 cümlelik genel değerlendirme, Türkçe>"
}`

let client: GoogleGenerativeAI | null = null

/**
 * Time limits. A busy Gemini model can take ~50 s just to answer "503 high
 * demand", so each attempt is cut off and the whole scoring has a deadline;
 * the user then gets an answer (or an error) within it.
 */
const ATTEMPT_TIMEOUT_MS = 25_000
const DEADLINE_MS = 40_000
/** A retry is only worth starting with at least this much time left. */
const MIN_ATTEMPT_MS = 6_000

/** 429, 500 and 503 ("high demand") pass in seconds; a wrong key or model name (400, 403, 404) does not. */
function isTemporary(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (typeof status === 'number') return status === 429 || status >= 500
  return /\[(429|500|502|503|504)[ \]]/.test(err instanceof Error ? err.message : String(err))
}

const isTimeout = (err: unknown) => err instanceof Error && /abort|timeout/i.test(`${err.name} ${err.message}`)

/**
 * Asks Gemini for a JSON object. On a temporary error (busy, rate limited,
 * slow) it tries the fallback model, then the main one again, as long as the
 * deadline allows. Returns the answer and the model that gave it.
 */
async function askJson(systemInstruction: string, prompt: string): Promise<{ data: Record<string, unknown>; model: string }> {
  if (!scoringConfigured()) throw new Error('GOOGLE_AI_API_KEY is not configured')
  client ??= new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  const primary = geminiModel()
  const fallback = geminiFallbackModel()
  const order = fallback && fallback !== primary ? [primary, fallback, primary] : [primary, primary]
  const deadline = Date.now() + DEADLINE_MS

  let result
  let used = primary
  for (let attempt = 0; ; attempt++) {
    used = order[attempt]
    const model = client.getGenerativeModel({
      model: used,
      systemInstruction,
      generationConfig: { maxOutputTokens: 1200, responseMimeType: 'application/json' },
    })
    try {
      result = await model.generateContent(prompt, { timeout: Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()) })
      break
    } catch (err) {
      const retry = (isTemporary(err) || isTimeout(err)) && attempt + 1 < order.length && deadline - Date.now() >= MIN_ATTEMPT_MS
      if (!retry) throw err
      console.warn(`[scoring] ${used} unavailable, trying ${order[attempt + 1]}:`, err instanceof Error ? err.message.slice(0, 160) : err)
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  const cleaned = result.response
    .text()
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Model did not return an object')
  return { data: parsed as Record<string, unknown>, model: used }
}

function clamp(value: unknown, min: number, max: number, step: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('Score is not a number')
  return Math.round(Math.min(max, Math.max(min, n)) / step) * step
}

const shortText = (value: unknown, max: number) => String(value ?? '').slice(0, max)

/** Checks and clamps an essay score (from the model or an import). Throws when a field is missing. */
export function normalizeEssayScore(raw: Record<string, unknown>): EssayScore {
  const required = ['grammar_score', 'coherence_score', 'vocabulary_score', 'band_score', 'grammar_errors', 'suggestions', 'overall_comment']
  for (const field of required) {
    if (raw[field] === undefined) throw new Error(`Missing field: ${field}`)
  }
  const errors = Array.isArray(raw.grammar_errors) ? raw.grammar_errors : []
  const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions : []
  return {
    band_score: Number(clamp(raw.band_score, 0, 9, 0.1).toFixed(1)),
    grammar_score: clamp(raw.grammar_score, 0, 10, 1),
    coherence_score: clamp(raw.coherence_score, 0, 10, 1),
    vocabulary_score: clamp(raw.vocabulary_score, 0, 10, 1),
    grammar_errors: errors.slice(0, 8).map((e) => {
      const item = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
      return {
        word: shortText(item.word, 200),
        suggestion: shortText(item.suggestion, 200),
        explanation: shortText(item.explanation, 600),
      }
    }),
    suggestions: suggestions.slice(0, 8).map((s) => shortText(s, 600)),
    overall_comment: shortText(raw.overall_comment, 2000),
  }
}

/** The score and the model that gave it. */
export async function scoreEssay(topic: string, content: string): Promise<{ score: EssayScore; model: string }> {
  const { data, model } = await askJson(ESSAY_PROMPT, `Topic: "${topic}"\n\nEssay:\n${content}`)
  return { score: normalizeEssayScore(data), model }
}

/** Checks an email analysis (from the model or an import). Throws when a field is missing. */
export function checkEmailAnalysis(raw: Record<string, unknown>): EmailAnalysis {
  for (const field of ['scores', 'comments', 'overall_score', 'strengths', 'improvements', 'overall_comment']) {
    if (raw[field] === undefined) throw new Error(`Missing field: ${field}`)
  }
  const analysis = normalizeEmailAnalysis(raw as Partial<EmailAnalysis>)
  return {
    ...analysis,
    comments: Object.fromEntries(
      Object.entries(analysis.comments).map(([k, v]) => [k, v.slice(0, 1000)])
    ) as EmailAnalysis['comments'],
    strengths: analysis.strengths.slice(0, 8).map((s) => s.slice(0, 600)),
    improvements: analysis.improvements.slice(0, 8).map((s) => s.slice(0, 600)),
    overall_comment: analysis.overall_comment.slice(0, 2000),
  }
}

export async function scoreEmail(params: { to: string; subject: string; body: string; scenario: string }): Promise<EmailAnalysis> {
  const prompt = `Senaryo (görev):
${params.scenario}

Öğrencinin e-postası:
To: ${params.to}
Subject: ${params.subject}

${params.body}`
  return checkEmailAnalysis((await askJson(EMAIL_PROMPT, prompt)).data)
}
