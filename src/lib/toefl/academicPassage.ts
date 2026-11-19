import type { PassageQuestion, PassageQuestionType, ToeflLevel } from './types'
import { shuffle } from './utils'

export const PASSAGE_QUESTION_COUNT = 5

export const QUESTION_TYPE_LABEL: Record<PassageQuestionType, string> = {
  main_idea: 'Main Idea',
  detail: 'Detail',
  vocabulary: 'Vocabulary',
  inference: 'Inference',
  purpose: 'Author’s Purpose',
}

const TYPES = Object.keys(QUESTION_TYPE_LABEL) as PassageQuestionType[]

export const ACADEMIC_PASSAGE_TOPICS = [
  'the domestication of the horse',
  'how coral reefs form',
  'the economics of the Silk Road',
  'cognitive load and learning',
  'the origins of impressionist painting',
  'plate tectonics and earthquakes',
  'the psychology of habit formation',
  'pollination and plant evolution',
  'urbanization in the industrial revolution',
  'the discovery of penicillin',
  'desert adaptations in animals',
  'the development of early writing systems',
  'ocean currents and climate',
  'the sociology of social media communities',
  'glaciers as records of past climate',
] as const

export function academicPassagePrompt(level: ToeflLevel, topic: string, levelGuide: string) {
  return `You write items for the TOEFL iBT "Read an Academic Passage" task.

Topic: ${topic}
Difficulty: ${levelGuide}

1) Write an academic passage like a university textbook excerpt:
   - 180 to 250 words, split into 2 or 3 paragraphs.
   - Factual, neutral, self-contained; no background knowledge required.
2) Write exactly ${PASSAGE_QUESTION_COUNT} multiple-choice questions about it, using these types in this order:
   "main_idea", "detail", "vocabulary", "inference", "purpose".
   - Each question has exactly 4 options; exactly one is correct and the others are plausible but clearly wrong according to the passage.
   - "vocabulary": ask for the meaning of ONE word as used in the passage; set "highlight" to that exact word as it appears in the passage.
   - "purpose": ask why the author mentions a specific detail or paragraph.
   - "explanation": one short sentence saying why the correct answer is right, citing the passage.
   - "answer": the 0-based index of the correct option.

Return ONLY a JSON object, no explanation:
{"title":"...","paragraphs":["...","..."],"questions":[{"type":"main_idea","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","highlight":""}]}
Level label: ${level}.`
}

export function normalizePassage(
  raw: unknown
): { title: string; paragraphs: string[]; questions: PassageQuestion[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const paragraphs = (Array.isArray(r.paragraphs) ? r.paragraphs : typeof r.passage === 'string' ? r.passage.split(/\n\s*\n/) : [])
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
  const words = paragraphs.join(' ').split(' ').length
  if (paragraphs.length === 0 || words < 120 || words > 380) return null

  const fullText = paragraphs.join(' ').toLowerCase()
  const questions: PassageQuestion[] = []
  for (const q of Array.isArray(r.questions) ? r.questions : []) {
    const item = normalizeQuestion(q, fullText)
    if (item) questions.push(item)
  }
  if (questions.length < 4) return null

  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 90) : 'Academic Passage'
  return { title, paragraphs, questions: questions.slice(0, PASSAGE_QUESTION_COUNT) }
}

export function normalizeQuestion(raw: unknown, passageLower: string): PassageQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  if (typeof q.question !== 'string' || !q.question.trim()) return null
  if (!Array.isArray(q.options) || q.options.length !== 4) return null
  const options = q.options.map((o) => (typeof o === 'string' ? o.trim() : ''))
  if (options.some((o) => !o) || new Set(options.map((o) => o.toLowerCase())).size !== 4) return null
  const answer = Number(q.answer)
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return null

  const type = TYPES.includes(q.type as PassageQuestionType) ? (q.type as PassageQuestionType) : 'detail'
  const highlight =
    typeof q.highlight === 'string' && q.highlight.trim() && passageLower.includes(q.highlight.trim().toLowerCase())
      ? q.highlight.trim()
      : undefined

  return {
    type,
    question: q.question.trim(),
    options,
    answer,
    explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    highlight: type === 'vocabulary' ? highlight : undefined,
  }
}

/** Shuffles each question's options (models tend to put the answer in the same slot). */
export function shuffleOptions(questions: PassageQuestion[]): PassageQuestion[] {
  return questions.map((q) => {
    const order = shuffle(q.options.map((_, i) => i))
    return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) }
  })
}

export const FALLBACK_PASSAGES: Array<{ topic: string; title: string; paragraphs: string[]; questions: PassageQuestion[] }> = [
  {
    topic: 'pollination and plant evolution',
    title: 'Flowers and Their Pollinators',
    paragraphs: [
      'Most flowering plants cannot move, so they depend on animals to carry pollen from one flower to another. Over millions of years, many plants and their pollinators have evolved together, a process known as coevolution. As a result, the shape, color, and scent of a flower often reveal which animal visits it most frequently.',
      'Flowers pollinated by bees, for example, are usually blue or yellow and give off a sweet scent, because bees see these colors well and are guided by smell. In contrast, flowers that rely on hummingbirds tend to be bright red and nearly odorless. Birds have a poor sense of smell, but they are highly sensitive to red light. These flowers also produce large amounts of thin nectar, which supplies the energy that hovering birds need.',
      'This close relationship has advantages and risks. A specialized flower wastes less pollen, since its visitor is likely to travel to another flower of the same species. However, if that single pollinator declines, the plant may struggle to reproduce. For this reason, ecologists monitor pollinator populations closely, viewing them as indicators of the health of an entire ecosystem.',
    ],
    questions: [
      {
        type: 'main_idea', question: 'What is the passage mainly about?',
        options: [
          'How flowers and their animal pollinators have shaped each other',
          'Why bees are more important than hummingbirds',
          'How scientists grow flowers in laboratories',
          'Why some plants do not need pollination',
        ],
        answer: 0, explanation: 'The passage describes coevolution between flowers and pollinators and its consequences.',
      },
      {
        type: 'detail', question: 'According to the passage, why are hummingbird flowers often red?',
        options: [
          'Red flowers produce more pollen.',
          'Hummingbirds are very sensitive to red light.',
          'Red petals protect nectar from bees.',
          'Red is the easiest color for plants to produce.',
        ],
        answer: 1, explanation: 'Paragraph 2 states that birds "are highly sensitive to red light."',
      },
      {
        type: 'vocabulary', question: 'The word "specialized" in the passage is closest in meaning to',
        options: ['adapted to one particular use', 'extremely rare', 'very colorful', 'recently discovered'],
        answer: 0, explanation: 'A specialized flower is adapted to a single type of visitor.', highlight: 'specialized',
      },
      {
        type: 'inference', question: 'What can be inferred about a plant that relies on only one pollinator?',
        options: [
          'It produces more seeds than other plants.',
          'It does not need nectar.',
          'Its survival depends heavily on that pollinator.',
          'It can easily switch to a new pollinator.',
        ],
        answer: 2, explanation: 'Paragraph 3 says the plant may struggle to reproduce if its pollinator declines.',
      },
      {
        type: 'purpose', question: 'Why does the author mention ecologists in the final paragraph?',
        options: [
          'To criticize how pollinators are studied',
          'To show that pollinator decline is a broader ecological concern',
          'To introduce a new theory of coevolution',
          'To explain how flowers attract bees',
        ],
        answer: 1, explanation: 'Ecologists treat pollinators as indicators of ecosystem health.',
      },
    ],
  },
]
