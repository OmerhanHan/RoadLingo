import { NextRequest, NextResponse } from 'next/server'
import {
  BUILD_SENTENCE_COUNT,
  BUILD_SENTENCE_TOPICS,
  buildSentencePrompt,
  fallbackBuildSentenceItems,
  normalizeItem,
} from '@/lib/toefl/buildSentence'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type BuildSentenceItem, type BuildSentenceSet } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Accept partial AI output; top up from the built-in bank if needed. */
const MIN_AI_ITEMS = 5

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  const topic = pickRandom(BUILD_SENTENCE_TOPICS)

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a precise TOEFL test item writer. You reply with JSON only.' },
        { role: 'user', content: buildSentencePrompt(level, topic, LEVEL_GUIDE[level], BUILD_SENTENCE_COUNT) },
      ],
      req.signal
    )
    const parsed = extractJson(raw) as { items?: unknown[] }
    const seen = new Set<string>()
    const items: BuildSentenceItem[] = []
    for (const candidate of Array.isArray(parsed.items) ? parsed.items : []) {
      const item = normalizeItem(candidate)
      if (!item || seen.has(item.answer.toLowerCase())) continue
      seen.add(item.answer.toLowerCase())
      items.push(item)
      if (items.length === BUILD_SENTENCE_COUNT) break
    }

    if (items.length < MIN_AI_ITEMS) throw new Error(`Only ${items.length} usable items generated`)
    if (items.length < BUILD_SENTENCE_COUNT) {
      items.push(...fallbackBuildSentenceItems(BUILD_SENTENCE_COUNT - items.length))
    }

    const body: BuildSentenceSet = { source: 'ai', level, topic, items }
    return NextResponse.json(body)
  } catch (err) {
    console.warn('[toefl/build-sentence] AI generation failed, using fallback:', err instanceof Error ? err.message : err)
    const body: BuildSentenceSet = {
      source: 'fallback',
      level,
      topic: 'campus life',
      items: fallbackBuildSentenceItems(BUILD_SENTENCE_COUNT),
    }
    return NextResponse.json(body)
  }
}
