import { normalizeQuestion } from './academicPassage'
import type { DailyGenre, DailyMessage, DailyText, PassageQuestion, ToeflLevel } from './types'

export const DAILY_QUESTION_COUNT = 3

export const GENRE_LABEL: Record<DailyGenre, string> = {
  email: 'E-posta',
  notice: 'Duyuru',
  menu: 'Menü',
  schedule: 'Program',
  messages: 'Mesajlaşma',
  social: 'Sosyal Medya',
  web: 'Web Sayfası',
}

const GENRES = Object.keys(GENRE_LABEL) as DailyGenre[]

export type DailyScenario = { genre: DailyGenre; scenario: string }

export const DAILY_SCENARIOS: readonly DailyScenario[] = [
  { genre: 'email', scenario: 'a university housing office telling residents about planned water maintenance' },
  { genre: 'email', scenario: 'a professor replying to a student who asked for a deadline extension' },
  { genre: 'email', scenario: 'an online store confirming an order and explaining a shipping delay' },
  { genre: 'notice', scenario: 'a campus library notice about changed opening hours during final exams' },
  { genre: 'notice', scenario: 'an apartment building sign about a new recycling rule' },
  { genre: 'notice', scenario: 'a poster for a student volunteer day at a community garden' },
  { genre: 'menu', scenario: 'a campus café menu with prices, a daily special and a student discount' },
  { genre: 'menu', scenario: 'a food truck menu with combo deals and a note about allergies' },
  { genre: 'schedule', scenario: 'a weekend shuttle bus timetable between campus and downtown' },
  { genre: 'schedule', scenario: 'a fitness center weekly class schedule with room changes' },
  { genre: 'messages', scenario: 'two roommates texting about splitting grocery costs and cleaning' },
  { genre: 'messages', scenario: 'two classmates texting to reschedule a group project meeting' },
  { genre: 'social', scenario: 'a student photography club post announcing an exhibition' },
  { genre: 'social', scenario: 'a local bakery post about a holiday closing and a new product' },
  { genre: 'web', scenario: 'a city bike-sharing web page explaining membership options' },
  { genre: 'web', scenario: 'a museum web page with visiting information and ticket rules' },
]

const SHAPE_HINT: Record<DailyGenre, string> = {
  email: '"sender": the sender\'s name and role; "title": the email subject line; "lines": the email body paragraphs including greeting and sign-off.',
  notice: '"sender": the organization posting it; "title": the notice headline; "lines": short lines of the notice.',
  menu: '"sender": the place name; "title": the menu name; "lines": one item per line written as "Item name | $price", plus 1-2 plain note lines without "|".',
  schedule: '"sender": the organization; "title": the schedule name; "lines": one entry per line written as "Day/time | what happens", plus 1-2 plain note lines without "|".',
  messages: '"sender": empty; "title": a short chat name; "lines": empty array; "messages": 5 to 8 messages between exactly two people, each {"from":"FirstName","text":"..."}.',
  social: '"sender": the account name starting with @; "title": a short post headline; "lines": the post text in 1-3 short paragraphs.',
  web: '"sender": the website name; "title": the page heading; "lines": short paragraphs or bullet-style lines.',
}

export function dailyLifePrompt(level: ToeflLevel, s: DailyScenario, levelGuide: string) {
  return `You write items for the TOEFL iBT "Read in Daily Life" task: short, non-academic, real-world texts.

Text type: ${s.genre}
Situation: ${s.scenario}
Difficulty: ${levelGuide}

1) Write the text: 60 to 140 words in total, realistic and specific (names, times, places, prices where natural).
   ${SHAPE_HINT[s.genre]}
2) Write exactly ${DAILY_QUESTION_COUNT} multiple-choice questions, using these types in this order: "purpose", "detail", "inference".
   - "purpose": the main purpose of the text or why it was written.
   - "detail": a specific fact stated in the text.
   - "inference": something not stated directly but clearly implied.
   - Each question has exactly 4 options; exactly one is correct, the others are plausible but wrong according to the text.
   - "explanation": one short sentence saying why the correct answer is right, citing the text.
   - "answer": the 0-based index of the correct option.

Return ONLY a JSON object, no explanation:
{"sender":"...","title":"...","lines":["..."],"messages":[],"questions":[{"type":"purpose","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}
Level label: ${level}.`
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

export function normalizeDailyText(
  raw: unknown,
  genre: DailyGenre
): { text: DailyText; questions: PassageQuestion[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const lines = (Array.isArray(r.lines) ? r.lines : []).map(clean).filter(Boolean)
  const messages: DailyMessage[] = (Array.isArray(r.messages) ? r.messages : [])
    .map((m) => (m && typeof m === 'object' ? m as Record<string, unknown> : {}))
    .map((m) => ({ from: clean(m.from).slice(0, 24), text: clean(m.text) }))
    .filter((m) => m.from && m.text)

  if (genre === 'messages') {
    if (messages.length < 3 || new Set(messages.map((m) => m.from)).size < 2) return null
  } else if (lines.length === 0) {
    return null
  }

  const body = genre === 'messages' ? messages.map((m) => m.text) : lines
  const words = body.join(' ').split(/\s+/).length
  if (words < 25 || words > 220) return null

  const lower = body.join(' ').toLowerCase()
  const questions: PassageQuestion[] = []
  for (const q of Array.isArray(r.questions) ? r.questions : []) {
    const item = normalizeQuestion(q, lower)
    if (item) questions.push(item)
  }
  if (questions.length < 2) return null

  const text: DailyText = {
    genre: GENRES.includes(genre) ? genre : 'notice',
    title: clean(r.title).slice(0, 80) || GENRE_LABEL[genre],
    sender: clean(r.sender).slice(0, 60) || undefined,
    lines: genre === 'messages' ? [] : lines,
    messages: genre === 'messages' ? messages : undefined,
  }
  return { text, questions: questions.slice(0, DAILY_QUESTION_COUNT) }
}

/** Splits a menu / schedule line written as "left | right". */
export function splitRow(line: string): [string, string] | null {
  const i = line.indexOf('|')
  if (i < 0) return null
  const left = line.slice(0, i).trim()
  const right = line.slice(i + 1).trim()
  return left && right ? [left, right] : null
}

export const FALLBACK_DAILY: Array<{ scenario: string; text: DailyText; questions: PassageQuestion[] }> = [
  {
    scenario: 'a campus library notice about changed opening hours during final exams',
    text: {
      genre: 'notice',
      sender: 'Hamilton Library',
      title: 'Extended Hours for Finals Week',
      lines: [
        'From Monday, May 6 to Friday, May 17, the library will stay open until 2:00 a.m.',
        'The second floor will be a silent study zone. Group rooms can be booked online for up to two hours per day.',
        'The café will close at 10:00 p.m. as usual, but free coffee will be available in the lobby after 11:00 p.m.',
        'Please bring your student ID. You will need it to enter after 9:00 p.m.',
      ],
    },
    questions: [
      {
        type: 'purpose', question: 'What is the main purpose of the notice?',
        options: [
          'To inform students about special library arrangements during exams',
          'To announce that the library café is closing permanently',
          'To ask students to volunteer at the library',
          'To explain how to apply for a student ID',
        ],
        answer: 0, explanation: 'The notice lists longer hours and other changes for finals week.',
      },
      {
        type: 'detail', question: 'How long can a group room be booked each day?',
        options: ['Thirty minutes', 'One hour', 'Two hours', 'Until 2:00 a.m.'],
        answer: 2, explanation: 'The notice says group rooms can be booked "for up to two hours per day."',
      },
      {
        type: 'inference', question: 'What can be inferred about a student who arrives at 10:30 p.m. without an ID?',
        options: [
          'They can buy coffee at the café.',
          'They will probably not be allowed to enter.',
          'They can book a group room at the entrance.',
          'They must go to the second floor.',
        ],
        answer: 1, explanation: 'An ID is needed to enter after 9:00 p.m., so entry at 10:30 p.m. without one is unlikely.',
      },
    ],
  },
  {
    scenario: 'two classmates texting to reschedule a group project meeting',
    text: {
      genre: 'messages',
      title: 'Bio Project 🌱',
      lines: [],
      messages: [
        { from: 'Leah', text: 'Hey, are we still meeting at 4 tomorrow? My shift at the bookstore got moved to the afternoon.' },
        { from: 'Omar', text: 'Oh no. Could you do the morning instead? I have class until 11 but I\'m free after that.' },
        { from: 'Leah', text: '11:30 works! Library or the student center?' },
        { from: 'Omar', text: 'Student center. The library rooms are always full this week.' },
        { from: 'Leah', text: 'Perfect. I\'ll bring the survey results. Can you print the draft slides?' },
        { from: 'Omar', text: 'Sure, I\'ll print two copies. See you there!' },
      ],
    },
    questions: [
      {
        type: 'purpose', question: 'Why does Leah start the conversation?',
        options: [
          'To ask Omar to work at the bookstore',
          'To change the time of their meeting',
          'To cancel the project',
          'To complain about the library',
        ],
        answer: 1, explanation: 'Her shift moved to the afternoon, so she cannot meet at 4.',
      },
      {
        type: 'detail', question: 'What will Omar bring to the meeting?',
        options: ['The survey results', 'Coffee for both of them', 'Printed copies of the slides', 'A library room key'],
        answer: 2, explanation: 'Omar says, "I\'ll print two copies" of the draft slides.',
      },
      {
        type: 'inference', question: 'What can be inferred about the library this week?',
        options: [
          'It is closed for repairs.',
          'It is very busy.',
          'It opens only in the afternoon.',
          'It does not allow group work.',
        ],
        answer: 1, explanation: 'Omar says the library rooms are always full this week.',
      },
    ],
  },
]
