/**
 * TOEFL Speaking · Listen and Repeat.
 *
 * A short scenario (the learner is training for a job) and seven sentences
 * said by a supervisor, from short to long. Each sentence is played once and
 * repeated aloud; the browser's speech recognition writes down what was said
 * and `compareRepeat` scores it 0–5 against the sentence, like the test.
 * Scoring runs in the browser: no model call, no daily limit.
 */
import type { Gender } from '@/lib/speaking/tts/voices'
import type { ServeMeta } from '@/lib/content/serve'
import type { ToeflLevel } from './types'

export const SENTENCES_PER_SET = 7
export const MAX_POINTS = 5

export type ListenRepeatContent = {
  title: string
  /** English, second person: "You are training to be ..." */
  scenario: string
  scenarioTr: string
  speakerRole: string
  gender: Gender
  sentences: string[]
}

export type ListenRepeatSet = ServeMeta & {
  level: ToeflLevel
  title: string
  scenario: string
  scenarioTr: string
  speakerRole: string
  gender: Gender
  voice: string
  sentences: string[]
  /** Seconds to answer each sentence (longer sentences get more time). */
  answerTime: number[]
}

/** Answer time per sentence: about the time it takes to say it, plus a start. */
export function answerTimeFor(sentence: string): number {
  const words = sentence.trim().split(/\s+/).length
  return Math.min(16, Math.max(6, Math.round(3 + words * 0.6)))
}

/* ── Content ── */

const WORD_RANGE: Record<ToeflLevel, [number, number]> = { B1: [4, 20], B2: [5, 22], C1: [6, 24] }

const wordCount = (s: string) => s.trim().split(/\s+/).length

/** Validates generated or stored content; sentences are put in order from short to long. */
export function normalizeListenRepeat(raw: unknown, level: ToeflLevel): ListenRepeatContent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
  const title = str(r.title)
  const scenario = str(r.scenario)
  const scenarioTr = str(r.scenarioTr ?? r.scenario_tr)
  const speakerRole = str(r.speakerRole ?? r.speaker_role)
  const g = str(r.gender ?? r.speaker_gender).toLowerCase()
  const gender: Gender | null = g === 'female' ? 'female' : g === 'male' ? 'male' : null
  if (!title || !scenario || !scenarioTr || !speakerRole || !gender) return null
  if (!Array.isArray(r.sentences)) return null

  const [min, max] = WORD_RANGE[level]
  const sentences = r.sentences
    .map(str)
    // Spoken-style sentences only: no digits or symbols the recognizer would write differently.
    .filter((s) => /^[A-Z][A-Za-z ,'’-]*[.!?]$/.test(s))
    .filter((s) => wordCount(s) >= min && wordCount(s) <= max)
  const unique = [...new Set(sentences)]
  if (unique.length < SENTENCES_PER_SET) return null
  const ordered = unique.slice(0, SENTENCES_PER_SET).sort((a, b) => wordCount(a) - wordCount(b))
  return { title, scenario, scenarioTr, speakerRole, gender, sentences: ordered }
}

export const LISTEN_REPEAT_SCENARIOS = [
  'a guide at a science museum',
  'a new assistant at the university bookstore',
  'a volunteer at a city recycling center',
  'a tour guide at a botanical garden',
  'a new employee at a hotel front desk',
  'an assistant in a university chemistry lab',
  'a helper at a public swimming pool',
  'a volunteer at an animal shelter',
  'a student guide for campus tours',
  'a new worker at a bicycle rental shop',
  'an assistant at a community theater',
  'a volunteer at a farmers market',
]

const LENGTHS: Record<ToeflLevel, string> = {
  B1: 'from about 5 words (first sentence) up to about 16 words (last sentence)',
  B2: 'from about 6 words (first sentence) up to about 18 words (last sentence)',
  C1: 'from about 7 words (first sentence) up to about 21 words (last sentence)',
}

export function listenRepeatPrompt(level: ToeflLevel, scenario: string, levelGuide: string): string {
  return `Write one TOEFL "Listen and Repeat" item.

The learner is training to be ${scenario}. A supervisor gives them short instructions and facts, one sentence at a time, and the learner repeats each sentence aloud.

Level: ${levelGuide}

Rules:
- Exactly ${SENTENCES_PER_SET} sentences, all said by the same supervisor to the learner, all about this workplace.
- Sentence length grows steadily, ${LENGTHS[level]}.
- Natural spoken English that a real supervisor would say, easy to say aloud. Every sentence is complete and grammatically correct. Avoid rare or showy words.
- Write numbers as words (seven, thirty). No digits, abbreviations, brand names, people's names or symbols.
- Each sentence starts with a capital letter and ends with a full stop, question mark or exclamation mark.

Reply with JSON only:
{
  "title": "<short title, e.g. Science Museum Guide>",
  "scenario": "<one English sentence in the second person, e.g. You are training to be a guide at a science museum. Listen to your supervisor and repeat what she says.>",
  "scenario_tr": "<the same in natural Turkish, addressing the learner informally with sen, e.g. Bir bilim müzesinde rehber olmak için eğitim alıyorsun. Sorumlunu dinle ve söylediklerini tekrar et.>",
  "speaker_role": "<e.g. Senior guide>",
  "speaker_gender": "female" | "male",
  "sentences": ["<sentence 1>", "...", "<sentence ${SENTENCES_PER_SET}>"]
}`
}

/** Handwritten sets, two per level (used before anything repeats and when the bank is empty). */
export const LISTEN_REPEAT_FALLBACKS: { level: ToeflLevel; content: ListenRepeatContent }[] = [
  {
    level: 'B1',
    content: {
      title: 'Campus Library Tour',
      scenario: 'You are training to work at the campus library. Listen to your supervisor and repeat what she says.',
      scenarioTr: 'Kampüs kütüphanesinde çalışmak için eğitim alıyorsun. Süpervizörünü dinle ve söylediklerini tekrar et.',
      speakerRole: 'Library supervisor',
      gender: 'female',
      sentences: [
        'Welcome to the main library.',
        'Please keep your voice down here.',
        'The study rooms are on the second floor.',
        'You can borrow up to ten books at a time.',
        'Laptops can be checked out at the front desk for one day.',
        'If you need help finding a book, just ask one of our staff members.',
        'Remember that the library closes early on Fridays, so plan your study time carefully.',
      ],
    },
  },
  {
    level: 'B1',
    content: {
      title: 'First Day at the Café',
      scenario: 'You are starting a new job at a café. Listen to the manager and repeat what he says.',
      scenarioTr: 'Bir kafede yeni işine başlıyorsun. Müdürü dinle ve söylediklerini tekrar et.',
      speakerRole: 'Café manager',
      gender: 'male',
      sentences: [
        'Good morning and welcome to the team.',
        'Please wash your hands before every shift.',
        'We open the doors at seven every morning.',
        'Fresh bread is delivered to the back door before we open.',
        'Always ask customers if they would like their drink hot or iced.',
        'When the line gets long, one person takes orders while another makes the drinks.',
        'At the end of the day, we clean the machines and make a list of what we need.',
      ],
    },
  },
  {
    level: 'B2',
    content: {
      title: 'Science Museum Guide',
      scenario: 'You are training to be a guide at a science museum. Listen to the senior guide and repeat what she says.',
      scenarioTr: 'Bir bilim müzesinde rehber olmak için eğitim alıyorsun. Kıdemli rehberi dinle ve söylediklerini tekrar et.',
      speakerRole: 'Senior guide',
      gender: 'female',
      sentences: [
        'This hall is dedicated to space exploration.',
        'Visitors are not allowed to touch the displays.',
        'The model rocket in the center is a copy of an early design.',
        'Most school groups spend about an hour in this part of the museum.',
        'If children ask about the planets, point them toward the screens near the exit.',
        'The planetarium show starts every thirty minutes, but seats fill up quickly on weekends.',
        'Before you guide your first group, make sure you know where the emergency exits are located.',
      ],
    },
  },
  {
    level: 'B2',
    content: {
      title: 'Student Orientation',
      scenario: 'You are volunteering at the new student orientation. Listen to the coordinator and repeat what he says.',
      scenarioTr: 'Yeni öğrenci oryantasyonunda gönüllü olarak çalışıyorsun. Koordinatörü dinle ve söylediklerini tekrar et.',
      speakerRole: 'Orientation coordinator',
      gender: 'male',
      sentences: [
        'Thank you for volunteering at orientation.',
        'New students will arrive at the main gate.',
        'Please remind everyone that their student cards must be activated online.',
        'Each of them should receive a welcome pack and a campus map.',
        'The session for international students takes place in the large lecture hall.',
        'By the end of the week, every new student should feel comfortable finding their way around.',
        'If someone asks a question you cannot answer, write it down and pass it on to the help desk.',
      ],
    },
  },
  {
    level: 'C1',
    content: {
      title: 'Research Lab Assistant',
      scenario: 'You are training to be an assistant in a research laboratory. Listen to the lab manager and repeat what she says.',
      scenarioTr: 'Bir araştırma laboratuvarında asistan olmak için eğitim alıyorsun. Laboratuvar sorumlusunu dinle ve söylediklerini tekrar et.',
      speakerRole: 'Lab manager',
      gender: 'female',
      sentences: [
        'Safety glasses must be worn at all times.',
        'Every sample needs to be labeled with the date and your initials.',
        'Chemicals that react with water are stored in the cabinet on the left.',
        'Before you begin an experiment, check that the ventilation system is switched on.',
        'Any unexpected results should be recorded immediately, even if they seem insignificant at first.',
        'Should an accident occur, notify the supervisor on duty and complete an incident report before you leave.',
        'The equipment in this room is shared by three research groups, so bookings have to be made a week in advance.',
      ],
    },
  },
  {
    level: 'C1',
    content: {
      title: 'Art Gallery Guide',
      scenario: 'You are training to give tours at an art gallery. Listen to the curator and repeat what he says.',
      scenarioTr: 'Bir sanat galerisinde tur rehberliği için eğitim alıyorsun. Küratörü dinle ve söylediklerini tekrar et.',
      speakerRole: 'Curator',
      gender: 'male',
      sentences: [
        'This exhibition explores the relationship between cities and light.',
        'Photography is permitted, provided that the flash is turned off.',
        'Visitors often overlook the small sketches displayed beside the larger works.',
        'The paintings in this room were completed during the final decade of the artist’s life.',
        'These early drawings reveal how carefully each composition was planned before any paint was applied.',
        'Although the gallery is quiet on weekday mornings, guided tours are usually fully booked by the afternoon.',
        'When you describe the collection, encourage visitors to form their own interpretations rather than simply repeating ours.',
      ],
    },
  },
]

/* ── Scoring ── */

const CONTRACTIONS: Record<string, string> = {
  "can't": 'can not', cannot: 'can not', "won't": 'will not', "shan't": 'shall not',
  "let's": 'let us', "i'm": 'i am', "it's": 'it is', "that's": 'that is', "there's": 'there is',
  "here's": 'here is', "what's": 'what is', "who's": 'who is', "where's": 'where is', "he's": 'he is', "she's": 'she is',
}
const SUFFIXES: [RegExp, string][] = [
  [/n't$/, ' not'], [/'re$/, ' are'], [/'ll$/, ' will'], [/'ve$/, ' have'], [/'d$/, ' would'],
]

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]
const TENS: Record<number, string> = { 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety', 100: 'hundred' }

function numberWord(n: number): string {
  if (n <= 20) return NUMBER_WORDS[n]
  if (TENS[n]) return TENS[n]
  const tens = Math.floor(n / 10) * 10
  if (n < 100 && TENS[tens] && tens >= 30) return `${TENS[tens]} ${NUMBER_WORDS[n % 10]}`
  if (n < 30) return `twenty ${NUMBER_WORDS[n % 10]}`
  return String(n)
}

/** Lowercase words with contractions expanded and small numbers spelled out (same rules for both sides). */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/(\d+)/g, (d) => ` ${numberWord(Number(d))} `)
    .replace(/[^a-z' -]+/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const out: string[] = []
  for (const raw of words) {
    const w = raw.replace(/^'+|'+$/g, '')
    if (!w) continue
    const whole = CONTRACTIONS[w]
    if (whole) {
      out.push(...whole.split(' '))
      continue
    }
    const suffix = SUFFIXES.find(([re]) => re.test(w))
    if (suffix) {
      out.push(...w.replace(suffix[0], suffix[1]).split(' '))
      continue
    }
    out.push(americanSpelling(w.replace(/'s$/, '')))
  }
  return out
}

/** Speech recognizers write American spelling: colour → color, organise → organize, centre → center. */
function americanSpelling(w: string): string {
  if (w.length >= 5 && w.endsWith('our')) return w.slice(0, -3) + 'or'
  if (w.length >= 5 && w.endsWith('tre')) return w.slice(0, -3) + 'ter'
  if (w.length >= 6) return w.replace(/is(e|ed|es|ing|ation|ations)$/, 'iz$1')
  return w
}

/** Recognizers misspell long words by a letter (colour/color, organise/organize). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export type WordMark = { word: string; ok: boolean }

export type RepeatResult = {
  /** 0–5, like the test. */
  points: number
  /** Share of the sentence's words said in order (0–1). */
  accuracy: number
  /** The sentence's words, each marked said or missed. */
  words: WordMark[]
  /** Words said that are not in the sentence. */
  extra: number
}

/** Compares what was said with the sentence: longest common word sequence. */
export function compareRepeat(sentence: string, said: string): RepeatResult {
  const display = sentence.split(/\s+/).filter(Boolean)
  // Score on normalized tokens, but mark the sentence's own words for display.
  const groups = display.map((w) => tokenize(w))
  const target = groups.flat()
  const heard = tokenize(said)

  const n = target.length
  const m = heard.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = sameWord(target[i], heard[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const matched = new Array<boolean>(n).fill(false)
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (sameWord(target[i], heard[j])) { matched[i] = true; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }

  const hits = dp[0][0]
  const extra = Math.max(0, m - hits)
  const accuracy = n ? hits / n : 0
  // Extra words cost a little: repeating the sentence plus filler is not a perfect answer.
  const adjusted = Math.max(0, accuracy - Math.min(0.2, (extra / Math.max(n, 1)) * 0.5))

  let k = 0
  const words = display.map((word, gi) => {
    const parts = groups[gi]
    const ok = parts.length === 0 || parts.every((_, pi) => matched[k + pi])
    k += parts.length
    return { word, ok }
  })

  const points =
    adjusted >= 0.97 ? 5 : adjusted >= 0.85 ? 4 : adjusted >= 0.7 ? 3 : adjusted >= 0.5 ? 2 : adjusted >= 0.2 ? 1 : 0
  return { points, accuracy, words, extra }
}

export const POINT_LABEL: Record<number, string> = {
  5: 'Tam isabet',
  4: 'Çok iyi',
  3: 'İyi',
  2: 'Kısmen',
  1: 'Az',
  0: 'Anlaşılmadı',
}
