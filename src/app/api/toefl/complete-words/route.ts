import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
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

type Content = { topic: string; title: string; paragraph: string }

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))

  return serveContent<Content, CompleteWordsSet>({
    task: 'complete-words',
    req,
    level,
    async generate(signal) {
      const topic = pickRandom(COMPLETE_WORDS_TOPICS)
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a precise TOEFL reading passage writer. You reply with JSON only.' },
          { role: 'user', content: completeWordsPrompt(level, topic, LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const passage = normalizeParagraph(extractJson(raw))
      if (!passage) throw new Error('Generated paragraph failed validation')
      if (damageParagraph(passage.paragraph).gapCount < COMPLETE_WORDS_GAPS) throw new Error('Not enough gaps')
      return { topic, title: passage.title, paragraph: passage.paragraph }
    },
    fallback: () => {
      const fb = pickRandom(FALLBACK_PARAGRAPHS)
      return { topic: fb.topic, title: fb.title, paragraph: fb.paragraph }
    },
    finalize: (data, meta) => ({ ...meta, level, ...data, ...damageParagraph(data.paragraph) }),
  })
}
