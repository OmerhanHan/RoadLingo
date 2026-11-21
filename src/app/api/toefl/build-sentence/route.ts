import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
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

/** Accept partial AI output; top up from the built-in items if needed. */
const MIN_AI_ITEMS = 5

type Content = { topic: string; items: BuildSentenceItem[] }

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))

  return serveContent<Content, BuildSentenceSet>({
    task: 'build-sentence',
    req,
    level,
    async generate(signal) {
      const topic = pickRandom(BUILD_SENTENCE_TOPICS)
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a precise TOEFL test item writer. You reply with JSON only.' },
          { role: 'user', content: buildSentencePrompt(level, topic, LEVEL_GUIDE[level], BUILD_SENTENCE_COUNT) },
        ],
        signal
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
      return { topic, items }
    },
    fallback: () => ({ topic: 'campus life', items: fallbackBuildSentenceItems(BUILD_SENTENCE_COUNT) }),
    finalize: (data, meta) => ({
      ...meta,
      level,
      topic: data.topic,
      items:
        data.items.length < BUILD_SENTENCE_COUNT
          ? [...data.items, ...fallbackBuildSentenceItems(BUILD_SENTENCE_COUNT - data.items.length)]
          : data.items,
    }),
  })
}
