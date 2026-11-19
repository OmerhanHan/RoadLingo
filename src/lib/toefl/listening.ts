import { parseGender, pickVoices, type Gender } from '@/lib/speaking/tts/voices'
import type {
  ListeningClip,
  ListeningLine,
  ListeningQuestion,
  ListeningQuestionKind,
  ListeningTaskId,
  ToeflLevel,
} from './types'
import { pickRandom, shuffle } from './utils'

export const LISTENING_TASK_IDS: ListeningTaskId[] = ['choose-response', 'conversation', 'announcement', 'academic-talk']

export function parseListeningTask(value: string | null | undefined): ListeningTaskId | null {
  return LISTENING_TASK_IDS.includes(value as ListeningTaskId) ? (value as ListeningTaskId) : null
}

export const LISTENING_TASK_INFO: Record<ListeningTaskId, { title: string; titleTr: string; intro: string }> = {
  'choose-response': {
    title: 'Listen and Choose a Response',
    titleTr: 'Cevabı Seç',
    intro: 'Kısa bir cümle duyacaksın: bir soru, rica ya da haber. Ardından yazılı 4 cevap arasından en doğal olanı seç. Toplam 5 cümle.',
  },
  conversation: {
    title: 'Listen to a Conversation',
    titleTr: 'Konuşma Dinle',
    intro: 'Kampüste ya da günlük hayatta geçen iki kişilik kısa bir konuşma dinleyecek, sonra 3 soruyu cevaplayacaksın.',
  },
  announcement: {
    title: 'Listen to an Announcement',
    titleTr: 'Duyuru Dinle',
    intro: 'Kampüs ya da şehirden bir duyuru dinleyecek, sonra amacı, detayları ve dinleyenlerin ne yapması gerektiği hakkında 3 soruyu cevaplayacaksın.',
  },
  'academic-talk': {
    title: 'Listen to an Academic Talk',
    titleTr: 'Akademik Konuşma',
    intro: 'Bir profesörün kısa bir ders anlatımını dinleyecek, sonra ana fikir, detay ve çıkarım üzerine 4 soruyu cevaplayacaksın.',
  },
}

export const QUESTION_KIND_LABEL: Record<ListeningQuestionKind, string> = {
  response: 'Best Response',
  main_idea: 'Main Idea',
  detail: 'Detail',
  inference: 'Inference',
  purpose: 'Purpose',
  action: 'Next Step',
}

const KINDS = Object.keys(QUESTION_KIND_LABEL) as ListeningQuestionKind[]

/* ── Scenario pools ── */

const RESPONSE_SITUATIONS = [
  'a classmate before a lecture', 'a roommate in the kitchen', 'a librarian at the front desk',
  'a coworker at a café job', 'a professor after class', 'a friend at the bus stop',
  'a receptionist at a dentist office', 'a teammate after practice', 'a neighbor in the hallway',
  'a shop assistant in a bookstore', 'a lab partner during an experiment', 'a tour guide at a museum',
]

const CONVERSATION_SCENARIOS = [
  'a student asks a librarian about an overdue book and a fine',
  'a student visits a professor in office hours to discuss a research paper topic',
  'two roommates plan a weekend trip and disagree about the budget',
  'a student calls the housing office because the heater in the dorm room is broken',
  'two classmates divide the work for a group presentation',
  'a customer asks a bike shop employee about repairing a flat tire',
  'a student talks to a career center advisor about a summer internship',
  'two friends decide which volunteer event to join this weekend',
]

const ANNOUNCEMENT_SCENARIOS = [
  'a change to the weekend campus shuttle schedule',
  'a fire drill in a student residence hall tomorrow morning',
  'the library introducing new self-checkout machines',
  'a museum closing early today for a private event',
  'a train platform change at a busy station',
  'the campus pool closing for maintenance next week',
  'a student club fair taking place in the main hall',
  'a new meal plan option in the university cafeteria',
]

const ACADEMIC_TOPICS = [
  { course: 'Biology', topic: 'bioluminescence: why some sea animals produce light' },
  { course: 'Astronomy', topic: 'why Mars looks red' },
  { course: 'Psychology', topic: 'the spacing effect in memory and learning' },
  { course: 'Economics', topic: 'supply and demand, using concert ticket prices as an example' },
  { course: 'Art History', topic: 'how fresco painting works and why it lasts so long' },
  { course: 'Geology', topic: 'how limestone caves form' },
  { course: 'Linguistics', topic: 'how pidgin languages can develop into creoles' },
  { course: 'Environmental Science', topic: 'urban heat islands and how cities can cool down' },
]

/* ── Prompts ── */

const QUESTION_RULES = `- Each question has exactly 4 options; exactly one is correct, the others are plausible but wrong according to the recording.
   - "explanation": one short sentence saying why the correct answer is right.
   - "answer": the 0-based index of the correct option.`

const SPOKEN_STYLE = 'Natural SPOKEN English (contractions, short sentences, an occasional "Well," "Actually," "So,"). No stage directions, no sound effects, no markdown.'

export type ListeningPlan = { task: ListeningTaskId; scenario: string; course?: string }

export function pickListeningPlan(task: ListeningTaskId): ListeningPlan {
  switch (task) {
    case 'choose-response':
      return { task, scenario: shuffle(RESPONSE_SITUATIONS).slice(0, 5).join('; ') }
    case 'conversation':
      return { task, scenario: pickRandom(CONVERSATION_SCENARIOS) }
    case 'announcement':
      return { task, scenario: pickRandom(ANNOUNCEMENT_SCENARIOS) }
    case 'academic-talk': {
      const t = pickRandom(ACADEMIC_TOPICS)
      return { task, scenario: t.topic, course: t.course }
    }
  }
}

export function listeningPrompt(plan: ListeningPlan, level: ToeflLevel, levelGuide: string): string {
  const head = `You write items for the TOEFL iBT Listening section. The text you write will be read aloud by a text-to-speech voice.
Difficulty: ${levelGuide} (level ${level}).
${SPOKEN_STYLE}`

  switch (plan.task) {
    case 'choose-response':
      return `${head}

Task: "Listen and Choose a Response". The test taker hears ONE short sentence and chooses the most appropriate reply.
Write exactly 5 items, one for each of these situations: ${plan.scenario}.
For each item:
- "situation": 3 to 8 words describing who is speaking, e.g. "A classmate before a lecture".
- "gender": "male" or "female" (the speaker).
- "line": what the speaker says, 6 to 20 words: a question, request, suggestion, complaint or piece of news.
- "options": 4 written replies of SIMILAR LENGTH (5 to 14 words each). Exactly one is a natural, appropriate reply.
  The 3 wrong options must be clearly wrong replies to THIS line, not just less polite ones. Use these traps:
  (a) repeats a word from the line but with a different meaning or topic,
  (b) answers a different question (e.g. answers "when" when the line asks "where"),
  (c) uses the wrong time or does not match the situation.
  A wrong option must NEVER be a reasonable reply, e.g. a polite refusal or a "maybe later" is also acceptable, so do not use those as wrong options.
- "answer": the 0-based index of the correct reply. "explanation": one short sentence.

Return ONLY a JSON object:
{"items":[{"situation":"...","gender":"female","line":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`

    case 'conversation':
      return `${head}

Task: "Listen to a Conversation".
Situation: ${plan.scenario}.
1) Write the conversation: 8 to 12 turns, 120 to 200 words in total, two speakers who alternate. Give each speaker a first name and a gender.
2) Write exactly 3 questions in this order: "main_idea" (what they mainly discuss or why the conversation happens), "detail" (a specific fact), "action" (what one speaker will probably do next). Refer to speakers by name.
   ${QUESTION_RULES}

Return ONLY a JSON object:
{"title":"...","situation":"3 to 8 words, e.g. Two students in the library","speakers":[{"name":"...","gender":"female"},{"name":"...","gender":"male"}],"turns":[{"speaker":"Name","text":"..."}],"questions":[{"kind":"main_idea","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`

    case 'announcement':
      return `${head}

Task: "Listen to an Announcement".
Topic: ${plan.scenario}.
1) Write the announcement as ONE speaker would say it over a speaker system or at the start of an event: 90 to 150 words, with concrete times, places and instructions.
2) Write exactly 3 questions in this order: "purpose" (why the announcement is made), "detail" (a specific fact), "action" (what listeners are asked or advised to do).
   ${QUESTION_RULES}

Return ONLY a JSON object:
{"title":"...","situation":"3 to 8 words, e.g. An announcement in the library","speaker":{"name":"...","role":"...","gender":"female"},"text":"...","questions":[{"kind":"purpose","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`

    case 'academic-talk':
      return `${head}

Task: "Listen to an Academic Talk".
Course: ${plan.course}. Topic: ${plan.scenario}.
1) Write a short lecture by a professor in an introductory class: 200 to 280 words in 2 or 3 paragraphs. It sounds spoken, not written: the professor may use a rhetorical question, an everyday example and a short summary.
2) Write exactly 4 questions in this order: "main_idea", "detail", "detail", "purpose" (why the professor mentions a specific example) or "inference".
   ${QUESTION_RULES}

Return ONLY a JSON object:
{"title":"...","professor":{"name":"Professor ...","gender":"male"},"paragraphs":["...","..."],"questions":[{"kind":"main_idea","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`
  }
}

/* ── Normalization ── */

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').replace(/\*+/g, '') : '')
const wordCount = (s: string) => (s ? s.split(/\s+/).length : 0)

function normalizeQuestion(raw: unknown, fallbackKind: ListeningQuestionKind): ListeningQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const question = clean(q.question)
  if (!question || !Array.isArray(q.options) || q.options.length !== 4) return null
  const options = q.options.map(clean)
  if (options.some((o) => !o) || new Set(options.map((o) => o.toLowerCase())).size !== 4) return null
  const answer = Number(q.answer)
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return null
  const kind = KINDS.includes(q.kind as ListeningQuestionKind)
    ? (q.kind as ListeningQuestionKind)
    : KINDS.includes(q.type as ListeningQuestionKind) ? (q.type as ListeningQuestionKind) : fallbackKind
  return { kind, question, options, answer, explanation: clean(q.explanation) }
}

function normalizeQuestions(raw: unknown, min: number, max: number): ListeningQuestion[] | null {
  const list = (Array.isArray(raw) ? raw : []).map((q) => normalizeQuestion(q, 'detail')).filter(Boolean) as ListeningQuestion[]
  return list.length >= min ? list.slice(0, max) : null
}

/** Splits a monologue into TTS-sized chunks (whole sentences, ≤ maxChars). */
export function chunkSpeech(text: string, maxChars = 320): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if (cur && (cur + ' ' + s).length > maxChars) {
      chunks.push(cur)
      cur = s
    } else {
      cur = cur ? `${cur} ${s}` : s
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

function monologue(name: string, gender: Gender, voice: string, paragraphs: string[]): ListeningLine[] {
  return paragraphs.flatMap((p) => chunkSpeech(p).map((text) => ({ speaker: name, gender, voice, text })))
}

export type ListeningContent = { title: string; clips: ListeningClip[] }

export function normalizeListening(task: ListeningTaskId, raw: unknown): ListeningContent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  switch (task) {
    case 'choose-response': {
      const clips: ListeningClip[] = []
      for (const it of Array.isArray(r.items) ? r.items : []) {
        if (!it || typeof it !== 'object') continue
        const item = it as Record<string, unknown>
        const line = clean(item.line)
        const n = wordCount(line)
        if (n < 4 || n > 30) continue
        const q = normalizeQuestion({ ...item, question: 'Choose the best response.', kind: 'response' }, 'response')
        if (!q) continue
        const gender = parseGender(item.gender) ?? (Math.random() < 0.5 ? 'male' : 'female')
        const [voice] = pickVoices([gender])
        clips.push({
          context: clean(item.situation).slice(0, 60) || 'Someone says',
          lines: [{ speaker: 'Speaker', gender, voice, text: line }],
          questions: [q],
        })
      }
      return clips.length >= 3 ? { title: 'Choose a Response', clips: clips.slice(0, 5) } : null
    }

    case 'conversation': {
      const speakers = (Array.isArray(r.speakers) ? r.speakers : [])
        .map((s) => (s && typeof s === 'object' ? (s as Record<string, unknown>) : {}))
        .map((s) => ({ name: clean(s.name).slice(0, 20), gender: parseGender(s.gender) }))
        .filter((s) => s.name)
      const turns = (Array.isArray(r.turns) ? r.turns : [])
        .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>) : {}))
        .map((t) => ({ speaker: clean(t.speaker).slice(0, 20), text: clean(t.text) }))
        .filter((t) => t.speaker && t.text)
      const names = [...new Set(turns.map((t) => t.speaker))]
      const words = turns.reduce((n, t) => n + wordCount(t.text), 0)
      if (turns.length < 6 || names.length !== 2 || words < 80 || words > 300) return null

      const genders: Gender[] = names.map(
        (name, i) => speakers.find((s) => s.name === name)?.gender ?? (i === 0 ? 'female' : 'male')
      )
      const voices = pickVoices(genders)
      const lines: ListeningLine[] = turns.map((t) => {
        const i = names.indexOf(t.speaker)
        return { speaker: t.speaker, gender: genders[i], voice: voices[i], text: t.text }
      })
      const questions = normalizeQuestions(r.questions, 2, 3)
      if (!questions) return null
      return {
        title: clean(r.title).slice(0, 80) || 'Conversation',
        clips: [{ context: clean(r.situation).slice(0, 60) || `${names[0]} and ${names[1]}`, lines, questions }],
      }
    }

    case 'announcement': {
      const sp = r.speaker && typeof r.speaker === 'object' ? (r.speaker as Record<string, unknown>) : {}
      const text = clean(r.text)
      const n = wordCount(text)
      if (n < 60 || n > 220) return null
      const gender = parseGender(sp.gender) ?? 'female'
      const [voice] = pickVoices([gender])
      const role = clean(sp.role)
      const name = role && role.length <= 24 ? role : clean(sp.name) || 'Announcer'
      const questions = normalizeQuestions(r.questions, 2, 3)
      if (!questions) return null
      return {
        title: clean(r.title).slice(0, 80) || 'Announcement',
        clips: [{
          context: clean(r.situation).slice(0, 60) || 'An announcement',
          lines: monologue(name.slice(0, 30), gender, voice, [text]),
          questions,
        }],
      }
    }

    case 'academic-talk': {
      const prof = r.professor && typeof r.professor === 'object' ? (r.professor as Record<string, unknown>) : {}
      const paragraphs = (Array.isArray(r.paragraphs) ? r.paragraphs : typeof r.text === 'string' ? [r.text] : [])
        .map(clean).filter(Boolean)
      const n = paragraphs.reduce((acc, p) => acc + wordCount(p), 0)
      if (n < 140 || n > 380) return null
      const gender = parseGender(prof.gender) ?? 'male'
      const [voice] = pickVoices([gender])
      const questions = normalizeQuestions(r.questions, 3, 4)
      if (!questions) return null
      return {
        title: clean(r.title).slice(0, 80) || 'Academic Talk',
        clips: [{
          context: '',
          lines: monologue(clean(prof.name).slice(0, 30) || 'Professor', gender, voice, paragraphs),
          questions,
        }],
      }
    }
  }
}

/** Shuffles each question's options (models tend to put the answer in the same slot). */
export function shuffleClipOptions(clips: ListeningClip[]): ListeningClip[] {
  return clips.map((c) => ({
    ...c,
    questions: c.questions.map((q) => {
      const order = shuffle(q.options.map((_, i) => i))
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) }
    }),
  }))
}

/* ── Fallbacks (raw JSON, run through the same normalizer) ── */

export const LISTENING_FALLBACKS: Record<ListeningTaskId, unknown> = {
  'choose-response': {
    items: [
      { situation: 'A classmate before a lecture', gender: 'female', line: 'Do you know if the professor posted the slides from last week?',
        options: ['Yes, they went up on the course page yesterday.', 'I posted a letter last week.', 'The professor is very tall.', 'No, I prefer the front row.'],
        answer: 0, explanation: 'It directly answers whether the slides were posted.' },
      { situation: 'A roommate in the kitchen', gender: 'male', line: "We're out of milk again. Could you grab some on your way home?",
        options: ['I drank milk as a child.', 'Sure, I pass the store anyway.', 'Home is where the heart is.', 'No, the kitchen is clean.'],
        answer: 1, explanation: 'It agrees to the request in a natural way.' },
      { situation: 'A librarian at the front desk', gender: 'female', line: 'This book is already reserved, but I can put you on the waiting list.',
        options: ['I already read the list.', 'The desk is made of wood.', 'Great, how long is the wait usually?', 'I reserved a table for dinner.'],
        answer: 2, explanation: 'It accepts the offer and asks a relevant follow-up question.' },
      { situation: 'A teammate after practice', gender: 'male', line: "I can't believe coach moved the game to Sunday morning.",
        options: ['I practiced on Monday.', 'Morning is before noon.', 'Yes, I moved last year.', "I know, I'll have to change my plans."],
        answer: 3, explanation: 'It reacts naturally to the surprising news.' },
      { situation: 'A coworker at a café job', gender: 'female', line: 'Would you mind covering my shift on Friday afternoon?',
        options: ["Not at all, I'm free that day.", 'The coffee is too hot.', 'Friday comes after Thursday.', 'I covered the cup with a lid.'],
        answer: 0, explanation: '"Not at all" correctly answers "Would you mind…" and agrees.' },
    ],
  },
  conversation: {
    title: 'A Broken Heater', situation: 'A student calls the housing office',
    speakers: [{ name: 'Maya', gender: 'female' }, { name: 'Tom', gender: 'male' }],
    turns: [
      { speaker: 'Tom', text: 'Housing office, this is Tom. How can I help?' },
      { speaker: 'Maya', text: "Hi, I'm Maya in Oak Hall, room 214. The heater in my room stopped working last night, and it's really cold." },
      { speaker: 'Tom', text: "Oh, I'm sorry about that. Have you tried the reset button on the side of the unit?" },
      { speaker: 'Maya', text: "Yes, twice. The light comes on, but there's no warm air at all." },
      { speaker: 'Tom', text: "Okay, then it's probably the fan. Our technician can come tomorrow between nine and noon. Will someone be in the room?" },
      { speaker: 'Maya', text: "I have a class at ten, but my roommate will be there. Is that okay?" },
      { speaker: 'Tom', text: "That's fine. Meanwhile, you can pick up a portable heater from the front desk tonight. Just bring your student ID." },
      { speaker: 'Maya', text: "Perfect, I'll go down right after dinner. Thanks so much." },
    ],
    questions: [
      { kind: 'main_idea', question: 'Why does Maya call the housing office?', options: ['To report a heater that is not working', 'To change her room', 'To ask about her class schedule', 'To complain about her roommate'], answer: 0, explanation: 'She says the heater in her room stopped working.' },
      { kind: 'detail', question: 'When will the technician come?', options: ['Tonight after dinner', 'Tomorrow between nine and noon', 'Tomorrow at ten', 'Next week'], answer: 1, explanation: 'Tom says the technician can come tomorrow between nine and noon.' },
      { kind: 'action', question: 'What will Maya probably do this evening?', options: ['Fix the fan herself', 'Go to her class', 'Get a portable heater from the front desk', 'Call the technician'], answer: 2, explanation: "She says she'll go down after dinner to pick up the heater." },
    ],
  },
  announcement: {
    title: 'Pool Maintenance', situation: 'An announcement at the campus gym',
    speaker: { name: 'Lisa', role: 'Gym manager', gender: 'female' },
    text: "Good afternoon, everyone. Please note that the campus swimming pool will be closed for maintenance from Monday, March third, through Friday, March seventh. During this time, the water filters will be replaced and the floor around the pool will be repaired. Swim team practices will move to the city pool on Pine Street, and a free shuttle will leave from the gym entrance at six a.m. and four p.m. All other gym facilities, including the weight room and the indoor track, will stay open as usual. If you had booked a swimming lesson that week, please visit the front desk to choose a new date. Thank you for your patience.",
    questions: [
      { kind: 'purpose', question: 'What is the main purpose of the announcement?', options: ['To inform people that the pool will be closed for a week', 'To advertise new swimming lessons', 'To announce a swim competition', 'To explain the gym membership prices'], answer: 0, explanation: 'The announcement explains the pool closure for maintenance.' },
      { kind: 'detail', question: 'Where will the swim team practice during the closure?', options: ['In the weight room', 'At the city pool on Pine Street', 'On the indoor track', 'At the gym entrance'], answer: 1, explanation: 'Practices move to the city pool on Pine Street.' },
      { kind: 'action', question: 'What should people with a swimming lesson that week do?', options: ['Take the shuttle at six a.m.', 'Cancel their membership', 'Choose a new date at the front desk', 'Call the city pool'], answer: 2, explanation: 'They are asked to visit the front desk to choose a new date.' },
    ],
  },
  'academic-talk': {
    title: 'The Spacing Effect', professor: { name: 'Professor Hale', gender: 'male' },
    paragraphs: [
      "Okay, so today I want to talk about something that can actually change the way you study. It's called the spacing effect. The basic idea is simple: we remember information much better when we study it several times with breaks in between, instead of all at once.",
      "Think about the night before an exam. Many students sit down and review everything for five hours straight. That's called cramming. And, well, it can work for the next morning. But a week later, most of that information is gone. Now imagine you studied the same material for one hour on five different days. Researchers have found that people who space out their study sessions remember far more, sometimes twice as much, after a month.",
      "Why does this happen? One explanation is that every time you return to the material, you have to work a little to recall it. That small effort actually strengthens the memory. So, a bit of forgetting between sessions is not a problem. It's part of how learning works. The practical lesson? Plan short, repeated reviews instead of one long session.",
    ],
    questions: [
      { kind: 'main_idea', question: 'What is the talk mainly about?', options: ['Why spacing out study sessions improves memory', 'How to sleep better before exams', 'Why some students fail their exams', 'How researchers design memory tests'], answer: 0, explanation: 'The professor explains the spacing effect and why it works.' },
      { kind: 'detail', question: 'According to the professor, what is a weakness of cramming?', options: ['It takes too many days.', 'Most of the information is forgotten a week later.', 'It is impossible to do at night.', 'It requires a study partner.'], answer: 1, explanation: 'He says that a week later, most of the information is gone.' },
      { kind: 'detail', question: 'Why does spacing strengthen memory, according to one explanation?', options: ['Breaks make students less tired.', 'Students read faster after a break.', 'The effort of recalling information makes the memory stronger.', 'Spaced sessions are always longer.'], answer: 2, explanation: 'Recalling with a little effort strengthens the memory.' },
      { kind: 'purpose', question: 'Why does the professor mention the night before an exam?', options: ['To recommend studying late at night', 'To describe a common habit that contrasts with spacing', 'To explain how exams are scheduled', 'To show that sleep is unimportant'], answer: 1, explanation: 'Cramming is used as the contrast to spaced study.' },
    ],
  },
}
