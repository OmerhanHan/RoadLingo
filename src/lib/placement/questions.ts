/**
 * Onboarding placement test — question bank.
 *
 * NOTE: The content below is PLACEHOLDER material so the screen can be shown.
 * The real TOEFL / IELTS question sets will replace `PLACEMENT_QUESTIONS`
 * (or be generated per exam) later; the UI only depends on these types.
 */

import type { SpokenLine } from '@/lib/speaking/tts/voices'

export type ExamId = 'toefl' | 'ielts'

export type PlacementSection = 'grammar' | 'vocabulary' | 'reading' | 'listening'

export type PlacementQuestion = {
  id: string
  section: PlacementSection
  /** Short instruction shown above the question. */
  instruction: string
  prompt: string
  /** Optional passage for reading questions. */
  passage?: string
  /** Listening audio: lines read aloud with a voice matching each speaker's gender. */
  dialogue?: SpokenLine[]
  options: string[]
  answer: number
}

export const SECTION_META: Record<PlacementSection, { label: string; icon: string }> = {
  grammar:    { label: 'Grammar',    icon: '✎' },
  vocabulary: { label: 'Vocabulary', icon: 'Aa' },
  reading:    { label: 'Reading',    icon: '❏' },
  listening:  { label: 'Listening',  icon: '♪' },
}

export const EXAM_META: Record<ExamId, { label: string; max: number; min: number; step: number; minutes: number }> = {
  toefl: { label: 'TOEFL', min: 1, max: 6, step: 0.5, minutes: 10 },
  ielts: { label: 'IELTS', min: 1, max: 9, step: 0.5, minutes: 10 },
}

const PASSAGE =
  'Many cities are now turning empty rooftops into small gardens. These green roofs absorb rainwater, keep buildings cooler in summer, and give insects such as bees a place to feed. Although they cost more to build at first, owners often save money on energy within a few years.'

const BASE_QUESTIONS: PlacementQuestion[] = [
  {
    id: 'g1', section: 'grammar', instruction: 'Boşluğa en uygun seçeneği seç.',
    prompt: 'She ___ to the library every Saturday morning.',
    options: ['go', 'goes', 'going', 'is go'], answer: 1,
  },
  {
    id: 'v1', section: 'vocabulary', instruction: 'Altı çizili kelimeye en yakın anlamı seç.',
    prompt: 'The results of the experiment were quite *surprising*.',
    options: ['expected', 'boring', 'unexpected', 'difficult'], answer: 2,
  },
  {
    id: 'r1', section: 'reading', instruction: 'Paragrafı oku ve soruyu cevapla.',
    passage: PASSAGE,
    prompt: 'What is the main idea of the passage?',
    options: [
      'Rooftop gardens are too expensive for most cities.',
      'Green roofs offer several benefits to cities.',
      'Bees are disappearing from urban areas.',
      'Buildings use too much energy in summer.',
    ],
    answer: 1,
  },
  {
    id: 'g2', section: 'grammar', instruction: 'Boşluğa en uygun seçeneği seç.',
    prompt: 'If I ___ more time, I would learn another language.',
    options: ['have', 'had', 'will have', 'having'], answer: 1,
  },
  {
    id: 'l1', section: 'listening', instruction: 'Kaydı dinle ve soruyu cevapla.',
    dialogue: [
      { speaker: 'A', gender: 'female', text: 'Excuse me, could you tell me when the next train to the airport leaves?' },
      { speaker: 'B', gender: 'male', text: 'Sure, it leaves at ten fifteen from platform three.' },
    ],
    prompt: 'According to the man, when does the next train leave?',
    options: ['At 10:05', 'At 10:15', 'At 10:50', 'At 3:15'], answer: 1,
  },
  {
    id: 'v2', section: 'vocabulary', instruction: 'Boşluğa en uygun kelimeyi seç.',
    prompt: 'The professor asked us to ___ our essays before the deadline.',
    options: ['submit', 'admit', 'commit', 'permit'], answer: 0,
  },
  {
    id: 'r2', section: 'reading', instruction: 'Paragrafı oku ve soruyu cevapla.',
    passage: PASSAGE,
    prompt: 'According to the passage, why might owners build green roofs despite the cost?',
    options: [
      'Because the government requires them.',
      'Because they attract more tenants.',
      'Because they can reduce energy costs over time.',
      'Because they are easy to maintain.',
    ],
    answer: 2,
  },
  {
    id: 'g3', section: 'grammar', instruction: 'Hatalı kısmı seç.',
    prompt: 'Neither the students nor the teacher were aware of the change.',
    options: ['Neither', 'nor the teacher', 'were aware', 'of the change'], answer: 2,
  },
  {
    id: 'l2', section: 'listening', instruction: 'Kaydı dinle ve soruyu cevapla.',
    dialogue: [
      { speaker: 'A', gender: 'male', text: 'Are you going to study in the library tonight?' },
      { speaker: 'B', gender: 'female', text: 'I was planning to, but it closes early on Fridays, so I will work at the coffee shop instead.' },
    ],
    prompt: 'Where will the woman study tonight?',
    options: ['At home', 'In the library', 'At a coffee shop', 'In a classroom'], answer: 2,
  },
  {
    id: 'v3', section: 'vocabulary', instruction: 'Altı çizili kelimeye en yakın anlamı seç.',
    prompt: 'The new policy had a *significant* impact on local businesses.',
    options: ['minor', 'considerable', 'temporary', 'negative'], answer: 1,
  },
  {
    id: 'r3', section: 'reading', instruction: 'Paragrafı oku ve soruyu cevapla.',
    passage: PASSAGE,
    prompt: 'The word "absorb" in the passage is closest in meaning to…',
    options: ['take in', 'push away', 'clean', 'store up'], answer: 0,
  },
  {
    id: 'g4', section: 'grammar', instruction: 'Boşluğa en uygun seçeneği seç.',
    prompt: 'By the time we arrived, the lecture ___.',
    options: ['already started', 'has already started', 'had already started', 'was already start'], answer: 2,
  },
]

export function getPlacementQuestions(exam: ExamId): PlacementQuestion[] {
  // Placeholder: both exams share the same demo set for now.
  void exam
  return BASE_QUESTIONS
}

export type PlacementResult = {
  exam: ExamId
  correct: number
  total: number
  estimatedScore: number
  cefr: string
  bySection: Record<PlacementSection, { correct: number; total: number }>
  durationSec: number
  completedAt: string
}

const CEFR_BANDS: Array<[number, string]> = [
  [0.9, 'C1'], [0.75, 'B2'], [0.55, 'B1'], [0.35, 'A2'], [0, 'A1'],
]

/** Very rough demo mapping from accuracy to the exam's score scale. */
export function scorePlacement(
  exam: ExamId,
  questions: PlacementQuestion[],
  answers: (number | null)[],
  durationSec: number
): PlacementResult {
  const { min, max, step } = EXAM_META[exam]
  const bySection = Object.fromEntries(
    (Object.keys(SECTION_META) as PlacementSection[]).map((s) => [s, { correct: 0, total: 0 }])
  ) as PlacementResult['bySection']

  let correct = 0
  questions.forEach((q, i) => {
    const ok = answers[i] === q.answer
    bySection[q.section].total++
    if (ok) {
      bySection[q.section].correct++
      correct++
    }
  })

  const ratio = questions.length ? correct / questions.length : 0
  const raw = min + ratio * (max - min)
  const estimatedScore = Math.round(raw / step) * step
  const cefr = CEFR_BANDS.find(([threshold]) => ratio >= threshold)?.[1] ?? 'A1'

  return {
    exam, correct, total: questions.length, estimatedScore, cefr, bySection, durationSec,
    completedAt: new Date().toISOString(),
  }
}
