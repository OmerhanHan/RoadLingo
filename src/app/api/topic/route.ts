import { GoogleGenerativeAI } from '@google/generative-ai'
import { geminiModel } from '@/lib/ai/gemini'
import { NextResponse, type NextRequest } from 'next/server'
import { consumeBudget, refundBudget } from '@/lib/usage/quota'
import { isSignedIn, rateLimit } from '@/lib/security/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

const TOPICS_POOL = [
  "The impact of social media on modern communication",
  "Should universities be free for all students?",
  "Climate change: individual responsibility vs. government action",
  "The future of remote work in the post-pandemic era",
  "Artificial intelligence: threat or opportunity for employment?",
  "Is space exploration worth the cost?",
  "The role of technology in education",
  "Should fast food be taxed more heavily?",
  "The importance of mental health awareness in workplaces",
  "Are electric vehicles the solution to pollution?",
  "The effects of urbanization on wildlife",
  "Should voting be mandatory?",
  "The influence of video games on children's behavior",
  "Is globalization beneficial or harmful?",
  "The rise of cryptocurrency: a financial revolution?",
  "Should the retirement age be raised?",
  "The role of art in society",
  "Online privacy in the digital age",
  "Should animals be used in scientific research?",
  "The impact of tourism on local cultures",
  "Are standardized tests a fair measure of intelligence?",
  "The future of print media in the digital world",
  "Should cell phones be banned in schools?",
  "The ethics of genetic engineering",
  "Work-life balance in the modern world",
  "The benefits and drawbacks of a vegetarian diet",
  "Should the death penalty be abolished?",
  "The role of women in leadership positions",
  "Is nuclear energy a viable solution to climate change?",
  "The impact of immigration on host countries",
]

const poolTopic = () => NextResponse.json({ topic: TOPICS_POOL[Math.floor(Math.random() * TOPICS_POOL.length)] })

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, 'content')
  if (limited) return limited
  // No API key, not signed in (Supabase mode), or today's AI topic budget is used up → a topic from the fixed pool.
  if (!process.env.GOOGLE_AI_API_KEY || !(await isSignedIn(req)) || !(await consumeBudget(req, 'topics'))) return poolTopic()

  try {
    const model = genAI.getGenerativeModel({ model: geminiModel() })

    const prompt = `Generate one unique, thought-provoking IELTS Academic Writing Task 2 essay topic.
Return ONLY the topic sentence, nothing else. No numbering, no quotes, no explanation.
Make it specific, arguable, and suitable for a 250-word academic essay.
The topic should be different from these common ones: ${TOPICS_POOL.slice(0, 5).join('; ')}`

    const result = await model.generateContent(prompt)
    const topic = result.response.text().trim()

    return NextResponse.json({ topic })
  } catch (err) {
    console.error('[topic] Error:', err)
    await refundBudget(req, 'topics')
    return poolTopic()
  }
}
