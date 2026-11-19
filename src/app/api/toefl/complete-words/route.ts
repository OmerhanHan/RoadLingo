import { NextRequest, NextResponse } from 'next/server'
import {
  COMPLETE_WORDS_GAPS,
  COMPLETE_WORDS_TOPICS,
  completeWordsPrompt,
  damageParagraph,
  FALLBACK_PARAGRAPHS,
  normalizeParagraph,
} from '@/lib/toefl/completeWords'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type CompleteWordsSet } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  const topic = pickRandom(COMPLETE_WORDS_TOPICS)

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a precise TOEFL reading passage writer. You reply with JSON only.' },
        { role: 'user', content: completeWordsPrompt(level, topic, LEVEL_GUIDE[level]) },
      ],
      req.signal
    )
    const passage = normalizeParagraph(extractJson(raw))
    if (!passage) throw new Error('Generated paragraph failed validation')

    const { segments, gapCount } = damageParagraph(passage.paragraph)
    if (gapCount < COMPLETE_WORDS_GAPS) throw new Error(`Only ${gapCount} gaps could be created`)

    const body: CompleteWordsSet = { source: 'ai', level, topic, ...passage, segments, gapCount }
    return NextResponse.json(body)
  } catch (err) {
    console.warn('[toefl/complete-words] AI generation failed, using fallback:', err instanceof Error ? err.message : err)
    const fb = pickRandom(FALLBACK_PARAGRAPHS)
    const { segments, gapCount } = damageParagraph(fb.paragraph)
    const body: CompleteWordsSet = {
      source: 'fallback',
      level,
      topic: fb.topic,
      title: fb.title,
      paragraph: fb.paragraph,
      segments,
      gapCount,
    }
    return NextResponse.json(body)
  }
}
