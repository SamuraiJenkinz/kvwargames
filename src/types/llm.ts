import type { StateUpdate } from '@/types/game'

export interface LLMRequest {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
}

export interface LLMResponse {
  text: string
  error?: string
}

// The structured JSON the LLM returns (parsed from text)
export interface PersonaResponse {
  speaker: 'kent' | 'finch' | 'chen'
  message: string
  stateUpdate: StateUpdate | null
  flag: string | null
}

export interface LLMStructuredResponse {
  responses: PersonaResponse[]
}
