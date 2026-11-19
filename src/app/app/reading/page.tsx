import SkillHub, { type ExtraMode } from '@/components/exam/SkillHub'

const EXTRAS: ExtraMode[] = [
  {
    id: 'library', title: 'Kütüphane', tag: 'Library', emoji: '📚', href: '/app/reading/library',
    desc: 'Raflardaki metinlerden birini seçip oku.',
  },
]

export default function ReadingPage() {
  return <SkillHub skill="reading" extras={EXTRAS} />
}
