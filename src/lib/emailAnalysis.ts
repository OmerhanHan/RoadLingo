export type EmailScoreKey =
  | 'task_fulfillment'
  | 'organization_flow'
  | 'language_grammar'
  | 'tone_register'

export type EmailAnalysis = {
  scores: Record<EmailScoreKey, number>
  comments: Record<EmailScoreKey, string>
  overall_score: number
  strengths: string[]
  improvements: string[]
  overall_comment: string
}

export const EMAIL_SCORE_LABELS: Record<EmailScoreKey, string> = {
  task_fulfillment: 'Görev Tamamlama',
  organization_flow: 'Organizasyon & Akıcılık',
  language_grammar: 'Dil & Gramer',
  tone_register: 'Ton & Üslup',
}

export type EmailCategory =
  | 'academic'
  | 'admin'
  | 'clubs'
  | 'daily'

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, string> = {
  academic: 'Akademik ve Üniversite İlişkileri',
  admin: 'İdari İşler ve Üniversite Hizmetleri',
  clubs: 'Öğrenci Kulüpleri, Etkinlikler ve Gönüllülük',
  daily: 'Günlük Yaşam, İş ve Hizmetler',
}

export type EmailScenario = {
  id: string
  category: EmailCategory
  title: string
  title_tr: string
  to: string
  subject: string
  prompt: string
  prompt_tr: string
}

export const EMAIL_SCENARIOS: EmailScenario[] = [
  // ── Akademik ──
  {
    id: 'extension-request',
    category: 'academic',
    title: 'Extension Request for Research Paper',
    title_tr: 'Ödev/Proje Süre Uzatma Talebi',
    to: 'prof.elena.marsh@university.edu',
    subject: 'Extension Request for Research Paper',
    prompt:
      'Write a formal email to Professor Elena Marsh asking for a short extension on your research paper. Briefly explain your reason, propose a new deadline, and thank her politely.',
    prompt_tr:
      'Profesör Elena Marsh’a araştırma ödevin için kısa bir süre uzatma isteyen resmi bir e-posta yaz. Gerekçeyi kısaca belirt, yeni bir teslim tarihi öner ve nazikçe teşekkür et.',
  },
  {
    id: 'lecture-material-question',
    category: 'academic',
    title: 'Question Regarding Lecture Material on Climate Policy',
    title_tr: 'Ders Konusu Hakkında Soru',
    to: 'dr.james.okonkwo@university.edu',
    subject: 'Question Regarding Lecture Material on Climate Policy',
    prompt:
      'Write a polite academic email to Dr. James Okonkwo asking a clear question about last week’s lecture material on climate policy. Show that you reviewed the notes and ask for brief clarification.',
    prompt_tr:
      'Dr. James Okonkwo’ya geçen haftaki iklim politikası ders materyali hakkında net bir soru soran kibar bir akademik e-posta yaz. Notları gözden geçirdiğini göster ve kısa bir açıklama iste.',
  },
  {
    id: 'office-hours',
    category: 'academic',
    title: 'Inquiry About Office Hours Appointment on Thursday',
    title_tr: 'Ofis Saati Görüşmesi Hakkında',
    to: 'prof.maya.singh@university.edu',
    subject: 'Inquiry About Office Hours Appointment on Thursday',
    prompt:
      'Write a formal email to Professor Maya Singh asking for an office-hours appointment on Thursday. State your purpose briefly and suggest one alternative time if Thursday is unavailable.',
    prompt_tr:
      'Profesör Maya Singh’e Perşembe günü ofis saati randevusu isteyen resmi bir e-posta yaz. Amacını kısaca belirt; Perşembe müsait değilse alternatif bir saat öner.',
  },
  {
    id: 'midterm-clarification',
    category: 'academic',
    title: 'Clarification Needed for Upcoming Midterm Exam',
    title_tr: 'Ara Sınav İçin Açıklama Talebi',
    to: 'assistant.li.wei@university.edu',
    subject: 'Clarification Needed for Upcoming Midterm Exam',
    prompt:
      'Write a respectful email to Teaching Assistant Li Wei asking for clarification about the format, covered chapters, and allowed materials for the upcoming midterm exam.',
    prompt_tr:
      'Asistan Li Wei’ye yaklaşan ara sınavın formatı, kapsanan konular ve izin verilen materyaller hakkında açıklama isteyen saygılı bir e-posta yaz.',
  },
  {
    id: 'class-absence',
    category: 'academic',
    title: 'Absence from Class on March 12 / Makeup Work',
    title_tr: 'Ders Devamsızlığı ve Telafi Çalışması',
    to: 'prof.daniel.ross@university.edu',
    subject: 'Absence from Class on March 12 / Makeup Work',
    prompt:
      'Write a formal email to Professor Daniel Ross explaining your absence from class on March 12 and asking about makeup work or materials you should complete.',
    prompt_tr:
      'Profesör Daniel Ross’a 12 Mart dersine katılamadığını açıklayan ve telafi çalışması veya tamamlaman gereken materyaller hakkında soran resmi bir e-posta yaz.',
  },
  {
    id: 'research-proposal-feedback',
    category: 'academic',
    title: 'Feedback Request on My Research Proposal',
    title_tr: 'Araştırma Önerim İçin Geri Bildirim Talebi',
    to: 'prof.laura.chen@university.edu',
    subject: 'Feedback Request on My Research Proposal',
    prompt:
      'Write a formal email to Professor Laura Chen requesting feedback on your research proposal. Mention the draft is attached (or ready to send) and ask for guidance on one or two specific points.',
    prompt_tr:
      'Profesör Laura Chen’den araştırma önerin için geri bildirim isteyen resmi bir e-posta yaz. Taslağın hazır olduğunu belirt ve bir-iki spesifik noktada yönlendirme iste.',
  },
  {
    id: 'final-grade-inquiry',
    category: 'academic',
    title: 'Inquiry Regarding Final Grade for Introduction to Sociology',
    title_tr: 'Ders Notu İtirazı/Sorgulaması',
    to: 'prof.helen.park@university.edu',
    subject: 'Inquiry Regarding Final Grade for Introduction to Sociology',
    prompt:
      'Write a polite and professional email to Professor Helen Park inquiring about your final grade in Introduction to Sociology. Ask for clarification on how the grade was calculated without sounding confrontational.',
    prompt_tr:
      'Profesör Helen Park’a Introduction to Sociology final notun hakkında kibar ve profesyonel bir sorgu e-postası yaz. Notun nasıl hesaplandığını, tartışmacı olmadan sor.',
  },

  // ── İdari ──
  {
    id: 'library-account',
    category: 'admin',
    title: 'Issue with Campus Library Account Access',
    title_tr: 'Kütüphane Hesabı Erişim Sorunu',
    to: 'library.support@university.edu',
    subject: 'Issue with Campus Library Account Access',
    prompt:
      'Write a formal email to campus library support explaining that you cannot access your library account. Describe the error briefly and ask for assistance restoring access.',
    prompt_tr:
      'Kampüs kütüphane desteğine kütüphane hesabına erişemediğini bildiren resmi bir e-posta yaz. Hatayı kısaca anlat ve erişimin yeniden açılması için yardım iste.',
  },
  {
    id: 'dorm-room-change',
    category: 'admin',
    title: 'Inquiry Concerning Dormitory Room Change Request',
    title_tr: 'Yurt Oda Değişikliği Talebi',
    to: 'housing@university.edu',
    subject: 'Inquiry Concerning Dormitory Room Change Request',
    prompt:
      'Write a polite email to Housing Services asking about the process and timeline for a dormitory room change request. State your reason briefly.',
    prompt_tr:
      'Yurt Hizmetleri’ne oda değişikliği talebinin süreci ve zaman çizelgesi hakkında kibar bir e-posta yaz. Gerekçeni kısaca belirt.',
  },
  {
    id: 'tuition-deadline',
    category: 'admin',
    title: 'Question About Tuition Fee Payment Deadline',
    title_tr: 'Öğrenim Ücreti Son Ödeme Tarihi Hakkında',
    to: 'bursar@university.edu',
    subject: 'Question About Tuition Fee Payment Deadline',
    prompt:
      'Write a formal email to the Bursar’s Office asking about the tuition fee payment deadline and whether a short payment extension is possible.',
    prompt_tr:
      'Muhasebe Ofisi’ne öğrenim ücreti son ödeme tarihi ve kısa bir ek süre mümkün mü diye soran resmi bir e-posta yaz.',
  },
  {
    id: 'transcript-request',
    category: 'admin',
    title: 'Request for Official Academic Transcript',
    title_tr: 'Resmi Transkript Talebi',
    to: 'registrar@university.edu',
    subject: 'Request for Official Academic Transcript',
    prompt:
      'Write a formal email to the Registrar’s Office requesting an official academic transcript. Mention how you need it delivered (email/mail) and any deadline you have.',
    prompt_tr:
      'Kayıt İşleri’nden resmi akademik transkript isteyen resmi bir e-posta yaz. Nasıl teslim alman gerektiğini ve varsa son tarihi belirt.',
  },
  {
    id: 'parking-permit',
    category: 'admin',
    title: 'Parking Permit Renewal Process for Fall Semester',
    title_tr: 'Otopark İzni Yenileme',
    to: 'parking@university.edu',
    subject: 'Parking Permit Renewal Process for Fall Semester',
    prompt:
      'Write a polite email to Parking Services asking how to renew your parking permit for the fall semester, what documents are required, and the deadline.',
    prompt_tr:
      'Otopark Hizmetleri’ne güz dönemi otopark izni yenileme süreci, gerekli belgeler ve son tarih hakkında kibar bir e-posta yaz.',
  },
  {
    id: 'registration-error',
    category: 'admin',
    title: 'Assistance Required with Course Registration Error',
    title_tr: 'Ders Kayıt Hatası İçin Yardım Talebi',
    to: 'registration@university.edu',
    subject: 'Assistance Required with Course Registration Error',
    prompt:
      'Write a formal email to the Registration Office describing a course registration error and requesting help to fix it before the add/drop deadline.',
    prompt_tr:
      'Kayıt Ofisi’ne ders kayıt hatasını anlatan ve add/drop tarihinden önce düzeltilmesi için yardım isteyen resmi bir e-posta yaz.',
  },

  // ── Kulüpler ──
  {
    id: 'science-fair-volunteer',
    category: 'clubs',
    title: 'Volunteer Application for the Annual Science Fair',
    title_tr: 'Bilim Fuarı Gönüllü Başvurusu',
    to: 'sciencefair@university.edu',
    subject: 'Volunteer Application for the Annual Science Fair',
    prompt:
      'Write a polite email applying to volunteer for the Annual Science Fair. Mention your availability, relevant skills, and why you want to help.',
    prompt_tr:
      'Yıllık Bilim Fuarı’nda gönüllü olmak için kibar bir başvuru e-postası yaz. Müsaitliğini, ilgili becerilerini ve neden yardımcı olmak istediğini belirt.',
  },
  {
    id: 'photo-club-workshop',
    category: 'clubs',
    title: 'Proposal for Upcoming Photography Club Workshop',
    title_tr: 'Fotoğrafçılık Kulübü Atölye Önerisi',
    to: 'photoclub@university.edu',
    subject: 'Proposal for Upcoming Photography Club Workshop',
    prompt:
      'Write a formal email to the Photography Club proposing a workshop idea. Include the topic, suggested date, and what students would learn.',
    prompt_tr:
      'Fotoğrafçılık Kulübü’ne bir atölye önerisi sunan resmi bir e-posta yaz. Konuyu, önerilen tarihi ve öğrencilerin ne öğreneceğini belirt.',
  },
  {
    id: 'club-room-reservation',
    category: 'clubs',
    title: 'Inquiry About Room Reservation for Club Meeting',
    title_tr: 'Kulüp Toplantısı İçin Oda Rezervasyonu',
    to: 'student.spaces@university.edu',
    subject: 'Inquiry About Room Reservation for Club Meeting',
    prompt:
      'Write a polite email asking how to reserve a room for a student club meeting. Include preferred date, time, expected attendance, and equipment needs if any.',
    prompt_tr:
      'Öğrenci kulübü toplantısı için oda rezervasyonu nasıl yapılır diye kibar bir e-posta yaz. Tercih edilen tarih, saat, tahmini katılımcı sayısı ve varsa ekipman ihtiyacını belirt.',
  },
  {
    id: 'env-collab',
    category: 'clubs',
    title: 'Collaboration Proposal with the Environmental Society',
    title_tr: 'Çevre Kulübü İle Ortak Çalışma Teklifi',
    to: 'envirosociety@university.edu',
    subject: 'Collaboration Proposal with the Environmental Society',
    prompt:
      'Write a formal email to the Environmental Society proposing a collaboration for a campus sustainability event. Outline your idea and suggest a short planning meeting.',
    prompt_tr:
      'Çevre Kulübü’ne kampüs sürdürülebilirlik etkinliği için ortak çalışma teklif eden resmi bir e-posta yaz. Fikrini özetle ve kısa bir planlama toplantısı öner.',
  },
  {
    id: 'career-fair-registration',
    category: 'clubs',
    title: 'Registration Inquiry for the Spring Career Fair',
    title_tr: 'Kariyer Fuarı Kayıt İşlemi',
    to: 'careers@university.edu',
    subject: 'Registration Inquiry for the Spring Career Fair',
    prompt:
      'Write a polite email to the Career Center asking how to register for the Spring Career Fair, what documents are needed, and the registration deadline.',
    prompt_tr:
      'Kariyer Merkezi’ne Bahar Kariyer Fuarı’na nasıl kayıt olunur, hangi belgeler gerekir ve son kayıt tarihi nedir diye soran kibar bir e-posta yaz.',
  },

  // ── Günlük yaşam ──
  {
    id: 'apartment-maintenance',
    category: 'daily',
    title: 'Maintenance Request for Apartment 4B',
    title_tr: 'Daire Arıza/Bakım Talebi',
    to: 'maintenance@oakridgeapartments.com',
    subject: 'Maintenance Request for Apartment 4B',
    prompt:
      'Write a clear email to building maintenance requesting a repair in Apartment 4B. Describe the problem, when it started, and ask for an appointment this week.',
    prompt_tr:
      'Apartman bakım ekibine 4B dairesi için arıza/bakım talebi yaz. Sorunu ve ne zaman başladığını anlat; bu hafta için randevu iste.',
  },
  {
    id: 'missing-package',
    category: 'daily',
    title: 'Inquiry About Missing Delivery Package',
    title_tr: 'Kayıp Kargo Hakkında Soru',
    to: 'support@swiftparcel.com',
    subject: 'Inquiry About Missing Delivery Package',
    prompt:
      'Write a polite email to customer support about a missing delivery package. Include the order/tracking number (you may invent one), delivery date, and ask for next steps.',
    prompt_tr:
      'Müşteri hizmetlerine kayıp kargo hakkında kibar bir e-posta yaz. Sipariş/takip numarasını (uydurabilirsin), teslim tarihini belirt ve sonraki adımları sor.',
  },
  {
    id: 'noise-complaint',
    category: 'daily',
    title: 'Complaint Regarding Excessive Noise Next Door',
    title_tr: 'Aşırı Gürültü Şikayeti',
    to: 'manager@oakridgeapartments.com',
    subject: 'Complaint Regarding Excessive Noise Next Door',
    prompt:
      'Write a calm and professional email to the apartment manager complaining about excessive noise from the neighboring unit. Mention when it happens and request a reasonable solution.',
    prompt_tr:
      'Apartman yöneticisine komşu dairedeki aşırı gürültü hakkında sakin ve profesyonel bir şikâyet e-postası yaz. Ne zaman olduğunu belirt ve makul bir çözüm iste.',
  },
]

export function pickRandomEmailScenario(excludeId?: string): EmailScenario {
  const pool = excludeId
    ? EMAIL_SCENARIOS.filter(s => s.id !== excludeId)
    : EMAIL_SCENARIOS
  const list = pool.length > 0 ? pool : EMAIL_SCENARIOS
  return list[Math.floor(Math.random() * list.length)]
}

export function formatEmailDraft(to: string, subject: string, body: string) {
  return `To: ${to.trim()}\nSubject: ${subject.trim()}\n\n${body.trim()}`
}

function clampScore(n: unknown): number {
  const v = Number(n)
  if (Number.isNaN(v)) return 0
  return Math.min(6, Math.max(0, Math.round(v * 2) / 2))
}

function mockEmailAnalysis(body: string): EmailAnalysis {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  const base = Math.min(words / 120, 1)
  const score = (offset: number) =>
    clampScore(2.5 + base * 2.5 + ((words + offset) % 3) * 0.5)

  const scores = {
    task_fulfillment: score(1),
    organization_flow: score(2),
    language_grammar: score(3),
    tone_register: score(4),
  }
  const overall = clampScore(
    (scores.task_fulfillment +
      scores.organization_flow +
      scores.language_grammar +
      scores.tone_register) /
      4,
  )

  return {
    scores,
    comments: {
      task_fulfillment:
        words < 40
          ? 'Senaryonun gereksinimleri kısmen karşılanmış; amaç veya talep netliği eksik kalmış olabilir.'
          : 'Görevin temel noktalarına değinilmiş; senaryo gereksinimleri büyük ölçüde karşılanmış.',
      organization_flow:
        'Açılış–gövde–kapanış düzeni genel olarak anlaşılır; geçişler güçlendirilebilir.',
      language_grammar:
        'İfade genel olarak anlaşılır; tense tutarlılığı ve kelime çeşitliliği geliştirilebilir.',
      tone_register:
        'Hedef kitleye uygun resmi ton hedeflenmiş; hitap ve kapanış kalıpları gözden geçirilmeli.',
    },
    overall_score: overall,
    strengths: [
      'E-posta formatına (alıcı / konu / gövde) uygun bir iskelet kullanılmış.',
      'Kısa sürede bir taslak üretilebilmiş.',
    ],
    improvements: [
      'Senaryodaki tüm gereksinimleri açıkça ve eksiksiz yaz.',
      'Daha doğal ve çeşitli akademik/profesyonel kalıplar kullan.',
      'Hitap ve imza bölümlerini hedef kitleye göre netleştir.',
    ],
    overall_comment: `Genel puanın ${overall}/6. Süre sınırı altında yapılandırılmış bir e-posta denemesi; ayrıntı ve üslup netliği bir üst banda taşır.`,
  }
}

export function normalizeEmailAnalysis(data: Partial<EmailAnalysis>): EmailAnalysis {
  const keys: EmailScoreKey[] = [
    'task_fulfillment',
    'organization_flow',
    'language_grammar',
    'tone_register',
  ]
  const scores = {} as Record<EmailScoreKey, number>
  const comments = {} as Record<EmailScoreKey, string>

  for (const key of keys) {
    scores[key] = clampScore(data.scores?.[key])
    comments[key] = String(data.comments?.[key] ?? '')
  }

  const overall =
    data.overall_score !== undefined
      ? clampScore(data.overall_score)
      : clampScore(
          (scores.task_fulfillment +
            scores.organization_flow +
            scores.language_grammar +
            scores.tone_register) /
            4,
        )

  return {
    scores,
    comments,
    overall_score: overall,
    strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
    improvements: Array.isArray(data.improvements) ? data.improvements.map(String) : [],
    overall_comment: String(data.overall_comment ?? ''),
  }
}

export async function analyzeEmail(params: {
  to: string
  subject: string
  body: string
  scenario: string
}): Promise<EmailAnalysis> {
  try {
    const res = await fetch('/api/analyze/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    return normalizeEmailAnalysis(data)
  } catch (err) {
    console.warn('[analyzeEmail] Falling back to mock:', err)
    await new Promise(r => setTimeout(r, 1200))
    return mockEmailAnalysis(params.body)
  }
}
