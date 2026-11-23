#!/usr/bin/env node
/**
 * Fills the content bank (content/bank/*.json) with the local model, through a
 * running dev server — generation is free locally, so production can serve the
 * bank instead of paying for a model call per request.
 *
 *   npm run content:generate -- --target 5            # ≥5 items per task and level
 *   npm run content:generate -- --tasks daily-life,listening-conversation --levels B2
 *   npm run content:generate -- --audio                # also pre-render listening audio
 *
 * Options: --base http://localhost:3001  --target N  --tasks a,b  --levels B1,B2,C1  --audio
 * Needs: `npm run dev`, Ollama, and for --audio `npm run tts:pocket`.
 */
import fs from 'fs'
import path from 'path'

const ENDPOINTS = {
  'build-sentence': '/api/toefl/build-sentence',
  'complete-words': '/api/toefl/complete-words',
  'daily-life': '/api/toefl/daily-life',
  'academic-passage': '/api/toefl/academic-passage',
  'academic-discussion': '/api/toefl/academic-discussion',
  'listening-choose-response': '/api/toefl/listening?task=choose-response',
  'listening-conversation': '/api/toefl/listening?task=conversation',
  'listening-announcement': '/api/toefl/listening?task=announcement',
  'listening-academic-talk': '/api/toefl/listening?task=academic-talk',
  'error-hunt': '/api/games/error-hunt',
  'word-road': '/api/games/word-road',
  'listen-repeat': '/api/toefl/listen-repeat',
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}

const base = String(arg('base', process.env.CONTENT_BASE_URL || 'http://localhost:3001')).replace(/\/$/, '')
const target = Number(arg('target', 3))
const levels = String(arg('levels', 'B1,B2,C1')).split(',')
const tasks = String(arg('tasks', Object.keys(ENDPOINTS).join(','))).split(',').filter((t) => ENDPOINTS[t])
const withAudio = arg('audio', false) === true
const bankDir = path.join(process.cwd(), 'content', 'bank')

function bank(task) {
  try {
    return JSON.parse(fs.readFileSync(path.join(bankDir, `${task}.json`), 'utf8'))
  } catch {
    return []
  }
}

async function generateOne(task, level) {
  const url = `${base}${ENDPOINTS[task]}${ENDPOINTS[task].includes('?') ? '&' : '?'}level=${level}&fresh=1`
  const t0 = Date.now()
  const res = await fetch(url)
  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.log(`  ✕ ${task} ${level} (${secs}s): ${body.error ?? res.status}`)
    return false
  }
  const data = await res.json()
  console.log(`  ✓ ${task} ${level} (${secs}s) ${data.contentId}`)
  return true
}

let made = 0
let failed = 0
for (const task of tasks) {
  for (const level of levels) {
    const have = bank(task).filter((i) => i.level === level).length
    let missing = Math.max(0, target - have)
    if (!missing) continue
    console.log(`${task} ${level}: ${have} → ${target}`)
    let attempts = 0
    while (missing > 0 && attempts < target * 3) {
      attempts++
      if (await generateOne(task, level)) {
        made++
        missing--
      } else failed++
    }
  }
}
console.log(`\nGenerated ${made} item(s), ${failed} failed attempt(s).`)

if (withAudio) {
  console.log('\nPre-rendering listening audio into the TTS cache…')
  let hits = 0
  let misses = 0
  for (const task of tasks.filter((t) => t.startsWith('listening-'))) {
    for (const item of bank(task)) {
      for (const clip of item.data.clips) {
        for (const line of clip.lines) {
          const res = await fetch(`${base}/api/speaking/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: line.text, voice: line.voice }),
          })
          await res.arrayBuffer()
          if (res.headers.get('x-tts-cache') === 'hit') hits++
          else misses++
        }
      }
    }
  }
  console.log(`Audio: ${misses} rendered, ${hits} already cached.`)
}

console.log('\nBank:')
for (const task of Object.keys(ENDPOINTS)) {
  const counts = {}
  for (const i of bank(task)) counts[i.level] = (counts[i.level] ?? 0) + 1
  console.log(`  ${task.padEnd(28)} ${Object.entries(counts).map(([l, n]) => `${l}:${n}`).join('  ') || '—'}`)
}
