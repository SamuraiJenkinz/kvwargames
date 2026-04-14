import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PersonaMessage from './PersonaMessage'
import type { ChatMessage } from '@/types/game'

function baseMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    type: 'persona',
    speaker: 'kent',
    text: 'Kent speaks.',
    timestamp: '12:34:56',
    ...overrides,
  }
}

describe('PersonaMessage', () => {
  describe('flag rendering (RESP-05)', () => {
    it('renders flag as italic amber note below message body when message.flag is non-null', () => {
      const msg = baseMessage({ flag: 'caution: advisory only' })
      const { container } = render(<PersonaMessage message={msg} />)

      expect(screen.getByText('caution: advisory only')).toBeInTheDocument()
      const amberNodes = container.querySelectorAll('.text-amber-400')
      expect(amberNodes.length).toBeGreaterThanOrEqual(1)
      const flagEl = Array.from(amberNodes).find(
        (n) => n.textContent === 'caution: advisory only',
      )
      expect(flagEl).toBeDefined()
      expect(flagEl?.tagName.toLowerCase()).toBe('p')
      expect(flagEl?.className).toContain('italic')
    })

    it('does not render the flag element when message.flag is null', () => {
      const msg = baseMessage({ flag: null })
      const { container } = render(<PersonaMessage message={msg} />)

      expect(
        screen.queryByText(/caution|advisory|flag/i),
      ).not.toBeInTheDocument()
      const amberNodes = container.querySelectorAll('.text-amber-400')
      expect(amberNodes.length).toBe(0)
    })

    it('does not render the flag element when message.flag is undefined (omitted)', () => {
      const msg = baseMessage() // no flag property
      const { container } = render(<PersonaMessage message={msg} />)

      const amberNodes = container.querySelectorAll('.text-amber-400')
      expect(amberNodes.length).toBe(0)
    })

    it('does not render the flag element when message.flag is an empty string', () => {
      const msg = baseMessage({ flag: '' })
      const { container } = render(<PersonaMessage message={msg} />)

      const amberNodes = container.querySelectorAll('.text-amber-400')
      expect(amberNodes.length).toBe(0)
    })
  })

  describe('revealDelay (CSS-driven stagger)', () => {
    it('applies inline animationDelay when revealDelay is set', () => {
      const msg = baseMessage({ revealDelay: 500 })
      const { container } = render(<PersonaMessage message={msg} />)
      const root = container.firstElementChild as HTMLElement
      expect(root.style.animationDelay).toBe('500ms')
    })

    it('applies no inline animationDelay when revealDelay is 0 (first bubble renders immediately)', () => {
      const msg = baseMessage({ revealDelay: 0 })
      const { container } = render(<PersonaMessage message={msg} />)
      const root = container.firstElementChild as HTMLElement
      expect(root.style.animationDelay).toBe('0ms')
    })

    it('applies no inline animationDelay when revealDelay is undefined', () => {
      const msg = baseMessage()
      const { container } = render(<PersonaMessage message={msg} />)
      const root = container.firstElementChild as HTMLElement
      expect(root.style.animationDelay).toBe('')
    })
  })
})
