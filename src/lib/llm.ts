import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type LLMProvider = 'openai' | 'ollama' | 'gemini'

type GenerateParams = {
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
}

const provider: LLMProvider = (process.env.DOST_LLM_PROVIDER as LLMProvider) || 'openai'
const defaultModel = process.env.DOST_LLM_MODEL || (
  provider === 'openai' ? 'gpt-4o-mini' : provider === 'gemini' ? 'gemini-1.5-pro' : 'llama3.1:8b'
)

// Single entry point to call the configured LLM and request strictly-JSON output
export async function generateJSON({ systemPrompt, userPrompt, model = defaultModel, temperature = 0.2 }: GenerateParams): Promise<string> {
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY in environment')
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Use Responses API for stricter JSON control
    const response = await client.responses.create({
      model,
      temperature,
      response_format: { type: 'json_object' },
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ]
    } as any)

    // SDK provides a convenience string containing all text
    const content = (response as any).output_text ||
      (response as any)?.output?.[0]?.content?.[0]?.text || '{}'

    return typeof content === 'string' ? content : JSON.stringify(content)
  }

  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY in environment')
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    // Newer SDKs accept responseMimeType to force JSON output
    const modelInst = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature,
        responseMimeType: 'application/json'
      } as any
    })

    const resp = await modelInst.generateContent(userPrompt)
    const text = resp?.response?.text?.() || resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return text
  }

  // Ollama fallback (local). We enforce JSON via instructions in the prompt
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      options: { temperature },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${userPrompt}\n\nReturn ONLY a valid JSON object with no prose.` }
      ]
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error: ${res.status} ${text}`)
  }

  // Ollama streams by default; but /api/chat returns application/x-ndjson lines.
  // We buffer all lines and take the final message content.
  const decoder = new TextDecoder()
  const reader = (res as any).body?.getReader?.()
  if (reader) {
    let full = ''
    // Read NDJSON and pick the last assistant message content
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value, { stream: true })
    }
    const lines = full.split('\n').filter(Boolean)
    let content = ''
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj?.message?.role === 'assistant' && obj?.message?.content) {
          content = obj.message.content
        }
      } catch {
        // ignore malformed chunk
      }
    }
    return content || '{}'
  }

  // Non-streaming fallback
  const data = await res.json().catch(() => ({}))
  return data?.message?.content || '{}'
}
