import type { CompleteWordsSegment, ToeflLevel } from './types'

export const COMPLETE_WORDS_GAPS = 10

export const COMPLETE_WORDS_TOPICS = [
  'how bees communicate',
  'the history of paper money',
  'why some deserts bloom after rain',
  'the invention of the printing press',
  'how sleep affects memory',
  'coral reefs and ocean temperature',
  'the migration of monarch butterflies',
  'early human use of fire',
  'how volcanoes create new land',
  'the role of bacteria in digestion',
  'the development of written language',
  'why the moon has phases',
  'urban heat islands',
  'how plants respond to light',
  'ancient trade routes',
] as const

export function completeWordsPrompt(level: ToeflLevel, topic: string, levelGuide: string) {
  return `You write passages for the TOEFL iBT "Complete the Words" reading task.
Write one short, factual, academic-style paragraph like a university textbook excerpt.

Topic: ${topic}
Difficulty: ${levelGuide}

Rules:
- 70 to 100 words, 4 to 6 sentences, one paragraph.
- Plain prose only: no lists, headings, quotes, numbers written as digits, or abbreviations.
- The first sentence introduces the topic.
- Accurate, neutral, self-contained.

Return ONLY a JSON object, no explanation:
{"title":"short title","paragraph":"..."}
Level label: ${level}.`
}

export function normalizeParagraph(raw: unknown): { title: string; paragraph: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.paragraph !== 'string') return null
  const paragraph = r.paragraph.trim().replace(/\s+/g, ' ')
  const wordCount = paragraph.split(' ').length
  if (wordCount < 50 || wordCount > 140) return null
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 80) : 'Reading Passage'
  return { title, paragraph }
}

/**
 * Turns a paragraph into a C-test (TOEFL "Complete the Words"):
 * the first sentence stays intact; from the second sentence on, every second
 * word loses the second half of its letters, until `gapCount` gaps exist.
 */
export function damageParagraph(
  paragraph: string,
  gapCount = COMPLETE_WORDS_GAPS
): { segments: CompleteWordsSegment[]; gapCount: number } {
  const firstSentenceEnd = paragraph.search(/[.!?]\s/)
  const startAt = firstSentenceEnd === -1 ? 0 : firstSentenceEnd + 1

  const segments: CompleteWordsSegment[] = []
  let cursor = 0
  let wordIndex = 0
  let gaps = 0

  const pushText = (value: string) => {
    if (!value) return
    const last = segments[segments.length - 1]
    if (last?.type === 'text') last.value += value
    else segments.push({ type: 'text', value })
  }

  const wordRe = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g
  let match: RegExpExecArray | null
  while ((match = wordRe.exec(paragraph)) !== null) {
    if (match.index < startAt) continue

    wordIndex++
    const word = match[0]
    const target = wordIndex % 2 === 0
    const damageable = /^[A-Za-z]{2,}$/.test(word)

    if (gaps < gapCount && target && damageable) {
      const keep = Math.max(1, Math.floor(word.length / 2))
      pushText(paragraph.slice(cursor, match.index))
      segments.push({ type: 'gap', index: gaps, prefix: word.slice(0, keep), missing: word.slice(keep) })
      cursor = match.index + word.length
      gaps++
    } else if (target && !damageable) {
      // Shift the rhythm so the next word becomes the target instead.
      wordIndex--
    }
  }
  pushText(paragraph.slice(cursor))

  return { segments, gapCount: gaps }
}

export const FALLBACK_PARAGRAPHS: Array<{ title: string; topic: string; paragraph: string }> = [
  {
    title: 'How Bees Share Directions',
    topic: 'how bees communicate',
    paragraph:
      'Honeybees have a remarkable way of telling one another where to find food. When a worker bee discovers a rich patch of flowers, she returns to the hive and performs a special movement known as the waggle dance. The angle of the dance shows the direction of the food relative to the sun. The length of each waggle tells other bees how far they must travel. Scientists have found that this system allows a colony to gather nectar very efficiently across a large area.',
  },
  {
    title: 'Sleep and Memory',
    topic: 'how sleep affects memory',
    paragraph:
      'Sleep plays an important role in how the brain stores new information. During the day, people take in many experiences that are only held briefly. While we sleep, the brain replays some of these experiences and moves them into long term storage. Researchers have shown that students who sleep after studying remember more than those who stay awake. This suggests that a good night of rest is not wasted time but an essential part of learning.',
  },
  {
    title: 'The Printing Press',
    topic: 'the invention of the printing press',
    paragraph:
      'The printing press changed the way knowledge spread across Europe. Before its invention, books were copied by hand, which made them rare and very expensive. The new machine used movable metal letters that could be arranged and reused many times. As a result, printers could produce hundreds of identical pages in a single day. Cheaper books helped more people learn to read, and new ideas in science and religion traveled faster than ever before.',
  },
  {
    title: 'Urban Heat Islands',
    topic: 'urban heat islands',
    paragraph:
      'Cities are often noticeably warmer than the countryside that surrounds them. This effect is called an urban heat island. Dark roads and rooftops absorb sunlight during the day and release the stored heat slowly at night. In addition, cities usually have fewer trees, which normally cool the air by providing shade and releasing moisture. Planners now try to reduce the problem by adding parks, planting trees along streets, and using lighter building materials.',
  },
]
