/**
 * Thin OpenAI chat helper. Tight defaults. short prompts, hard max_tokens,
 * and easy kill-switch so we never burn budget on routine UI traffic.
 *
 * Env:
 *   OPENAI_API_KEY / OpenAI_API_KEY
 *   OPENAI_MODEL (default gpt-4o-mini)
 *   OPENAI_ENABLED=0  → never call (heuristic paths only)
 *   OPENAI_MAX_TOKENS → default completion cap (180)
 */

export type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function apiKey(): string {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OpenAI_API_KEY ||
    process.env.OPENAI_KEY ||
    ''
  ).trim()
}

/** Master switch. off means product uses heuristics only. */
export function openaiEnabled(): boolean {
  const flag = String(process.env.OPENAI_ENABLED || '1').trim().toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false
  return Boolean(apiKey())
}

export function openaiConfigured(): boolean {
  return openaiEnabled()
}

function defaultMaxTokens(): number {
  const n = Number(process.env.OPENAI_MAX_TOKENS)
  if (Number.isFinite(n) && n > 32) return Math.min(400, Math.round(n))
  return 180
}

function truncate(text: string, maxChars: number): string {
  const s = String(text || '')
  if (s.length <= maxChars) return s
  return `${s.slice(0, maxChars)}…`
}

export async function openaiChatJson<T>(opts: {
  system: string
  user: string
  model?: string
  temperature?: number
  timeoutMs?: number
  /** Completion budget. Keep low. we only need small JSON. */
  maxTokens?: number
  /** Soft cap on user payload size (chars). */
  maxUserChars?: number
}): Promise<{ data: T | null; error?: string; raw?: string }> {
  if (!openaiEnabled()) return { data: null, error: 'OpenAI disabled' }
  const key = apiKey()
  if (!key) return { data: null, error: 'OPENAI_API_KEY not configured' }

  const model = opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const maxTokens = opts.maxTokens ?? defaultMaxTokens()
  const user = truncate(opts.user, opts.maxUserChars ?? 1800)
  const system = truncate(opts.system, 900)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8_000)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ] satisfies OpenAiChatMessage[],
      }),
    })

    const text = await res.text()
    if (!res.ok) {
      const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180)
      return { data: null, error: `OpenAI HTTP ${res.status}: ${snippet || res.statusText}` }
    }

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      return { data: null, error: 'Invalid OpenAI envelope', raw: text.slice(0, 400) }
    }

    const content = String(parsed?.choices?.[0]?.message?.content || '').trim()
    if (!content) return { data: null, error: 'Empty OpenAI content', raw: text.slice(0, 400) }

    try {
      return { data: JSON.parse(content) as T, raw: content }
    } catch {
      return { data: null, error: 'OpenAI returned non-JSON content', raw: content.slice(0, 400) }
    }
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'OpenAI request timed out' : e?.message || 'OpenAI request failed'
    return { data: null, error: msg }
  } finally {
    clearTimeout(timer)
  }
}
