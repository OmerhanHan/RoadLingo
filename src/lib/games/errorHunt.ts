/**
 * Hata Avı (error hunt): a short paragraph with a few planted grammar errors;
 * the player taps the wrong words against the clock.
 *
 * Content is stored in the content bank like the TOEFL tasks, so a round
 * never needs a live model call. In the stored passage every error is marked
 * inline as {wrong|correct}; `errors` holds the matching type and Turkish
 * explanation, in the same order.
 */
import type { ContentSource, ToeflLevel } from '@/lib/toefl/types'

export const ERRORS_PER_ROUND = 4
const MIN_ERRORS = 3
const MAX_ERRORS = 5

/** Seconds per round: lower levels read slower. */
export const TIME_LIMIT: Record<ToeflLevel, number> = { B1: 90, B2: 75, C1: 60 }

/** Seconds taken off the clock for tapping a correct word. */
export const MISS_PENALTY = 5

export const ERROR_TYPES = {
  agreement: 'Özne–fiil uyumu',
  tense: 'Zaman',
  article: 'Artikel',
  preposition: 'Edat',
  plural: 'Tekil / çoğul',
  'word-form': 'Kelime türü',
  comparative: 'Karşılaştırma',
  pronoun: 'Zamir',
  'verb-pattern': 'Fiil kalıbı',
  connector: 'Bağlaç',
  quantifier: 'Miktar sözcüğü',
} as const

export type ErrorType = keyof typeof ERROR_TYPES

export type ErrorHuntError = {
  /** As it appears in the passage (1–3 words). */
  wrong: string
  correct: string
  type: ErrorType
  /** Short Turkish explanation shown after the error is found. */
  explanation: string
}

/** Stored in the bank. */
export type ErrorHuntContent = {
  title: string
  /** Passage with every error marked as {wrong|correct}. */
  passage: string
  errors: ErrorHuntError[]
}

export type ErrorHuntSegment = { type: 'text'; value: string } | { type: 'error'; index: number; value: string }

/** Sent to the player. */
export type ErrorHuntSet = {
  source: ContentSource
  contentId?: string
  level: ToeflLevel
  title: string
  segments: ErrorHuntSegment[]
  errors: ErrorHuntError[]
  timeLimit: number
}

export const ERROR_HUNT_TOPICS = [
  'a student moving to a new city',
  'how a small café became popular',
  'why people keep pets',
  'a school trip to a science museum',
  'learning to cook at home',
  'the benefits of cycling to work',
  'how libraries are changing',
  'a volunteer project in a park',
  'why sleep matters for students',
  'the history of the bicycle',
  'how social media changes friendships',
  'recycling in a small town',
  'working from home',
  'the role of museums today',
  'how honeybees help farmers',
  'the rise of electric cars',
  'why some species migrate',
  'the invention of the telephone',
  'how cities deal with heat waves',
  'online shopping and local shops',
] as const

/**
 * Generation works backwards: the model writes a correct paragraph and names
 * which words to corrupt and how. The correct form then comes from its own
 * fluent text (far more reliable than asking it to spot its planted errors),
 * and the server inserts the errors (injectErrors).
 */
export function errorHuntPrompt(level: ToeflLevel, topic: string, levelGuide: string) {
  return `You write material for an English grammar game for Turkish learners preparing for the TOEFL.

Step 1. Write one short, natural, grammatically perfect paragraph.
Topic: ${topic}
Difficulty: ${levelGuide}
- 70 to 110 words, 5 to 7 sentences, factual and neutral.

Step 2. Choose ${ERRORS_PER_ROUND} words or two-word phrases from different sentences of YOUR paragraph and give a typical learner mistake for each.
- "original" is copied exactly from the paragraph; "wrong" is what a learner might write instead.
- The wrong version must be clearly ungrammatical in that sentence, not just a different meaning or style.
- Use ${ERRORS_PER_ROUND} different types from: ${Object.keys(ERROR_TYPES).join(', ')}.
  Examples: goes→go (agreement), bought→buyed (tense), an→a (article), interested in→interested on (preposition), many→much (quantifier), busier→more busy (comparative), its→it's (pronoun), significantly→significant (word-form).
- No spelling, punctuation or capitalization mistakes; never remove or add a word.
- "explanation": one short sentence in Turkish (max 120 characters) explaining why the original form is correct.

Return ONLY a JSON object, no explanation:
{"title":"short English title","paragraph":"...","errors":[{"original":"goes","wrong":"go","type":"agreement","explanation":"..."}]}
Level label: ${level}.`
}

const MARKER = /\{([^{}|]+)\|([^{}|]+)\}/g
const PHRASE = /^[A-Za-z'’]+(?: [A-Za-z'’]+){0,2}$/

const isErrorType = (v: unknown): v is ErrorType => typeof v === 'string' && v in ERROR_TYPES

/** Validates model output (or a bank item); returns null if it cannot be played. */
export function normalizeErrorHunt(raw: unknown): ErrorHuntContent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.passage !== 'string' || !Array.isArray(r.errors)) return null

  const passage = r.passage.trim().replace(/\s+/g, ' ')
  const markers = [...passage.matchAll(MARKER)]
  if (markers.length < MIN_ERRORS || markers.length > MAX_ERRORS || markers.length !== r.errors.length) return null

  // Nothing but well-formed markers may use the marker characters.
  const shown = passage.replace(MARKER, (_, wrong: string) => wrong.trim())
  if (/[{}|]/.test(shown)) return null
  const words = shown.split(' ').length
  if (words < 50 || words > 160) return null

  const errors: ErrorHuntError[] = []
  for (let i = 0; i < markers.length; i++) {
    const wrong = markers[i][1].trim()
    const correct = markers[i][2].trim()
    const meta = r.errors[i] as Record<string, unknown> | null
    if (!PHRASE.test(wrong) || !PHRASE.test(correct)) return null
    if (wrong.toLowerCase() === correct.toLowerCase()) return null
    const explanation = typeof meta?.explanation === 'string' ? meta.explanation.trim() : ''
    if (explanation.length < 8 || explanation.length > 220) return null
    errors.push({ wrong, correct, type: isErrorType(meta?.type) ? meta.type : 'word-form', explanation })
  }

  // Rebuild the markers from the trimmed values so the stored text is canonical.
  let n = 0
  const canonical = passage.replace(MARKER, () => {
    const e = errors[n++]
    return `{${e.wrong}|${e.correct}}`
  })
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 80) : 'Find the Mistakes'
  return { title, passage: canonical, errors }
}

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Turns the model's correct paragraph plus its corruption list into a stored
 * passage with {wrong|correct} markers, then validates it.
 */
export function injectErrors(raw: unknown): ErrorHuntContent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.paragraph !== 'string' || !Array.isArray(r.errors)) return null
  const paragraph = r.paragraph.trim().replace(/\s+/g, ' ')
  if (/[{}|]/.test(paragraph)) return null

  type Placed = { start: number; end: number; wrong: string; correct: string; meta: Record<string, unknown> }
  const placed: Placed[] = []
  let cursor = 0
  for (const item of r.errors) {
    const e = (item ?? {}) as Record<string, unknown>
    const original = typeof e.original === 'string' ? e.original.trim() : ''
    let wrong = typeof e.wrong === 'string' ? e.wrong.trim() : ''
    if (!PHRASE.test(original) || !PHRASE.test(wrong) || original.toLowerCase() === wrong.toLowerCase()) continue
    const re = new RegExp(`(?<![A-Za-z'’])${escapeRe(original)}(?![A-Za-z'’])`, 'g')
    const free = (m: RegExpExecArray) => !placed.some((p) => m.index < p.end && m.index + m[0].length > p.start)
    const matches = [...paragraph.matchAll(re)].filter(free)
    const match = matches.find((m) => m.index >= cursor) ?? matches[0]
    if (!match) continue
    // Keep sentence-initial capitals: "Although" → "Despite", not "despite".
    if (/^[A-Z]/.test(original) && /^[a-z]/.test(wrong)) wrong = wrong[0].toUpperCase() + wrong.slice(1)
    placed.push({ start: match.index, end: match.index + original.length, wrong, correct: original, meta: e })
    cursor = match.index + original.length
  }

  placed.sort((a, b) => a.start - b.start)
  let passage = ''
  let last = 0
  for (const p of placed) {
    passage += paragraph.slice(last, p.start) + `{${p.wrong}|${p.correct}}`
    last = p.end
  }
  passage += paragraph.slice(last)

  return normalizeErrorHunt({
    title: r.title,
    passage,
    errors: placed.map((p) => ({ type: p.meta.type, explanation: p.meta.explanation })),
  })
}

/* ── Second check: is the wrong form really wrong? ── */

export type VerificationPlan = { prompt: string; expected: ('A' | 'B')[] }

/**
 * For every error, the sentence with the correct form and with the wrong form,
 * in random A/B order, so a second model call can judge them without seeing
 * which is which.
 */
export function verificationPlan(content: ErrorHuntContent, random: () => number = Math.random): VerificationPlan {
  const sentences = content.passage.split(/(?<=[.!?])\s+/)
  const lines: string[] = []
  const expected: ('A' | 'B')[] = []
  let index = 0
  for (const sentence of sentences) {
    const count = [...sentence.matchAll(MARKER)].length
    for (let k = 0; k < count; k++) {
      // This error in its correct and its wrong form; every other error in the sentence fixed.
      let n = 0
      const variant = (useWrong: boolean) =>
        sentence.replace(MARKER, (_, wrong: string, correct: string) => (n++ === k && useWrong ? wrong : correct))
      const good = variant(false)
      n = 0
      const bad = variant(true)
      const goodFirst = random() < 0.5
      expected.push(goodFirst ? 'A' : 'B')
      lines.push(`${index + 1}. A: ${goodFirst ? good : bad}\n   B: ${goodFirst ? bad : good}`)
      index++
    }
  }
  const prompt = `You check items for an English grammar game. For each numbered pair, decide which sentence is grammatically correct standard English.
Answer "A" if only A is correct, "B" if only B is correct, "both" if both are acceptable, "neither" if both are wrong.

${lines.join('\n')}

Return ONLY a JSON object: {"answers":["A","B",...]} with exactly ${lines.length} answers.`
  return { prompt, expected }
}

/** Keeps only the errors the second check confirmed; null if too few remain. */
export function keepVerified(content: ErrorHuntContent, answers: unknown, expected: ('A' | 'B')[]): ErrorHuntContent | null {
  const list = Array.isArray(answers) ? answers.map((a) => String(a).trim().toUpperCase()) : []
  const keep = expected.map((want, i) => list[i] === want)
  let i = 0
  const passage = content.passage.replace(MARKER, (whole, _wrong: string, correct: string) => (keep[i++] ? whole : correct))
  const errors = content.errors.filter((_, j) => keep[j])
  return normalizeErrorHunt({ title: content.title, passage, errors })
}

/** Splits the stored passage into plain text and the tappable error spans. */
export function toSegments(passage: string): ErrorHuntSegment[] {
  const segments: ErrorHuntSegment[] = []
  let last = 0
  let index = 0
  for (const m of passage.matchAll(MARKER)) {
    if (m.index > last) segments.push({ type: 'text', value: passage.slice(last, m.index) })
    segments.push({ type: 'error', index: index++, value: m[1] })
    last = m.index + m[0].length
  }
  if (last < passage.length) segments.push({ type: 'text', value: passage.slice(last) })
  return segments
}

/** The passage with every error fixed (shown on the results screen). */
export function correctedPassage(passage: string): string {
  return passage.replace(MARKER, (_, __, correct: string) => correct)
}

/* ── Built-in rounds (used when the bank has nothing for the level) ── */

type Fallback = { level: ToeflLevel; content: ErrorHuntContent }

export const ERROR_HUNT_FALLBACKS: Fallback[] = [
  {
    level: 'B1',
    content: {
      title: 'Saturday at the Market',
      passage:
        "Every Saturday, my grandmother {go|goes} to the small market near her house. She always arrives early because the best fruit is sold in the first hour. Last week she {buyed|bought} fresh strawberries and a large bag of potatoes. The sellers know her well, and they often give her {a|an} extra apple for free. After shopping, she drinks a cup of tea at a café and talks with {much|many} friends from the neighborhood. For her, the market is not only a place to shop but also a place to see people.",
      errors: [
        { wrong: 'go', correct: 'goes', type: 'agreement', explanation: 'Özne üçüncü tekil şahıs (my grandmother); geniş zamanda fiil -s alır: goes.' },
        { wrong: 'buyed', correct: 'bought', type: 'tense', explanation: 'Last week geçmiş zaman ister; buy düzensiz bir fiildir: bought.' },
        { wrong: 'a', correct: 'an', type: 'article', explanation: 'Sesli harfle başlayan kelimeden (extra) önce a değil an gelir.' },
        { wrong: 'much', correct: 'many', type: 'quantifier', explanation: 'friends sayılabilir çoğul bir isim; much değil many kullanılır.' },
      ],
    },
  },
  {
    level: 'B1',
    content: {
      title: 'My First Summer Job',
      passage:
        'When I was seventeen, I {work|worked} in a bookshop during the summer holiday. The owner was a kind man who taught me how to use the cash register. Every morning I put new books on the shelves and cleaned the windows. The shop was {more busy|busier} on weekends than on weekdays, so I often stayed late. I was nervous at first, but soon I felt {confidence|confident} when I spoke to customers. I also learned that many people are interested {on|in} old maps and travel guides. That summer taught me a lot about responsibility.',
      errors: [
        { wrong: 'work', correct: 'worked', type: 'tense', explanation: 'When I was seventeen geçmişte biten bir dönemi anlatır; fiil geçmiş zamanda olmalı: worked.' },
        { wrong: 'more busy', correct: 'busier', type: 'comparative', explanation: 'Kısa sıfatlar -er ile karşılaştırılır: busy → busier.' },
        { wrong: 'confidence', correct: 'confident', type: 'word-form', explanation: 'feel fiilinden sonra isim değil sıfat gelir: confident.' },
        { wrong: 'on', correct: 'in', type: 'preposition', explanation: 'interested kalıbı in edatıyla kullanılır: interested in.' },
      ],
    },
  },
  {
    level: 'B2',
    content: {
      title: 'Why Cities Plant Trees',
      passage:
        'In recent years, many cities {has|have} started large tree-planting programs. Trees provide shade, which {significant|significantly} lowers the temperature of streets and buildings during hot summers. They also absorb rainwater, reducing the risk of flooding after heavy storms. However, a young tree needs regular care in {it’s|its} first few years, and many die if nobody waters them. For this reason, some cities ask residents to look after the trees near their homes. In the end, the success of these programs {depend|depends} on long-term planning rather than on the number of trees planted in a single year.',
      errors: [
        { wrong: 'has', correct: 'have', type: 'agreement', explanation: 'Özne çoğul (many cities); yardımcı fiil have olmalı.' },
        { wrong: 'significant', correct: 'significantly', type: 'word-form', explanation: 'Fiili (lowers) niteleyen kelime zarf olmalı: significantly.' },
        { wrong: 'it’s', correct: 'its', type: 'pronoun', explanation: 'it’s = it is. Aitlik bildiren biçim kesme işaretsiz its’tir.' },
        { wrong: 'depend', correct: 'depends', type: 'agreement', explanation: 'Özne the success (tekil); fiil -s almalı: depends.' },
      ],
    },
  },
  {
    level: 'B2',
    content: {
      title: 'Learning a Language Online',
      passage:
        'Online language courses have become extremely popular, especially among adults {which|who} have busy schedules. One advantage is that learners can study at {there|their} own pace and repeat difficult lessons as often as they like. However, studying alone requires a great deal of discipline, and many students give up after a few weeks. Research suggests that learners who {joins|join} a study group are more likely to finish the course. Speaking with other people helps them become more confident and {remembering|remember} new vocabulary more easily.',
      errors: [
        { wrong: 'which', correct: 'who', type: 'pronoun', explanation: 'İnsanlardan (adults) söz eden ilgi zamiri which değil who’dur.' },
        { wrong: 'there', correct: 'their', type: 'pronoun', explanation: 'Aitlik için their kullanılır; there “orada” demektir.' },
        { wrong: 'joins', correct: 'join', type: 'agreement', explanation: 'who, çoğul learners’ı anlatır; fiil -s almaz: join.' },
        { wrong: 'remembering', correct: 'remember', type: 'verb-pattern', explanation: 'help someone + yalın fiil: helps them become … and remember.' },
      ],
    },
  },
  {
    level: 'C1',
    content: {
      title: 'The Economics of Attention',
      passage:
        'Digital platforms compete not only for users’ money but also for their attention, a resource that is, by its nature, strictly limited. Because advertising revenue {depend|depends} on how long people stay on a site, designers have strong incentives to make their products as engaging as possible. Critics argue that features such as endless scrolling exploit psychological weaknesses and that the {affect|effect} on young users is particularly worrying. Others maintain that users remain responsible for their own habits and that strict regulation would {hindered|hinder} innovation. Whichever view one accepts, few would deny that the way attention is bought and sold {have|has} profound consequences for public life.',
      errors: [
        { wrong: 'depend', correct: 'depends', type: 'agreement', explanation: 'Özne advertising revenue (tekil); fiil -s almalı: depends.' },
        { wrong: 'affect', correct: 'effect', type: 'word-form', explanation: 'the’den sonra isim gerekir: effect (etki). affect bir fiildir.' },
        { wrong: 'hindered', correct: 'hinder', type: 'verb-pattern', explanation: 'would gibi modal fiillerden sonra fiil yalın gelir: would hinder.' },
        { wrong: 'have', correct: 'has', type: 'agreement', explanation: 'Özne the way (tekil); attention is bought and sold araya giren yan cümle: has.' },
      ],
    },
  },
  {
    level: 'C1',
    content: {
      title: 'Rethinking Urban Transport',
      passage:
        'For much of the twentieth century, cities were designed around the private car, and wide roads were seen as a sign of progress. Today, many planners {argues|argue} that this approach has produced congested streets, polluted air and a {lack in|lack of} public space. Cities such as Copenhagen have shown that residents will cycle even in winter if the routes are safe and convenient. Even so, politicians who reduce car traffic risk {to lose|losing} support in the short term. {Despite|Although} resistance is often strong at first, support usually grows once people experience quieter and cleaner streets.',
      errors: [
        { wrong: 'argues', correct: 'argue', type: 'agreement', explanation: 'Özne çoğul (many planners); fiil -s almaz: argue.' },
        { wrong: 'lack in', correct: 'lack of', type: 'preposition', explanation: 'İsim olarak lack, of ile kullanılır: a lack of public space.' },
        { wrong: 'to lose', correct: 'losing', type: 'verb-pattern', explanation: 'risk fiilinden sonra -ing gelir: risk losing.' },
        { wrong: 'Despite', correct: 'Although', type: 'connector', explanation: 'Despite’tan sonra isim gelir; tam cümle (resistance is…) için Although kullanılır.' },
      ],
    },
  },
]
