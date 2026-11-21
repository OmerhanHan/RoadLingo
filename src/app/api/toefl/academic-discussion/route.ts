import { NextRequest } from 'next/server'
import { serveContent } from '@/lib/content/serve'
import {
  DISCUSSION_COURSES,
  discussionPromptPrompt,
  FALLBACK_DISCUSSIONS,
  normalizeDiscussionPrompt,
} from '@/lib/toefl/academicDiscussion'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import { parseLevel, type AcademicDiscussionPrompt } from '@/lib/toefl/types'
import { pickRandom } from '@/lib/toefl/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Content = Pick<AcademicDiscussionPrompt, 'course' | 'professor' | 'students'>

export async function GET(req: NextRequest) {
  const level = parseLevel(req.nextUrl.searchParams.get('level'))

  return serveContent<Content, AcademicDiscussionPrompt>({
    task: 'academic-discussion',
    req,
    level,
    async generate(signal) {
      const course = pickRandom(DISCUSSION_COURSES)
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a precise TOEFL writing prompt author. You reply with JSON only.' },
          { role: 'user', content: discussionPromptPrompt(level, course, LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const prompt = normalizeDiscussionPrompt(extractJson(raw))
      if (!prompt) throw new Error('Generated discussion failed validation')
      return { course, ...prompt }
    },
    fallback: () => pickRandom(FALLBACK_DISCUSSIONS),
    finalize: (data, meta) => ({ ...meta, level, ...data }),
  })
}
