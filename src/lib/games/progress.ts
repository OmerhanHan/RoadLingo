/**
 * Per-device game progress (best scores, last level), kept in localStorage.
 * Moves to Supabase together with the daily puzzle and leaderboards.
 */
import { parseLevel, type ToeflLevel } from '@/lib/toefl/types'

export type BestScores = Partial<Record<ToeflLevel, number>>

const bestKey = (game: string) => `roadlingo_game_${game}_best`
const levelKey = (game: string) => `roadlingo_game_${game}_level`

export function readBest(game: string): BestScores {
  try {
    const parsed = JSON.parse(localStorage.getItem(bestKey(game)) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as BestScores) : {}
  } catch {
    return {}
  }
}

export function saveBest(game: string, level: ToeflLevel, score: number) {
  try {
    const best = readBest(game)
    if ((best[level] ?? 0) >= score) return
    localStorage.setItem(bestKey(game), JSON.stringify({ ...best, [level]: score }))
  } catch {
    /* storage unavailable */
  }
}

/** Last level played, else the placement test's CEFR level mapped to B1–C1. */
export function readGameLevel(game: string): ToeflLevel {
  try {
    const saved = localStorage.getItem(levelKey(game))
    if (saved) return parseLevel(saved)
    const cefr = String(JSON.parse(localStorage.getItem('placementResult') ?? 'null')?.cefr ?? '')
    if (cefr.startsWith('C')) return 'C1'
    if (cefr === 'B2') return 'B2'
    if (cefr) return 'B1'
  } catch {
    /* fall through */
  }
  return 'B2'
}

export function saveGameLevel(game: string, level: ToeflLevel) {
  try {
    localStorage.setItem(levelKey(game), level)
  } catch {
    /* storage unavailable */
  }
}
