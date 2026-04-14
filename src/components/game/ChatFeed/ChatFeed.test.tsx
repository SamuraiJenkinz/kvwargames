import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useGameStore } from '@/lib/gameStore'
import { MOCK_MESSAGES } from '@/mocks/mockGameState'
import ChatFeed from './ChatFeed'

vi.mock('zustand')

// jsdom does not implement scrollIntoView — stub it to prevent test errors.
// Scroll behaviour itself is tested manually in the browser.
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

// ─── ChatFeed tests ───────────────────────────────────────────────────────────

describe('ChatFeed', () => {
  // ─── Persona messages ────────────────────────────────────────────────────────

  it('renders persona names (Kent, Finch) from mock messages', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    // Kent appears in Round 1 and Round 2; Finch appears in both rounds too
    const kents = screen.getAllByText('Kent')
    expect(kents.length).toBeGreaterThanOrEqual(1)
    const finchs = screen.getAllByText('Finch')
    expect(finchs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders chen name from mock messages (Round 1)', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    const chens = screen.getAllByText('Chen')
    expect(chens.length).toBeGreaterThanOrEqual(1)
  })

  it('renders avatar initials KV (kent)', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    const kvEls = screen.getAllByText('KV')
    expect(kvEls.length).toBeGreaterThanOrEqual(1)
  })

  it('renders avatar initials AF (finch)', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    const afEls = screen.getAllByText('AF')
    expect(afEls.length).toBeGreaterThanOrEqual(1)
  })

  it('renders avatar initials MC (chen)', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    const mcEls = screen.getAllByText('MC')
    expect(mcEls.length).toBeGreaterThanOrEqual(1)
  })

  it('persona bubble has persona-kent text class on kent message header', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    const { container } = render(<ChatFeed />)
    // The persona name span carries the textClass
    const kentNameEl = container.querySelector('.text-persona-kent')
    expect(kentNameEl).not.toBeNull()
  })

  // ─── Facilitator message ─────────────────────────────────────────────────────

  it('renders FACILITATOR label', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    expect(screen.getByText('FACILITATOR')).toBeInTheDocument()
  })

  // ─── Round dividers ──────────────────────────────────────────────────────────

  it('renders Round 1 divider', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    expect(screen.getByText('Round 1')).toBeInTheDocument()
  })

  it('renders Round 2 divider', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    expect(screen.getByText('Round 2')).toBeInTheDocument()
  })

  // ─── Debrief divider ─────────────────────────────────────────────────────────

  it('renders DEBRIEF label with amber persona-finch class', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    const { container } = render(<ChatFeed />)
    const debriefEl = screen.getByText('DEBRIEF')
    expect(debriefEl).toBeInTheDocument()
    // DebriefDivider renders the label span with text-persona-finch
    // querySelectorAll to find all .text-persona-finch and confirm DEBRIEF is among them
    const amberEls = container.querySelectorAll('.text-persona-finch')
    const amberTexts = Array.from(amberEls).map((el) => el.textContent)
    expect(amberTexts).toContain('DEBRIEF')
  })

  // ─── Error message ───────────────────────────────────────────────────────────

  it('renders error message text "LLM timeout"', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    render(<ChatFeed />)
    expect(
      screen.getByText('LLM timeout — response was not received. Please retry.'),
    ).toBeInTheDocument()
  })

  // ─── Loading indicator ───────────────────────────────────────────────────────

  it('renders LoadingIndicator (three animated dots) when loading=true', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: true })
    const { container } = render(<ChatFeed />)
    // Three dot spans each have the --animate-blink animation inline style
    const dots = container.querySelectorAll<HTMLElement>(
      'span[style*="--animate-blink"]',
    )
    expect(dots.length).toBe(3)
  })

  it('attributes LoadingIndicator to chen (Round 2: kent + finch have spoken, chen has not)', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: true })
    const { container } = render(<ChatFeed />)
    // Chen's color class bg-persona-chen is on the loading indicator avatar
    const chenAvatar = container.querySelector('.bg-persona-chen')
    expect(chenAvatar).not.toBeNull()
  })

  it('does NOT render LoadingIndicator when loading=false', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: true })
    const { container, rerender } = render(<ChatFeed />)

    // Confirm indicator present
    expect(
      container.querySelectorAll<HTMLElement>('span[style*="--animate-blink"]').length,
    ).toBe(3)

    // Turn off loading
    act(() => {
      useGameStore.setState({ loading: false })
    })
    rerender(<ChatFeed />)

    expect(
      container.querySelectorAll<HTMLElement>('span[style*="--animate-blink"]').length,
    ).toBe(0)
  })

  // ─── Scroll sentinel ─────────────────────────────────────────────────────────

  it('scroll sentinel div is the last child of the scroll container', () => {
    useGameStore.setState({ messages: MOCK_MESSAGES, loading: false })
    const { container } = render(<ChatFeed />)
    // The scroll container is the first child of chat-feed (the overflow-y-auto div)
    const scrollContainer = container.querySelector('[data-testid="chat-feed"] > div')
    expect(scrollContainer).not.toBeNull()
    const children = scrollContainer!.children
    const lastChild = children[children.length - 1]
    // Sentinel has no class, no text, just a bare div
    expect(lastChild.tagName).toBe('DIV')
    expect(lastChild.childElementCount).toBe(0)
    expect(lastChild.textContent).toBe('')
  })

  // ─── Manual-verify note (scroll/pill) ────────────────────────────────────────
  // jsdom does not compute layout (scrollHeight/clientHeight = 0) so pill
  // visibility cannot be asserted here.
  //
  // Manual verify (browser):
  //   1. Open /game in DEV mode (mock state auto-seeded)
  //   2. Scroll the chat column up ~300px
  //   3. In devtools console: useGameStore.getState().addMessage({
  //        id:'x', type:'persona', speaker:'kent', text:'new', timestamp:'now'
  //      })
  //   4. "New message" pill should appear; clicking it smooth-scrolls to bottom
})
