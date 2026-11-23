/**
 * Exam structure: main skill sections and their task types.
 * Hub pages (/app/reading, /app/writing, /app/listening, /app/speaking) and the
 * home screen are rendered from this config — add a task here and set its `href`
 * + `status: 'ready'` once its practice page exists.
 */

export type SkillId = 'reading' | 'writing' | 'listening' | 'speaking'

export type ExamTask = {
  id: string
  /** Official task name, e.g. "Complete the Words". */
  title: string
  /** Short Turkish name. */
  titleTr: string
  desc: string
  emoji: string
  status: 'ready' | 'soon'
  href?: string
}

export type SkillSection = {
  id: SkillId
  label: string
  labelTr: string
  emoji: string
  href: string
  tip?: string
  tasks: ExamTask[]
}

export const TOEFL_SECTIONS: SkillSection[] = [
  {
    id: 'reading',
    label: 'Reading',
    labelTr: 'Okuma',
    emoji: '📖',
    href: '/app/reading',
    tip: 'Reading bölümünde zaman baskısı yüksektir. Önce soruya göz at, sonra metinde cevabı ara.',
    tasks: [
      {
        id: 'complete-words', title: 'Complete the Words', titleTr: 'Eksik Harfler', emoji: '🔤',
        desc: 'Paragraftaki kelimelerin eksik harflerini tamamla.',
        status: 'ready', href: '/app/reading/complete-words',
      },
      {
        id: 'daily-life', title: 'Read in Daily Life', titleTr: 'Günlük Hayatta Okuma', emoji: '🧾',
        desc: 'İlan, e-posta, menü gibi kısa günlük metinleri anla.',
        status: 'ready', href: '/app/reading/daily-life',
      },
      {
        id: 'academic-passage', title: 'Read an Academic Passage', titleTr: 'Akademik Metin', emoji: '🎓',
        desc: 'Akademik bir pasajı oku ve soruları cevapla.',
        status: 'ready', href: '/app/reading/academic-passage',
      },
    ],
  },
  {
    id: 'writing',
    label: 'Writing',
    labelTr: 'Yazma',
    emoji: '✍️',
    href: '/app/writing',
    tip: 'E-postada amaca uygun ton, akademik tartışmada net bir görüş ve gerekçe ara.',
    tasks: [
      {
        id: 'build-sentence', title: 'Build a Sentence', titleTr: 'Cümle Kur', emoji: '🧩',
        desc: 'Karışık kelimeleri doğru sıraya dizerek cevap cümlesini kur.',
        status: 'ready', href: '/app/writing/build-sentence',
      },
      {
        id: 'email', title: 'Write an Email', titleTr: 'E-posta Yaz', emoji: '✉️',
        desc: 'Verilen duruma uygun bir e-postayı sınırlı sürede yaz.',
        status: 'ready', href: '/app/writing/email',
      },
      {
        id: 'academic-discussion', title: 'Write for an Academic Discussion', titleTr: 'Akademik Tartışma', emoji: '💬',
        desc: 'Profesörün sorusuna ve öğrenci görüşlerine katkı yaz.',
        status: 'ready', href: '/app/writing/academic-discussion',
      },
    ],
  },
  {
    id: 'listening',
    label: 'Listening',
    labelTr: 'Dinleme',
    emoji: '🎧',
    href: '/app/listening',
    tip: 'Kayıtlar yalnızca bir kez çalar. Konuşmacının amacına ve tonuna odaklan.',
    tasks: [
      {
        id: 'choose-response', title: 'Listen and Choose a Response', titleTr: 'Cevabı Seç', emoji: '🗨️',
        desc: 'Duyduğun cümleye en uygun cevabı seç.',
        status: 'ready', href: '/app/listening/choose-response',
      },
      {
        id: 'conversation', title: 'Listen to a Conversation', titleTr: 'Konuşma Dinle', emoji: '👥',
        desc: 'İki kişi arasındaki kısa bir konuşmayı dinle.',
        status: 'ready', href: '/app/listening/conversation',
      },
      {
        id: 'announcement', title: 'Listen to an Announcement', titleTr: 'Duyuru Dinle', emoji: '📢',
        desc: 'Kampüs veya günlük hayattan bir duyuruyu dinle.',
        status: 'ready', href: '/app/listening/announcement',
      },
      {
        id: 'academic-talk', title: 'Listen to an Academic Talk', titleTr: 'Akademik Konuşma', emoji: '🏛️',
        desc: 'Kısa bir derse veya akademik sunuma kulak ver.',
        status: 'ready', href: '/app/listening/academic-talk',
      },
    ],
  },
  {
    id: 'speaking',
    label: 'Speaking',
    labelTr: 'Konuşma',
    emoji: '🎙️',
    href: '/app/speaking',
    tip: 'Akıcılık mükemmel gramerden daha önemlidir. Duraksamadan konuşmaya devam et.',
    tasks: [
      {
        id: 'listen-repeat', title: 'Listen and Repeat', titleTr: 'Dinle ve Tekrarla', emoji: '🔁',
        desc: 'Duyduğun cümleyi aynı telaffuz ve tonla tekrar et.',
        status: 'ready', href: '/app/speaking/listen-repeat',
      },
      {
        id: 'interview', title: 'Take an Interview', titleTr: 'Mülakat', emoji: '🎤',
        desc: 'Tarih, edebiyat, sanat veya spor karakteriyle sesli sohbet et.',
        status: 'ready', href: '/app/speaking/interview',
      },
    ],
  },
]

export function getSection(id: SkillId): SkillSection {
  const section = TOEFL_SECTIONS.find((s) => s.id === id)
  if (!section) throw new Error(`Unknown section: ${id}`)
  return section
}
