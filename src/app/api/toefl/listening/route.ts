import { NextRequest, NextResponse } from 'next/server'
import { extractJson, generateText, LEVEL_GUIDE } from '@/lib/toefl/generate'
import {
  LISTENING_FALLBACKS,
  listeningPrompt,
  normalizeListening,
  parseListeningTask,
  pickListeningPlan,
  shuffleClipOptions,
} from '@/lib/toefl/listening'
import { parseLevel, type ListeningSet } from '@/lib/toefl/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const task = parseListeningTask(req.nextUrl.searchParams.get('task'))
  if (!task) return NextResponse.json({ error: 'unknown task' }, { status: 400 })
  const level = parseLevel(req.nextUrl.searchParams.get('level'))
  const plan = pickListeningPlan(task)

  try {
    const raw = await generateText(
      [
        { role: 'system', content: 'You are a precise TOEFL listening item writer. You reply with JSON only.' },
        { role: 'user', content: listeningPrompt(plan, level, LEVEL_GUIDE[level]) },
      ],
      req.signal
    )
    const content = normalizeListening(task, extractJson(raw))
    if (!content) throw new Error('Generated listening content failed validation')
    const body: ListeningSet = { source: 'ai', level, task, title: content.title, clips: shuffleClipOptions(content.clips) }
    return NextResponse.json(body)
  } catch (err) {
    console.warn(`[toefl/listening:${task}] AI generation failed, using fallback:`, err instanceof Error ? err.message : err)
    const content = normalizeListening(task, LISTENING_FALLBACKS[task])
    if (!content) return NextResponse.json({ error: 'fallback invalid' }, { status: 500 })
    const body: ListeningSet = { source: 'fallback', level, task, title: content.title, clips: shuffleClipOptions(content.clips) }
    return NextResponse.json(body)
  }
}
