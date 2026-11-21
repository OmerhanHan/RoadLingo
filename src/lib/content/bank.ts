/**
 * Content bank (server only): AI-generated practice content stored as JSON and
 * reused across users, so each piece is generated once instead of per request.
 *
 * Files live in content/bank/<task>.json. They are filled by
 * `npm run content:generate` (with the free local model) and, outside
 * production, by live generations that pass validation.
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { ToeflLevel } from '@/lib/toefl/types'

export const BANK_TASKS = [
  'build-sentence',
  'complete-words',
  'daily-life',
  'academic-passage',
  'academic-discussion',
  'listening-choose-response',
  'listening-conversation',
  'listening-announcement',
  'listening-academic-talk',
  'error-hunt',
] as const

export type BankTask = (typeof BANK_TASKS)[number]

export type BankItem<T> = {
  id: string
  level: ToeflLevel
  createdAt: string
  data: T
}

const BANK_DIR = path.join(process.cwd(), 'content', 'bank')

const cache = new Map<BankTask, { mtimeMs: number; items: BankItem<unknown>[] }>()

function fileFor(task: BankTask) {
  return path.join(BANK_DIR, `${task}.json`)
}

/** Stable short id derived from the content itself (same content → same id). */
export function contentId(data: unknown): string {
  return crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 10)
}

export function readBank<T>(task: BankTask): BankItem<T>[] {
  const file = fileFor(task)
  let mtimeMs: number
  try {
    mtimeMs = fs.statSync(file).mtimeMs
  } catch {
    return []
  }
  const hit = cache.get(task)
  if (hit && hit.mtimeMs === mtimeMs) return hit.items as BankItem<T>[]
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const items = Array.isArray(parsed) ? (parsed as BankItem<T>[]) : []
    cache.set(task, { mtimeMs, items })
    return items
  } catch (err) {
    console.warn(`[content-bank] could not read ${task}:`, err instanceof Error ? err.message : err)
    return []
  }
}

/** Appends content to the bank (skips duplicates). Returns the stored item. */
export function addToBank<T>(task: BankTask, level: ToeflLevel, data: T): BankItem<T> {
  const id = contentId(data)
  const items = readBank<T>(task)
  const existing = items.find((i) => i.id === id)
  if (existing) return existing

  const item: BankItem<T> = { id, level, createdAt: new Date().toISOString(), data }
  const next = [...items, item]
  fs.mkdirSync(BANK_DIR, { recursive: true })
  const file = fileFor(task)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 1))
  fs.renameSync(tmp, file)
  cache.delete(task)
  return item
}

function candidates<T>(task: BankTask, level: ToeflLevel, filter?: (data: T) => boolean) {
  return readBank<T>(task).filter((i) => i.level === level && (!filter || filter(i.data)))
}

const random = <T>(list: T[]): T | null => (list.length ? list[Math.floor(Math.random() * list.length)] : null)

/** A random item the user has not seen yet. */
export function pickUnseen<T>(task: BankTask, level: ToeflLevel, seen: Set<string>, filter?: (data: T) => boolean) {
  return random(candidates<T>(task, level, filter).filter((i) => !seen.has(i.id)))
}

/** Any item (used when everything was seen and live generation is not allowed). */
export function pickAny<T>(task: BankTask, level: ToeflLevel, filter?: (data: T) => boolean) {
  return random(candidates<T>(task, level, filter)) ?? random(candidates<T>(task, level))
}

export function bankCounts(task: BankTask): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of readBank(task)) counts[item.level] = (counts[item.level] ?? 0) + 1
  return counts
}
