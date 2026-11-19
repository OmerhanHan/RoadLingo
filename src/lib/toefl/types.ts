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
