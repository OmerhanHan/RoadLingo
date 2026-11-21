import type { ChatMessage, StreamChunk } from '../types'

export type StreamOptions = {
  signal?: AbortSignal
  /** Upper bound on generated tokens (keeps replies short and cost predictable). */
  maxTokens?: number
  /**
   * false turns off hidden reasoning on thinking models (Ollama `think`).
   * Reasoning tokens count against maxTokens, so short replies can come back empty.
   */
  think?: boolean
}

export interface SpeakingProvider {
  readonly id: string
  streamChat(
    messages: ChatMessage[],
    options?: StreamOptions
  ): AsyncGenerator<StreamChunk, void, unknown>
}
