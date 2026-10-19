import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

const SYSTEM_PROMPT = `Sen kıdemli bir Yapay Zeka Denetçisi ve Akademik Metin Değerlendirme Uzmanısın. Görevin; kullanıcı tarafından gönderilen metinleri (özellikle TOEFL e-postaları, akademik yazılar ve profesyonel yazışmaları) 6 üzerinden objektif bir şekilde analiz etmek ve yapılandırılmış JSON formatında raporlamaktır.

Değerlendirme Kriterlerin:
1. Task Fulfillment (Görev Tamamlama): İstenen gereksinimlerin ve senaryonun tam olarak karşılanıp karşılanmadığı.
2. Organization & Flow (Organizasyon ve Akıcılık): Metin yapısı, açılış/kapanış uyumu ve mantıksal akış.
3. Language Use & Grammar (Dil Kullanımı ve Gramer): Kelime çeşitliliği, tense uyumları ve imza/hitap kuralları.
4. Tone & Register (Ton ve Üslup): Hedef kitleye (profesör, yetkili vb.) uygun akademik/resmi ton.

Kurallar:
- Puanlamayı kesinlikle 6 üzerinden yap (Örn: 4.5). Yarım puanlara izin ver (0.5 adımlarla).
- Açıklamaları ve yorumları kesinlikle Türkçe yaz.
- Çıktıyı *kesinlikle* yalnızca aşağıdaki JSON şablonuna birebir uyarak ver. Markdown, kod bloğu, sohbet metni veya ekstra açıklama ekleme.

JSON şablonu:
{
  "scores": {
    "task_fulfillment": <number 0-6>,
    "organization_flow": <number 0-6>,
    "language_grammar": <number 0-6>,
    "tone_register": <number 0-6>
  },
  "comments": {
    "task_fulfillment": "<Türkçe kısa gerekçe>",
    "organization_flow": "<Türkçe kısa gerekçe>",
    "language_grammar": "<Türkçe kısa gerekçe>",
    "tone_register": "<Türkçe kısa gerekçe>"
  },
  "overall_score": <number 0-6, dört kriterin ortalamasına yakın>,
  "strengths": ["<Türkçe güçlü yan 1>", "<Türkçe güçlü yan 2>"],
  "improvements": ["<Türkçe gelişim önerisi 1>", "<Türkçe gelişim önerisi 2>", "<Türkçe gelişim önerisi 3>"],
  "overall_comment": "<2-3 cümlelik genel değerlendirme, Türkçe>"
}`

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, scenario } = await req.json()

    if (!body || typeof body !== 'string') {
      return NextResponse.json({ error: 'body is required' }, { status: 400 })
    }
    if (!scenario || typeof scenario !== 'string') {
      return NextResponse.json({ error: 'scenario is required' }, { status: 400 })
    }
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_AI_API_KEY is not configured' }, { status: 500 })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    })

    const prompt = `Senaryo (görev):
${scenario}

Öğrencinin e-postası:
To: ${to ?? ''}
Subject: ${subject ?? ''}

${body}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const feedback = JSON.parse(cleaned)
    const required = ['scores', 'comments', 'overall_score', 'strengths', 'improvements', 'overall_comment']
    for (const field of required) {
      if (feedback[field] === undefined) throw new Error(`Missing field: ${field}`)
    }

    return NextResponse.json(feedback)
  } catch (err) {
    console.error('[analyze/email] Error:', err)
    return NextResponse.json(
      { error: 'Email analysis failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
