import { NextRequest, NextResponse } from 'next/server'
import { serveContent } from '@/lib/content/serve'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import {
  LISTENING_FALLBACKS,
  listeningPrompt,
  normalizeListening,
  parseListeningTask,
  pickListeningPlan,
  shuffleClipOptions,
  type ListeningContent,
} from '@/lib/toefl/listening'
import { parseLevel, type ListeningSet } from '@/lib/toefl/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const task = parseListeningTask(req.nextUrl.searchParams.get('task'))
  if (!task) return NextResponse.json({ error: 'unknown task' }, { status: 400 })
  const level = parseLevel(req.nextUrl.searchParams.get('level'))

  return serveContent<ListeningContent, ListeningSet>({
    task: `listening-${task}`,
    req,
    level,
    async generate(signal) {
      const raw = await generateText(
        [
          { role: 'system', content: 'You are a precise TOEFL listening item writer. You reply with JSON only.' },
          { role: 'user', content: listeningPrompt(pickListeningPlan(task), level, LEVEL_GUIDE[level]) },
        ],
        signal
      )
      const content = normalizeListening(task, extractJson(raw))
      if (!content) throw new Error('Generated listening content failed validation')
      return content
    },
    fallback: () => {
      const content = normalizeListening(task, LISTENING_FALLBACKS[task])
      if (!content) throw new Error(`Built-in ${task} content is invalid`)
      return content
    },
    finalize: (data, meta) => ({ ...meta, level, task, title: data.title, clips: shuffleClipOptions(data.clips) }),
  })
}
