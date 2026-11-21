import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
import {
  ACADEMIC_PASSAGE_TOPICS,
  academicPassagePrompt,
  FALLBACK_PASSAGES,
  normalizePassage,
  shuffleOptions,
} from '@/lib/toefl/academicPassage'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type AcademicPassageSet, type PassageQuestion } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Content = { topic: string; title: string; paragraphs: string[]; questions: PassageQuestion[] }

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))

  return serveContent<Content, AcademicPassageSet>({
    task: 'academic-passage',
    req,
    level,
    async generate(signal) {
      const topic = pickRandom(ACADEMIC_PASSAGE_TOPICS)
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a precise TOEFL reading item writer. You reply with JSON only.' },
          { role: 'user', content: academicPassagePrompt(level, topic, LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const passage = normalizePassage(extractJson(raw))
      if (!passage) throw new Error('Generated passage failed validation')
      return { topic, ...passage }
    },
    fallback: () => pickRandom(FALLBACK_PASSAGES),
    finalize: (data, meta) => ({ ...meta, level, ...data, questions: shuffleOptions(data.questions) }),
  })
}
