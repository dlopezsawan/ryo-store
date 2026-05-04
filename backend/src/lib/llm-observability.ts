/**
 * LLM observability helper for server-side calls.
 *
 * Captures token usage + cost to PostHog as `$ai_generation` events (the
 * standard event name PostHog's LLM Observability product expects).
 *
 * Cost estimates are rough per-provider averages; adjust in `MODEL_PRICING`
 * if pricing changes.
 */

import { captureServerSide } from "./posthog-server"

// Prices per 1M tokens, in USD. Source: provider pricing pages as of 2025.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // DeepSeek
  "deepseek-chat": { input: 0.27, output: 1.10 }, // V3 pricing 2025
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  // OpenAI (commonly used for comparison / Groq transcriptions)
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  // Groq (transcriptions — whisper, not text LLM, but we track anyway)
  "whisper-large-v3": { input: 0, output: 0 }, // Groq charges per audio minute
  // Anthropic
  "claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "claude-3-5-haiku": { input: 0.80, output: 4.0 },
}

export function estimateCostUSD(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model] || { input: 1.0, output: 2.0 }
  const inputCost = (inputTokens / 1_000_000) * p.input
  const outputCost = (outputTokens / 1_000_000) * p.output
  return Number((inputCost + outputCost).toFixed(6))
}

type CaptureLlmParams = {
  distinctId: string
  provider: "deepseek" | "openai" | "anthropic" | "groq" | "other"
  model: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  /** Optional human-readable label for grouping (e.g. 'bot_reply', 'intent_classifier') */
  purpose?: string
  /** Optional conversation/session id */
  traceId?: string
  /** Optional short content snippet for debugging (first ~200 chars) */
  inputPreview?: string
  outputPreview?: string
  /** Whether the call hit an error */
  error?: string
}

export async function captureLlmGeneration(params: CaptureLlmParams): Promise<void> {
  const cost = estimateCostUSD(params.model, params.inputTokens, params.outputTokens)
  await captureServerSide({
    distinctId: params.distinctId,
    event: "$ai_generation",
    properties: {
      $ai_provider: params.provider,
      $ai_model: params.model,
      $ai_input_tokens: params.inputTokens,
      $ai_output_tokens: params.outputTokens,
      $ai_total_tokens: params.inputTokens + params.outputTokens,
      $ai_latency: params.durationMs / 1000, // seconds
      $ai_total_cost_usd: cost,
      $ai_input_cost_usd: Number(((params.inputTokens / 1_000_000) * (MODEL_PRICING[params.model]?.input ?? 1.0)).toFixed(6)),
      $ai_output_cost_usd: Number(((params.outputTokens / 1_000_000) * (MODEL_PRICING[params.model]?.output ?? 2.0)).toFixed(6)),
      $ai_trace_id: params.traceId,
      $ai_is_error: !!params.error,
      $ai_error: params.error,
      purpose: params.purpose,
      input_preview: params.inputPreview?.slice(0, 200),
      output_preview: params.outputPreview?.slice(0, 200),
    },
  })
}
