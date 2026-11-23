/**
 * Günün Bulmacası on the server: which word belongs to which day, the
 * player's progress (daily_puzzle_plays), scoring and the leaderboard.
 *
 * The browser only ever gets a view (DailyPuzzleView): the hints the player
 * has paid for, and the word itself once the puzzle is over. Every hint and
 * guess is checked and scored here.
 */
import 'server-only'
import { supabaseAdmin } from '@/lib/auth/admin'
import { DAILY_WORDS, type DailyWord } from './dailyWordList'
import {
  MAX_HINTS,
  MAX_WRONG_GUESSES,
  NICKNAME_RULE,
  normalizeGuess,
  pointsFor,
  type BoardRow,
  type DailyBoard,
  type DailyPuzzleView,
} from './dailyWord'

/** Day of puzzle #1. */
const LAUNCH_DAY = '2026-11-23'
/** Turkey has used UTC+3 all year since 2016, so a day starts at 00:00+03:00. */
const TIME_ZONE = 'Europe/Istanbul'
const UTC_OFFSET = '+03:00'

/** Today in Europe/Istanbul, as YYYY-MM-DD. */
export function puzzleDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const nextOpening = (day: string) => new Date(`${addDays(day, 1)}T00:00:00${UTC_OFFSET}`).toISOString()

function puzzleNumber(day: string): number {
  const days = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${LAUNCH_DAY}T00:00:00Z`)) / 86_400_000)
  return Math.max(1, days + 1)
}

/** The day's word. The stored puzzle id is its list position, never the word (users can read their plays). */
export function puzzleFor(day: string): { id: string; number: number; word: DailyWord } {
  const number = puzzleNumber(day)
  const index = (number - 1) % DAILY_WORDS.length
  return { id: String(index), number, word: DAILY_WORDS[index] }
}

/** Letters shown by the third hint, besides the first and the last. */
function extraLetters(length: number): number[] {
  const picks = new Set([Math.round((length - 1) / 3), Math.round((2 * (length - 1)) / 3)])
  return [...picks].filter((i) => i > 0 && i < length - 1)
}

/* ── Plays ── */

export type Play = {
  status: 'playing' | 'solved' | 'failed'
  hints_used: number
  guesses: string[]
  moves: number
  score: number
  streak: number
  started_at: string
  finished_at: string | null
}

const PLAY_SELECT = 'status, hints_used, guesses, moves, score, streak, started_at, finished_at'

async function loadPlay(userId: string, day: string): Promise<Play | null> {
  const { data, error } = await supabaseAdmin()
    .from('daily_puzzle_plays')
    .select(PLAY_SELECT)
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle<Play>()
  if (error) throw error
  return data
}

/** The streak still alive today: yesterday's, if it was solved. */
async function streakBefore(userId: string, day: string): Promise<number> {
  const yesterday = await loadPlay(userId, addDays(day, -1))
  return yesterday?.status === 'solved' ? yesterday.streak : 0
}

async function loadNickname(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().from('profiles').select('nickname').eq('id', userId).maybeSingle<{ nickname: string | null }>()
  if (error) throw error
  return data?.nickname ?? null
}

function view(day: string, play: Play | null, streak: number, nickname: string | null): DailyPuzzleView {
  const { number, word } = puzzleFor(day)
  const letters = [...word.word]
  const base = {
    day,
    number,
    length: letters.length,
    nextAt: nextOpening(day),
    nickname,
  }
  if (!play) {
    return { ...base, status: 'new', pattern: letters.map(() => ''), hintsUsed: 0, guesses: [], score: pointsFor(0, 0), streak }
  }
  const over = play.status !== 'playing'
  const shown = new Set([0, letters.length - 1, ...(play.hints_used >= 3 ? extraLetters(letters.length) : [])])
  return {
    ...base,
    status: play.status,
    meaningTr: word.meaningTr,
    partOfSpeech: word.partOfSpeech,
    pattern: letters.map((l, i) => (over || shown.has(i) ? l : '')),
    sentence: over || play.hints_used >= 1 ? word.sentence : undefined,
    definition: over || play.hints_used >= 2 ? word.definition : undefined,
    hintsUsed: play.hints_used,
    guesses: play.guesses,
    score: over ? play.score : pointsFor(play.hints_used, play.guesses.length),
    streak: over ? play.streak : streak,
    answer: over ? word.word : undefined,
    note: over ? word.note : undefined,
    seconds:
      play.status === 'solved' && play.finished_at
        ? Math.max(0, Math.round((Date.parse(play.finished_at) - Date.parse(play.started_at)) / 1000))
        : undefined,
  }
}

/** Today's puzzle as this player sees it. */
export async function dailyView(userId: string): Promise<DailyPuzzleView> {
  const day = puzzleDay()
  const [play, nickname] = await Promise.all([loadPlay(userId, day), loadNickname(userId)])
  const streak = play && play.status !== 'playing' ? play.streak : await streakBefore(userId, day)
  return view(day, play, streak, nickname)
}

export class PuzzleError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export type PuzzleAction = { action: 'start' } | { action: 'hint' } | { action: 'guess'; guess: string }

/** Applies one action to today's play and returns the new view. */
export async function applyAction(userId: string, action: PuzzleAction): Promise<DailyPuzzleView> {
  const day = puzzleDay()
  const db = supabaseAdmin()
  const { id, word } = puzzleFor(day)
  const nickname = await loadNickname(userId)
  const streak = await streakBefore(userId, day)
  let play = await loadPlay(userId, day)

  if (action.action === 'start') {
    if (!play) {
      const { error } = await db
        .from('daily_puzzle_plays')
        .upsert({ user_id: userId, day, puzzle_id: id }, { onConflict: 'user_id,day', ignoreDuplicates: true })
      if (error) throw error
      play = await loadPlay(userId, day)
    }
    return view(day, play, streak, nickname)
  }

  if (!play) throw new PuzzleError('Önce bulmacayı başlat.')
  if (play.status !== 'playing') return view(day, play, streak, nickname)

  let change: Partial<Play>
  if (action.action === 'hint') {
    if (play.hints_used >= MAX_HINTS) throw new PuzzleError('Bütün ipuçlarını kullandın.')
    change = { hints_used: play.hints_used + 1 }
  } else {
    const guess = normalizeGuess(action.guess)
    if (guess.length !== word.word.length) throw new PuzzleError(`Kelime ${word.word.length} harfli olmalı.`)
    if (play.guesses.includes(guess)) throw new PuzzleError('Bu kelimeyi zaten denedin.')
    const now = new Date().toISOString()
    if (guess === word.word) {
      change = { status: 'solved', score: pointsFor(play.hints_used, play.guesses.length), streak: streak + 1, finished_at: now }
    } else {
      const guesses = [...play.guesses, guess]
      change =
        guesses.length >= MAX_WRONG_GUESSES
          ? { guesses, status: 'failed', score: 0, streak: 0, finished_at: now }
          : { guesses }
    }
  }

  // Only the version that was read: a second request sent at the same time
  // finds nothing to update and gets the current state instead.
  const { data, error } = await db
    .from('daily_puzzle_plays')
    .update({ ...change, moves: play.moves + 1 })
    .eq('user_id', userId)
    .eq('day', day)
    .eq('moves', play.moves)
    .select(PLAY_SELECT)
    .maybeSingle<Play>()
  if (error) throw error
  return view(day, data ?? (await loadPlay(userId, day)), streak, nickname)
}

/* ── Leaderboard ── */

/** Name for players without a nickname: the same four digits every day. */
export function playerTag(userId: string): string {
  return `Oyuncu ${1000 + (parseInt(userId.replace(/-/g, '').slice(0, 8), 16) % 9000)}`
}

type BoardDbRow = { rank: number; user_id: string; nickname: string | null; score: number; seconds: number; total: number }

export async function dailyBoard(userId: string, limit = 20): Promise<DailyBoard> {
  const day = puzzleDay()
  const { data, error } = await supabaseAdmin().rpc('daily_puzzle_board', { p_day: day, p_user_id: userId, p_limit: limit })
  if (error) throw error
  const dbRows = (data ?? []) as BoardDbRow[]
  const rows = dbRows.map(
    (r): BoardRow => ({
      rank: Number(r.rank),
      name: r.nickname || playerTag(r.user_id),
      score: r.score,
      seconds: r.seconds,
      me: r.user_id === userId,
    })
  )
  return {
    day,
    total: dbRows.length ? Number(dbRows[0].total) : 0,
    top: rows.filter((r) => r.rank <= limit),
    me: rows.find((r) => r.me) ?? null,
  }
}

/* ── Nicknames ── */

/** Parts of names that are not allowed (lowercase, Turkish letters folded). */
const BLOCKED = [
  'admin', 'roaddash', 'moderator', 'destek', 'support', 'oyuncu',
  'amk', 'aq', 'orospu', 'pic', 'sik', 'yarrak', 'got', 'gavat', 'kahpe', 'ibne', 'pezevenk', 'serefsiz',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'nigger', 'nigga', 'whore', 'slut', 'nazi', 'hitler',
]
/** Short ones only as a whole name, so "Aqua" or "Gotham" stay possible. */
const WHOLE_ONLY = new Set(['amk', 'aq', 'pic', 'sik', 'got'])

const fold = (text: string) =>
  text
    .toLocaleLowerCase('tr')
    .replace(/[ç]/g, 'c').replace(/[ğ]/g, 'g').replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ş]/g, 's').replace(/[ü]/g, 'u')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/[_.]/g, '')

/** Why a nickname cannot be used, or null when it can. */
export function nicknameProblem(nickname: string): string | null {
  if (!NICKNAME_RULE.test(nickname)) return 'Takma ad 3–20 karakter olmalı: harf, rakam, alt çizgi ya da nokta.'
  const folded = fold(nickname)
  const bad = BLOCKED.some((w) => (WHOLE_ONLY.has(w) ? folded === w : folded.includes(w)))
  return bad ? 'Bu takma ad kullanılamıyor, başka bir tane dene.' : null
}
