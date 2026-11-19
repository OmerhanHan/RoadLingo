import { parseGender, pickVoices, randomGender, type Gender } from '@/lib/speaking/tts/voices'
import type { BuildSentenceItem, ToeflLevel } from './types'
import { shuffle } from './utils'

export const BUILD_SENTENCE_COUNT = 10

export const BUILD_SENTENCE_TOPICS = [
  'campus life and dormitories',
  'registering for university courses',
  'a group project for a class',
  'library and study habits',
  'a part-time job on campus',
  'a science lab assignment',
  'a club or student organization event',
  'talking with a professor during office hours',
  'travel plans for a semester break',
  'a museum or field trip',
  'sports and fitness on campus',
  'cooking and the dining hall',
] as const

export function buildSentencePrompt(level: ToeflLevel, topic: string, levelGuide: string, count: number) {
  return `You write practice items for the TOEFL iBT "Build a Sentence" task.
Each item is a short two-person exchange. Speaker A says something; Speaker B replies.
The learner must assemble Speaker B's reply from scrambled words.

Topic: ${topic}
Difficulty: ${levelGuide}

Rules for every item:
- "context": Speaker A's line, one natural sentence (a question or a statement).
- "answer": Speaker B's reply, ONE grammatical sentence of 6 to 12 words that naturally answers the context.
  It must end with "." or "?". Use only plain words (letters and apostrophes) — no numbers, commas, quotes, dashes or names.
  Only ONE correct word order should be possible. Test grammar such as word order in questions, embedded questions, relative clauses, prepositions, auxiliaries and verb tenses.
- "distractor": one single word that looks plausible but does NOT belong in the answer (e.g. a wrong auxiliary or preposition). It must not appear in the answer.
- "speakerA" and "speakerB": the gender of each speaker, exactly "male" or "female". Their lines will be read aloud
  with a matching voice, so keep the text consistent with these genders (e.g. pronouns, "Mr."/"Ms."). Vary the genders across items.

Return ONLY a JSON object, no explanation:
{"items":[{"speakerA":"female","context":"...","speakerB":"male","answer":"...","distractor":"..."}]}
Produce exactly ${count} items about varied situations within the topic. Level label: ${level}.`
}

const WORD_RE = /^[A-Za-z]+(?:'[A-Za-z]+)?$/

/** Splits an answer sentence into words and its final punctuation mark. */
export function tokenizeAnswer(answer: string): { words: string[]; punct: string } {
  const trimmed = answer.trim()
  const punctMatch = trimmed.match(/[.?!]$/)
  const punct = punctMatch ? punctMatch[0] : '.'
  const body = punctMatch ? trimmed.slice(0, -1) : trimmed
  const words = body.split(/\s+/).filter(Boolean)
  return { words, punct }
}

/** Validates and cleans one AI-produced item; returns null when unusable. */
export function normalizeItem(raw: unknown): BuildSentenceItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.context !== 'string' || typeof r.answer !== 'string') return null

  const context = r.context.trim().replace(/\s+/g, ' ')
  const answer = r.answer.trim().replace(/\s+/g, ' ')
  if (context.length < 5 || context.length > 200) return null

  const { words } = tokenizeAnswer(answer)
  if (words.length < 4 || words.length > 14) return null
  if (!words.every((w) => WORD_RE.test(w))) return null
  if (!/[.?!]$/.test(answer)) return null

  let distractor: string | undefined
  if (typeof r.distractor === 'string') {
    const d = r.distractor.trim()
    const lowerWords = words.map((w) => w.toLowerCase())
    const placeholder = ['none', 'null', 'na', 'nil', 'undefined'].includes(d.toLowerCase())
    if (WORD_RE.test(d) && !placeholder && !lowerWords.includes(d.toLowerCase())) distractor = d
  }

  const genderA = parseGender(r.speakerA) ?? randomGender()
  const genderB = parseGender(r.speakerB) ?? randomGender()
  return { context, answer, distractor, speakers: assignSpeakers(genderA, genderB) }
}

/** Turns speaker genders into speakers with distinct, gender-matched voices. */
export function assignSpeakers(a: Gender, b: Gender): BuildSentenceItem['speakers'] {
  const [voiceA, voiceB] = pickVoices([a, b])
  return { a: { gender: a, voice: voiceA }, b: { gender: b, voice: voiceB } }
}

/** Displays a word as a tile: sentence-initial capitals are hidden so they don't reveal the start. */
export function tileLabel(word: string, isFirst: boolean): string {
  if (!isFirst || word === 'I' || word.startsWith("I'")) return word
  // Keep acronyms / proper-looking words (e.g. "TOEFL") as-is.
  if (word.length > 1 && word === word.toUpperCase()) return word
  return word.charAt(0).toLowerCase() + word.slice(1)
}

export type Tile = { id: number; label: string }

export function makeTiles(item: BuildSentenceItem): { tiles: Tile[]; slotCount: number; punct: string } {
  const { words, punct } = tokenizeAnswer(item.answer)
  const labels = words.map((w, i) => tileLabel(w, i === 0))
  if (item.distractor) labels.push(item.distractor.toLowerCase())
  const tiles = shuffle(labels.map((label, id) => ({ id, label })))
  return { tiles, slotCount: words.length, punct }
}

export function isCorrectOrder(item: BuildSentenceItem, placed: string[]): boolean {
  const { words } = tokenizeAnswer(item.answer)
  if (placed.length !== words.length) return false
  return words.every((w, i) => w.toLowerCase() === placed[i]?.toLowerCase())
}

type FallbackItem = Omit<BuildSentenceItem, 'speakers'> & { speakerA: Gender; speakerB: Gender }

const FALLBACK_BUILD_SENTENCE: FallbackItem[] = [
  { speakerA: 'female', speakerB: 'male', context: 'Do you know where the professor posted the reading list?', answer: 'I think she uploaded it to the course website.', distractor: 'uploading' },
  { speakerA: 'male', speakerB: 'female', context: 'Why weren\'t you at the study group last night?', answer: 'I had to finish a lab report that was due today.', distractor: 'has' },
  { speakerA: 'female', speakerB: 'female', context: 'Have you decided which elective to take next semester?', answer: 'I am still choosing between art history and economics.', distractor: 'choose' },
  { speakerA: 'male', speakerB: 'male', context: 'The library is closing early this weekend.', answer: 'Do you know what time it opens on Monday?', distractor: 'does' },
  { speakerA: 'female', speakerB: 'male', context: 'I heard you got a job at the campus bookstore.', answer: 'They even let me choose my own working hours.', distractor: 'lets' },
  { speakerA: 'male', speakerB: 'female', context: 'Could you tell me how to get to the science building?', answer: 'It is right behind the main dining hall.', distractor: 'behinds' },
  { speakerA: 'female', speakerB: 'female', context: 'What did the advisor say about your schedule?', answer: 'She told me that I should drop one course.', distractor: 'said' },
  { speakerA: 'male', speakerB: 'male', context: 'Are you going to the music festival on Saturday?', answer: 'I would go if I did not have an exam.', distractor: 'will' },
  { speakerA: 'female', speakerB: 'male', context: 'How was the guest lecture yesterday?', answer: 'It was much more interesting than I had expected.', distractor: 'most' },
  { speakerA: 'male', speakerB: 'female', context: 'Is the new fitness center open to all students?', answer: 'Anyone with a valid student card can use it.', distractor: 'uses' },
  { speakerA: 'female', speakerB: 'female', context: 'Our group still hasn\'t chosen a project topic.', answer: 'Why don\'t we meet after class to discuss it?', distractor: 'doesn\'t' },
  { speakerA: 'male', speakerB: 'male', context: 'Where can I find the forms for the scholarship?', answer: 'You can pick them up at the financial aid office.', distractor: 'picks' },
  { speakerA: 'female', speakerB: 'male', context: 'Did you enjoy the trip to the natural history museum?', answer: 'The dinosaur exhibit was the best part of the visit.', distractor: 'better' },
  { speakerA: 'male', speakerB: 'female', context: 'I can\'t decide whether to live on campus next year.', answer: 'Living in the dorms makes it easier to meet people.', distractor: 'make' },
]

export function fallbackBuildSentenceItems(count: number): BuildSentenceItem[] {
  return shuffle(FALLBACK_BUILD_SENTENCE)
    .slice(0, count)
    .map(({ speakerA, speakerB, ...item }) => ({ ...item, speakers: assignSpeakers(speakerA, speakerB) }))
}
