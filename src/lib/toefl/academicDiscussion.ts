import type { AcademicDiscussionPrompt, DiscussionCriterion, DiscussionPost, DiscussionScore, ToeflLevel } from './types'

export const DISCUSSION_MINUTES = 10
export const DISCUSSION_MIN_WORDS = 100

export const CRITERION_LABEL: Record<DiscussionCriterion, string> = {
  communication: 'Amaca uygun iletişim',
  contribution: 'Tartışmaya katkı',
  language: 'Dil doğruluğu ve çeşitliliği',
  mechanics: 'Yazım ve noktalama',
}

export const DISCUSSION_COURSES = [
  'urban planning',
  'education policy',
  'environmental science',
  'business management',
  'sociology',
  'public health',
  'computer science and society',
  'economics',
  'psychology',
  'media studies',
] as const

export function discussionPromptPrompt(level: ToeflLevel, course: string, levelGuide: string) {
  return `You write prompts for the TOEFL iBT "Write for an Academic Discussion" task.
A professor posts a question on a class discussion board, and two students have already replied with OPPOSING views.

Course: ${course}
Difficulty of the language: ${levelGuide}

Rules:
- "professor": a realistic professor name (e.g. "Dr. Rivera") and a post of 60 to 90 words that introduces a debatable issue
  related to the course, briefly gives context, and ends with a direct question asking students for their opinion.
- "students": exactly two students with first names. Each post is 35 to 60 words, takes a clear and DIFFERENT position,
  and gives one reason or example. Write them in a natural student voice.
- The question must have no single correct answer and must be answerable from everyday knowledge.

Return ONLY a JSON object, no explanation:
{"professor":{"name":"Dr. ...","text":"..."},"students":[{"name":"...","text":"..."},{"name":"...","text":"..."}]}
Level label: ${level}.`
}

function normalizePost(raw: unknown, minWords: number, maxWords: number): DiscussionPost | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.name !== 'string' || typeof r.text !== 'string') return null
  const name = r.name.trim().slice(0, 40)
  const text = r.text.trim().replace(/\s+/g, ' ')
  const words = text.split(' ').length
  if (!name || words < minWords || words > maxWords) return null
  return { name, text }
}

export function normalizeDiscussionPrompt(raw: unknown): Pick<AcademicDiscussionPrompt, 'professor' | 'students'> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const professor = normalizePost(r.professor, 35, 140)
  if (!professor || !professor.text.includes('?')) return null
  const list = Array.isArray(r.students) ? r.students : []
  const a = normalizePost(list[0], 20, 100)
  const b = normalizePost(list[1], 20, 100)
  if (!a || !b || a.name === b.name) return null
  return { professor, students: [a, b] }
}

export function discussionScoringPrompt(prompt: Pick<AcademicDiscussionPrompt, 'course' | 'professor' | 'students'>, response: string) {
  return `You are a certified TOEFL iBT rater scoring a "Write for an Academic Discussion" response.

Course: ${prompt.course}
Professor (${prompt.professor.name}): ${prompt.professor.text}
Student 1 (${prompt.students[0].name}): ${prompt.students[0].text}
Student 2 (${prompt.students[1].name}): ${prompt.students[1].text}

Test taker's response:
"""
${response}
"""

Score holistically from 0 to 5 using the official rubric:
5 = relevant, very clearly expressed contribution; well-elaborated explanations, examples and details; effective, varied syntax and precise vocabulary; almost no errors.
4 = relevant contribution, ideas easily understood; adequate elaboration; some variety; few errors.
3 = mostly relevant and understandable; parts missing, unclear or irrelevant; some noticeable errors.
2 = attempt to contribute, but ideas are limited or poorly connected; frequent errors obscure meaning.
1 = ineffective attempt; few coherent ideas; serious, frequent errors.
0 = blank, off-topic, not in English, or copied from the prompt.
A response under 100 words rarely earns above 3.

Also score each criterion from 0 to 5:
- "communication": answers the professor's question with a clear opinion.
- "contribution": adds new ideas and engages with the classmates' posts instead of repeating them.
- "language": accuracy and range of grammar and vocabulary.
- "mechanics": spelling and punctuation.

Write the feedback in TURKISH (simple and encouraging), except "corrections", which quote the learner's English.
- "summary": 1-2 sentences.
- "strengths": 1-3 short items. "improvements": 1-3 short, actionable items.
- "corrections": up to 4 items {"original": exact phrase from the response, "suggestion": corrected English}.

Return ONLY a JSON object:
{"score":4,"criteria":{"communication":4,"contribution":4,"language":3,"mechanics":4},"summary":"...","strengths":["..."],"improvements":["..."],"corrections":[{"original":"...","suggestion":"..."}]}`
}

function clampScore(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(5, Math.max(0, Math.round(n * 2) / 2))
}

function stringList(v: unknown, max: number): string[] {
  return (Array.isArray(v) ? v : [])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max)
}

export function normalizeDiscussionScore(raw: unknown, response: string): DiscussionScore | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const score = clampScore(r.score)
  if (score === null) return null

  const c = (r.criteria && typeof r.criteria === 'object' ? r.criteria : {}) as Record<string, unknown>
  const criteria = {
    communication: clampScore(c.communication) ?? score,
    contribution: clampScore(c.contribution) ?? score,
    language: clampScore(c.language) ?? score,
    mechanics: clampScore(c.mechanics) ?? score,
  }

  const lowerResponse = response.toLowerCase()
  const corrections = (Array.isArray(r.corrections) ? r.corrections : [])
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .filter((x) => typeof x.original === 'string' && typeof x.suggestion === 'string')
    .map((x) => ({ original: (x.original as string).trim(), suggestion: (x.suggestion as string).trim() }))
    // Keep only corrections that quote the learner's text and actually change something.
    .filter((x) => x.original && x.original !== x.suggestion && lowerResponse.includes(x.original.toLowerCase()))
    .slice(0, 4)

  return {
    score,
    criteria,
    summary: typeof r.summary === 'string' ? r.summary.trim() : '',
    strengths: stringList(r.strengths, 3),
    improvements: stringList(r.improvements, 3),
    corrections,
  }
}

export const FALLBACK_DISCUSSIONS: Array<Omit<AcademicDiscussionPrompt, 'source' | 'level'>> = [
  {
    course: 'urban planning',
    professor: {
      name: 'Dr. Nakamura',
      text: 'We have been discussing how cities use limited public land. Some planners argue that cities should prioritize green spaces such as parks and gardens, because they improve residents’ physical and mental health. Others believe cities should invest in community centers and cultural venues, because these places bring people together and strengthen social ties. Which type of public space do you think cities should prioritize, and why?',
    },
    students: [
      { name: 'Tanya', text: 'I think parks should come first. Living in a crowded city is stressful, and having a green place to walk, exercise, or just sit outside makes a huge difference. Parks are also free and open to everyone, no matter their age or income.' },
      { name: 'Marco', text: 'I disagree with Tanya. Parks are nice, but people mostly go there alone or with friends they already know. Community centers organize classes and events where neighbors actually meet each other, which builds a stronger community over time.' },
    ],
  },
  {
    course: 'education policy',
    professor: {
      name: 'Dr. Okafor',
      text: 'Many universities now record their lectures and post them online. Supporters say this helps students review difficult material and learn at their own pace. Critics worry that recorded lectures encourage students to skip class and miss valuable discussion with classmates and instructors. Should universities make recordings of all lectures available to students? Explain your position.',
    },
    students: [
      { name: 'Priya', text: 'Yes, they should. Sometimes I cannot write notes fast enough, and being able to pause a recording helps me understand complex ideas. It is also fair to students who work part-time or get sick and cannot attend every class.' },
      { name: 'Daniel', text: 'I see Priya’s point, but I think recordings make students lazy. If people know the lecture will be online, many will not come, and then in-class discussions become empty. Learning is not only listening; it is also asking questions in real time.' },
    ],
  },
]
