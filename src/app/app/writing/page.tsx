import SkillHub, { type ExtraMode } from '@/components/exam/SkillHub'

const EXTRAS: ExtraMode[] = [
  {
    id: 'predetermined', title: 'Konum Var', tag: 'Essay', emoji: '📌', href: '/app/writing/predetermined',
    desc: 'Kendi belirlediğin bir konuyla deneme yaz.',
  },
  {
    id: 'random', title: 'Rastgele', tag: 'Random Topic', emoji: '🎲', href: '/app/writing/random',
    desc: 'AI sana rastgele bir deneme konusu atar.',
  },
]

export default function WritingPage() {
  return <SkillHub skill="writing" extras={EXTRAS} />
}
