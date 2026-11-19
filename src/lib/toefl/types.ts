export type ToeflLevel = 'B1' | 'B2' | 'C1'

export const TOEFL_LEVELS: ToeflLevel[] = ['B1', 'B2', 'C1']

export function parseLevel(value: string | null | undefined): ToeflLevel {
  return TOEFL_LEVELS.includes(value as ToeflLevel) ? (value as ToeflLevel) : 'B2'
}

export type ContentSource = 'ai' | 'fallback'

/* ── Build a Sentence ── */

export type DialogueSpeaker = {
  gender: 'male' | 'female'
  /** TTS voice assigned on the server from the gender (pocket-tts voice name). */
  voice: string
}

export type BuildSentenceItem = {
  /** What the first speaker says (shown in full). */
  context: string
  /** The second speaker's reply the learner must assemble. */
  answer: string
  /** One extra word that does not belong in the answer (optional). */
  distractor?: string
  /** Speaker A (context) and speaker B (answer); genders come from the AI. */
  speakers: { a: DialogueSpeaker; b: DialogueSpeaker }
}

export type BuildSentenceSet = {
  source: ContentSource
  level: ToeflLevel
  topic: string
  items: BuildSentenceItem[]
}

/* ── Complete the Words ── */

export type CompleteWordsSegment =
  | { type: 'text'; value: string }
  | { type: 'gap'; index: number; prefix: string; missing: string }

export type CompleteWordsSet = {
  source: ContentSource
  level: ToeflLevel
  topic: string
  title: string
  paragraph: string
  segments: CompleteWordsSegment[]
  gapCount: number
}

/* ── Read an Academic Passage ── */

export type PassageQuestionType = 'main_idea' | 'detail' | 'vocabulary' | 'inference' | 'purpose'

export type PassageQuestion = {
  type: PassageQuestionType
  question: string
  options: string[]
  answer: number
  explanation: string
  /** For vocabulary questions: the word to highlight in the passage. */
  highlight?: string
}

export type AcademicPassageSet = {
  source: ContentSource
  level: ToeflLevel
  topic: string
  title: string
  paragraphs: string[]
  questions: PassageQuestion[]
}

/* ── Read in Daily Life ── */

export type DailyGenre = 'email' | 'notice' | 'menu' | 'schedule' | 'messages' | 'social' | 'web'

export type DailyMessage = { from: string; text: string }

export type DailyText = {
  genre: DailyGenre
  title: string
  /** Email sender, social media account, website name… */
  sender?: string
  /** Body lines. For menus / schedules a line may be "left | right". */
  lines: string[]
  /** Only for the `messages` genre. */
  messages?: DailyMessage[]
}

export type DailyLifeSet = {
  source: ContentSource
  level: ToeflLevel
  scenario: string
  text: DailyText
  questions: PassageQuestion[]
}

/* ── Write for an Academic Discussion ── */

export type DiscussionPost = { name: string; text: string }

export type AcademicDiscussionPrompt = {
  source: ContentSource
  level: ToeflLevel
  course: string
  professor: DiscussionPost
  students: [DiscussionPost, DiscussionPost]
}

export type DiscussionCriterion = 'communication' | 'contribution' | 'language' | 'mechanics'

export type DiscussionScore = {
  /** Task-level score, 0–5 (TOEFL rubric). */
  score: number
  criteria: Record<DiscussionCriterion, number>
  summary: string
  strengths: string[]
  improvements: string[]
  corrections: Array<{ original: string; suggestion: string }>
}
