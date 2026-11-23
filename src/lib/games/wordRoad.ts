/**
 * Kelime Yolculuğu (word road): the mascot travels a road of vocabulary
 * stops; each stop is a three-option question.
 *
 * Two question kinds:
 * - gap:     a sentence with one blank (___); pick the word that fits.
 * - synonym: a sentence with one *marked* word; pick the closest meaning.
 *
 * Content comes from the content bank (reviewed) or the built-in routes
 * below; nothing is generated while a user plays.
 */
import type { ContentSource, ToeflLevel } from '@/lib/toefl/types'

export const STOPS_PER_ROUTE = 8
const MIN_STOPS = 6
const MAX_STOPS = 10
export const LIVES = 3

/** Seconds per stop. */
export const STOP_TIME: Record<ToeflLevel, number> = { B1: 20, B2: 15, C1: 12 }

export type StopKind = 'gap' | 'synonym'

export type WordStop = {
  kind: StopKind
  /** gap: contains "___"; synonym: the target word wrapped in *asterisks*. */
  sentence: string
  answer: string
  /** Three options including the answer (shuffled per request). */
  options: string[]
  /** Turkish meaning of the answer (gap) or of the marked word (synonym). */
  meaningTr: string
  /** Optional short Turkish tip shown after answering. */
  note?: string
}

/** Stored in the bank. */
export type WordRoute = { title: string; stops: WordStop[] }

/** Sent to the player. */
export type WordRoadSet = {
  source: ContentSource
  contentId?: string
  level: ToeflLevel
  title: string
  stops: WordStop[]
  stopTime: number
}

export const WORD_ROAD_THEMES = [
  'university life',
  'travel and tourism',
  'the environment',
  'technology in daily life',
  'health and fitness',
  'the workplace',
  'scientific research',
  'city life',
  'history and museums',
  'food and cooking',
  'media and communication',
  'money and shopping',
] as const

const WORD = /^[A-Za-z'’-]+(?: [A-Za-z'’-]+)?$/
const GAP = '___'
const TARGET = /\*([^*]+)\*/g

function cleanStop(raw: unknown): WordStop | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const kind = r.kind === 'synonym' ? 'synonym' : r.kind === 'gap' ? 'gap' : null
  if (!kind || typeof r.sentence !== 'string' || typeof r.answer !== 'string') return null

  const sentence = r.sentence.trim().replace(/\s+/g, ' ').replace(/_{2,}/g, GAP)
  if (sentence.length < 15 || sentence.length > 220) return null
  if (kind === 'gap' && sentence.split(GAP).length !== 2) return null
  if (kind === 'synonym' && ([...sentence.matchAll(TARGET)].length !== 1 || sentence.includes(GAP))) return null

  const answer = r.answer.trim()
  const pool = Array.isArray(r.options) ? r.options : Array.isArray(r.distractors) ? [answer, ...r.distractors] : []
  const options = [...new Set(pool.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean))]
  if (options.length !== 3 || !options.includes(answer) || !options.every((o) => WORD.test(o))) return null
  if (kind === 'synonym') {
    const target = [...sentence.matchAll(TARGET)][0][1].trim().toLowerCase()
    if (options.some((o) => o.toLowerCase() === target)) return null
  }

  const meaningTr = String(r.meaningTr ?? r.meaning_tr ?? '').trim()
  if (meaningTr.length < 2 || meaningTr.length > 80) return null
  const noteRaw = String(r.note ?? r.note_tr ?? '').trim()
  const note = noteRaw.length >= 6 && noteRaw.length <= 160 ? noteRaw : undefined

  return { kind, sentence, answer, options, meaningTr, ...(note ? { note } : {}) }
}

/** Validates a route (model output, bank item or built-in); null if it cannot be played. */
export function normalizeRoute(raw: unknown): WordRoute | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.stops)) return null
  const stops = r.stops.map(cleanStop).filter((s): s is WordStop => s !== null)
  if (stops.length < MIN_STOPS) return null
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 60) : 'Word Road'
  return { title, stops: stops.slice(0, MAX_STOPS) }
}

export function wordRoadPrompt(level: ToeflLevel, theme: string, levelGuide: string) {
  return `You write questions for a vocabulary game for Turkish learners preparing for the TOEFL.
Write ${STOPS_PER_ROUTE} questions about the theme "${theme}".
Difficulty: ${levelGuide}

Mix two kinds:
- 5 "gap" questions: one natural sentence with exactly one blank written as ___ . The answer is the single word (or two-word phrasal verb) that fits.
- 3 "synonym" questions: one natural sentence with one word marked with asterisks, like *brief*. The answer is the option closest in meaning in that sentence.

Rules for every question:
- Exactly 2 distractors of the same part of speech as the answer.
- Only the answer may fit. A distractor must be clearly wrong in that sentence (wrong meaning, wrong collocation, or nonsense) — never a near-synonym that also works.
- Use useful, exam-relevant words for the level; each answer word only once.
- "meaning_tr": the Turkish meaning of the answer (gap) or of the marked word (synonym), max 40 characters.
- "note_tr": optional, one short Turkish tip (collocation, a common confusion), max 120 characters.

Return ONLY a JSON object, no explanation:
{"title":"short English title","stops":[{"kind":"gap","sentence":"Please ___ the form before Friday.","answer":"submit","distractors":["borrow","invite"],"meaning_tr":"teslim etmek","note_tr":""}]}
Level label: ${level}.`
}

/* ── Second check: does exactly the intended option fit? ── */

export type RouteCheck = { prompt: string; expected: string[] }

/** Each question with lettered options in random order, for a blind second model call. */
export function routeCheckPlan(route: WordRoute, random: () => number = Math.random): RouteCheck {
  const letters = ['A', 'B', 'C']
  const expected: string[] = []
  const lines = route.stops.map((s, i) => {
    const order = [...s.options].sort(() => random() - 0.5)
    expected.push(letters[order.indexOf(s.answer)])
    const ask = s.kind === 'gap' ? 'Which option fits the blank?' : 'Which option is closest in meaning to the word in asterisks, in this sentence?'
    return `${i + 1}. ${s.sentence}\n   ${ask} ${order.map((o, k) => `${letters[k]}) ${o}`).join('  ')}`
  })
  const prompt = `You check items for an English vocabulary game. For each question, answer with the letter of the option that is correct.
If more than one option is acceptable, answer "multiple". If none is, answer "none".

${lines.join('\n')}

Return ONLY a JSON object: {"answers":["A","C",...]} with exactly ${lines.length} answers.`
  return { prompt, expected }
}

/** Keeps the questions the second check answered as intended; null if too few remain. */
export function keepCheckedStops(route: WordRoute, answers: unknown, expected: string[]): WordRoute | null {
  const list = Array.isArray(answers) ? answers.map((a) => String(a).trim().toUpperCase().replace(/[^A-Z]/g, '')) : []
  return normalizeRoute({ title: route.title, stops: route.stops.filter((_, i) => list[i] === expected[i]) })
}

/* ── Built-in routes (used when the bank has nothing for the level) ── */

const gap = (sentence: string, answer: string, distractors: [string, string], meaningTr: string, note?: string): WordStop => ({
  kind: 'gap',
  sentence,
  answer,
  options: [answer, ...distractors],
  meaningTr,
  ...(note ? { note } : {}),
})
const syn = (sentence: string, answer: string, distractors: [string, string], meaningTr: string, note?: string): WordStop => ({
  kind: 'synonym',
  sentence,
  answer,
  options: [answer, ...distractors],
  meaningTr,
  ...(note ? { note } : {}),
})

export const WORD_ROAD_FALLBACKS: { level: ToeflLevel; route: WordRoute }[] = [
  {
    level: 'B1',
    route: {
      title: 'First Day on Campus',
      stops: [
        gap('The library stays ___ until ten o’clock every night, so you can study late.', 'open', ['closed', 'empty'], 'açık'),
        gap('You need to ___ for the course before Friday, or you cannot attend the classes.', 'register', ['remember', 'decide'], 'kaydolmak'),
        syn('Our teacher gave us a *brief* introduction to the course.', 'short', ['boring', 'careful'], 'kısa'),
        gap('If you have a question, ___ your hand and wait.', 'raise', ['rise', 'grow'], 'kaldırmak', 'raise bir şeyi kaldırmaktır; rise ise kendi kendine yükselmek.'),
        gap('The cafeteria food is cheap, but the ___ is not always good.', 'quality', ['distance', 'history'], 'kalite'),
        syn('It is *necessary* to bring your student card to the exam.', 'required', ['possible', 'useful'], 'gerekli'),
        gap('My roommate is very ___; she always cleans the kitchen after dinner.', 'tidy', ['lazy', 'noisy'], 'düzenli, derli toplu'),
        gap('We have to ___ our homework online by midnight.', 'submit', ['borrow', 'invite'], 'teslim etmek'),
      ],
    },
  },
  {
    level: 'B1',
    route: {
      title: 'A Weekend Trip',
      stops: [
        gap('We decided to ___ a room in a small hotel near the beach.', 'book', ['write', 'open'], 'rezervasyon yapmak', 'book fiil olarak “yer ayırtmak” demektir: book a room / a table.'),
        syn('The view from the hill was *amazing*.', 'wonderful', ['strange', 'dangerous'], 'harika, şaşırtıcı'),
        gap('The train was ___, so we waited at the station for an hour.', 'delayed', ['cheap', 'early'], 'gecikmeli'),
        gap('Don’t forget to ___ your passport before you leave the hotel.', 'pack', ['cook', 'wear'], 'bavula koymak'),
        syn('The streets were *crowded* with tourists.', 'full', ['empty', 'clean'], 'kalabalık'),
        gap('We asked a local woman for ___ to the museum.', 'directions', ['recipes', 'weather'], 'yol tarifi'),
        gap('Entry to the museum was free, so we didn’t have to ___ any money.', 'spend', ['earn', 'lend'], 'harcamak'),
        gap('The trip was short, but it was a great ___.', 'experience', ['invention', 'weather'], 'deneyim'),
      ],
    },
  },
  {
    level: 'B2',
    route: {
      title: 'Living Sustainably',
      stops: [
        gap('Many cities are trying to ___ the amount of plastic waste they produce.', 'reduce', ['expand', 'attract'], 'azaltmak'),
        syn('Solar panels have become far more *affordable* in recent years.', 'inexpensive', ['efficient', 'popular'], 'uygun fiyatlı'),
        gap('Better public transport can help ___ traffic in busy city centres.', 'ease', ['raise', 'build'], 'hafifletmek'),
        gap('The new law will have a significant ___ on how companies handle waste.', 'impact', ['reason', 'purpose'], 'etki', 'have an impact on: bir şey üzerinde etkisi olmak.'),
        syn('Scientists have *observed* a steady rise in ocean temperatures.', 'noticed', ['caused', 'prevented'], 'gözlemlemek'),
        gap('Recycling is only ___ if people separate their waste correctly.', 'effective', ['optional', 'ancient'], 'etkili'),
        gap('Farmers are worried that the ___ of rain this summer will damage their crops.', 'lack', ['smell', 'colour'], 'eksiklik, yokluk', 'lack of: bir şeyin eksikliği.'),
        syn('Governments must *address* the problem of air pollution urgently.', 'tackle', ['ignore', 'describe'], 'ele almak', 'address burada “adres” değil; bir sorunu ele almak demek.'),
      ],
    },
  },
  {
    level: 'B2',
    route: {
      title: 'The Modern Workplace',
      stops: [
        gap('Working from home gives employees more ___ to organise their day.', 'flexibility', ['salary', 'competition'], 'esneklik'),
        syn('The manager *postponed* the meeting until next week.', 'delayed', ['cancelled', 'organised'], 'ertelemek', 'postpone ileri bir tarihe almaktır; cancel tamamen iptal etmek.'),
        gap('She was ___ to team leader after three years at the company.', 'promoted', ['applied', 'retired'], 'terfi ettirilmek'),
        gap('Clear communication helps teams ___ misunderstandings.', 'avoid', ['share', 'deserve'], 'önlemek, kaçınmak'),
        gap('Before the interview, it is a good idea to ___ the company’s history.', 'research', ['invent', 'repeat'], 'araştırmak'),
        syn('Our team faced a *tight* deadline last month.', 'short', ['flexible', 'distant'], 'sıkışık, dar'),
        gap('The company offers ___ training to help staff learn new software.', 'regular', ['sudden', 'accidental'], 'düzenli'),
        gap('Many workers find it hard to ___ a balance between work and family life.', 'strike', ['hit', 'push'], 'denge kurmak (strike a balance)', 'Kalıp: strike a balance between A and B.'),
      ],
    },
  },
  {
    level: 'C1',
    route: {
      title: 'Science and Evidence',
      stops: [
        gap('The researchers were careful not to ___ conclusions from such a small sample.', 'draw', ['pull', 'take'], 'sonuç çıkarmak (draw conclusions)'),
        syn('The findings *undermine* the widely held belief that sugar causes hyperactivity.', 'weaken', ['confirm', 'explain'], 'zayıflatmak, sarsmak'),
        gap('The theory remains ___ because it has never been tested in controlled conditions.', 'speculative', ['conclusive', 'mandatory'], 'kanıtlanmamış, varsayıma dayalı'),
        gap('Correlation does not necessarily ___ causation.', 'imply', ['infer', 'refer'], 'işaret etmek, gerektirmek', 'imply: bir şeye işaret etmek; infer: bir şeyden sonuç çıkarmak.'),
        syn('The study was *rigorous*, using several independent samples.', 'thorough', ['brief', 'controversial'], 'titiz, sıkı'),
        gap('Several experts have ___ doubts about the accuracy of the new model.', 'raised', ['risen', 'lifted'], 'dile getirmek (raise doubts)'),
        gap('The results were ___ with earlier studies, which strengthened the authors’ argument.', 'consistent', ['reluctant', 'adjacent'], 'tutarlı'),
        gap('Without sufficient funding, the project is unlikely to ___.', 'proceed', ['precede', 'recede'], 'devam etmek, ilerlemek', 'proceed: devam etmek; precede: önce gelmek.'),
      ],
    },
  },
  {
    level: 'C1',
    route: {
      title: 'Cities and Society',
      stops: [
        syn('Rapid urbanisation has *exacerbated* housing shortages in many countries.', 'worsened', ['solved', 'measured'], 'kötüleştirmek, şiddetlendirmek'),
        gap('Rising rents have forced many long-term residents to ___ to the suburbs.', 'relocate', ['recover', 'refrain'], 'taşınmak, yer değiştirmek'),
        gap('The council’s decision was met with fierce ___ from local shop owners, who feared losing customers.', 'opposition', ['enthusiasm', 'apathy'], 'karşı çıkma, muhalefet'),
        gap('Green spaces are ___ to residents’ physical and mental well-being.', 'essential', ['accidental', 'indifferent'], 'vazgeçilmez, temel'),
        syn('The new policy aims to *mitigate* the effects of traffic congestion.', 'lessen', ['intensify', 'document'], 'hafifletmek'),
        gap('Critics argue that the redevelopment plan will ___ low-income families.', 'displace', ['deploy', 'dispose'], 'yerinden etmek'),
        gap('The success of the scheme ___ on the cooperation of local communities.', 'hinges', ['insists', 'dwells'], 'bağlı olmak (hinge on)'),
        syn('Buses are *ubiquitous* in the city; there is a stop on almost every street.', 'widespread', ['unreliable', 'expensive'], 'her yerde bulunan'),
      ],
    },
  },
]
