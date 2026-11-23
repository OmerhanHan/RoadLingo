/**
 * Günün Bulmacası (the daily word): one English word a day, the same for
 * everyone. The player starts with its Turkish meaning, word class, length
 * and first and last letters; paid hints add an example sentence, an English
 * definition and more letters. Fewer hints and wrong guesses, more points.
 *
 * This file is shared with the browser: rules and the shapes the API sends.
 * The words themselves are in dailyWordServer.ts and never reach the browser
 * before the player has finished.
 */

export const START_POINTS = 100
export const HINT_COST = 20
export const WRONG_GUESS_COST = 10
/** A solved puzzle is worth at least this. */
export const MIN_SOLVED_POINTS = 10
export const MAX_HINTS = 3
/** Wrong guesses allowed; the next wrong one ends the puzzle. */
export const MAX_WRONG_GUESSES = 5

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb'

export const PART_OF_SPEECH_TR: Record<PartOfSpeech, string> = {
  noun: 'isim',
  verb: 'fiil',
  adjective: 'sıfat',
  adverb: 'zarf',
}

export const HINT_LABELS = ['Örnek cümle', 'İngilizce tanım', 'Birkaç harf daha'] as const

export type PuzzleStatus = 'new' | 'playing' | 'solved' | 'failed'

/** What the browser sees of today's puzzle. */
export type DailyPuzzleView = {
  /** YYYY-MM-DD, Europe/Istanbul. */
  day: string
  /** Puzzle number since launch (#1 on the first day). */
  number: number
  length: number
  status: PuzzleStatus
  /** Shown once started. */
  meaningTr?: string
  partOfSpeech?: PartOfSpeech
  /** One entry per letter; '' while hidden. */
  pattern: string[]
  /** Example sentence with the word as ___ (hint 1). */
  sentence?: string
  /** English definition (hint 2). */
  definition?: string
  hintsUsed: number
  /** Wrong guesses so far. */
  guesses: string[]
  /** Current points while playing, the final score after. */
  score: number
  /** Days solved in a row (today included once solved). */
  streak: number
  /** After the end: the word and a short Turkish note. */
  answer?: string
  note?: string
  /** Seconds from start to the solve. */
  seconds?: number
  /** When the next puzzle opens (ISO). */
  nextAt: string
  /** The nickname shown on the leaderboard, null while not chosen. */
  nickname: string | null
}

export type BoardRow = { rank: number; name: string; score: number; seconds: number; me: boolean }

export type DailyBoard = { day: string; total: number; top: BoardRow[]; me: BoardRow | null }

/** Points right now for a play with these hints and wrong guesses. */
export function pointsFor(hintsUsed: number, wrongGuesses: number): number {
  return Math.max(MIN_SOLVED_POINTS, START_POINTS - HINT_COST * hintsUsed - WRONG_GUESS_COST * wrongGuesses)
}

/** Letters only, lowercase: what a guess is compared as. */
export function normalizeGuess(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z]/g, '')
}

/** Nickname rule, the same as the database check. */
export const NICKNAME_RULE = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_.]{3,20}$/
export const NICKNAME_HINT = '3–20 karakter: harf, rakam, alt çizgi ya da nokta; boşluk olmadan.'
