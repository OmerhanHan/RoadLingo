/**
 * Gender → pocket-tts voice mapping (client- and server-safe).
 * Only voices whose speaker gender is known are listed (VCTK / Kyutai voice sets).
 */

export type Gender = 'male' | 'female'

export const POCKET_VOICES: Record<Gender, readonly string[]> = {
  male: ['marius', 'charles', 'paul', 'george', 'michael'],
  female: ['alba', 'anna', 'vera', 'mary', 'jane', 'eve'],
}

export function parseGender(value: unknown): Gender | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (['male', 'man', 'm', 'boy', 'he'].includes(v)) return 'male'
  if (['female', 'woman', 'f', 'girl', 'she'].includes(v)) return 'female'
  return null
}

export function randomGender(): Gender {
  return Math.random() < 0.5 ? 'male' : 'female'
}

/** Picks one voice per speaker; speakers sharing a gender get different voices. */
export function pickVoices(genders: Gender[]): string[] {
  const used = new Set<string>()
  return genders.map((g) => {
    const pool = POCKET_VOICES[g].filter((v) => !used.has(v))
    const list = pool.length ? pool : POCKET_VOICES[g]
    const voice = list[Math.floor(Math.random() * list.length)]
    used.add(voice)
    return voice
  })
}

export type SpokenLine = { speaker: string; gender: Gender; text: string }

/**
 * Deterministically maps each distinct speaker of a dialogue to a gender-matched voice
 * (same speaker → same voice; different speakers of the same gender → different voices).
 */
export function voiceDialogue(lines: SpokenLine[]): Array<{ text: string; voice: string }> {
  const bySpeaker = new Map<string, string>()
  const usedCount: Record<Gender, number> = { male: 0, female: 0 }
  return lines.map((line) => {
    let voice = bySpeaker.get(line.speaker)
    if (!voice) {
      const pool = POCKET_VOICES[line.gender]
      voice = pool[usedCount[line.gender]++ % pool.length]
      bySpeaker.set(line.speaker, voice)
    }
    return { text: line.text, voice }
  })
}
