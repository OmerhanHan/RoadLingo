import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { consumeQuota, quotaExceeded, refundQuota } from '@/lib/usage/quota'
import { badRequest, guard, readJson, serverError, textField } from '@/lib/security/guard'

/** Longer texts are rejected rather than paid for. */
const MAX_INPUT_CHARS = 6000
const MAX_SCENARIO_CHARS = 2000
const MAX_HEADER_CHARS = 200

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
  const denied = await guard(req, 'ai', { auth: true })
  if (denied) return denied
  const parsed = await readJson<Record<string, unknown>>(req)
  if (!parsed.ok) return parsed.response

  const body = textField(parsed.body.body, MAX_INPUT_CHARS)
  const scenario = textField(parsed.body.scenario, MAX_SCENARIO_CHARS)
  const to = textField(parsed.body.to, MAX_HEADER_CHARS)
  const subject = textField(parsed.body.subject, MAX_HEADER_CHARS)
  if (body === null) return badRequest('Metin çok uzun')
  if (scenario === null || to === null || subject === null) return badRequest('Alanlardan biri çok uzun')
  if (!body) return badRequest('body is required')
  if (!scenario) return badRequest('scenario is required')

  let charged = false
  try {
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_AI_API_KEY is not configured' }, { status: 500 })
    }

    const quota = await consumeQuota(req, 'scoring')
    if (!quota.ok) return quotaExceeded('scoring', quota.limit)
    charged = true

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { maxOutputTokens: 1200, responseMimeType: 'application/json' },
    })

    const prompt = `Senaryo (görev):
${scenario}

Öğrencinin e-postası:
To: ${to}
Subject: ${subject}

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
    if (charged) await refundQuota(req, 'scoring')
    return serverError('analyze/email', err, 'E-posta değerlendirmesi yapılamadı')
  }
}
