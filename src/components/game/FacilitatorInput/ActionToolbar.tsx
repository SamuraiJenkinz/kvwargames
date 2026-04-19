import { useState } from 'react'
import { useGameStore } from '@/lib/gameStore'
import {
  generateDebriefMarkdown,
  downloadDebrief,
  buildDebriefFilename,
  type DebriefSnapshot,
} from '@/lib/debriefExporter'
import { usePodcastStore } from '@/lib/podcastStore'
import { fetchTtsVoices } from '@/lib/ttsVoicesClient'
import {
  countDebriefWords,
  estimateAudioMinutes,
  estimateGenerationSeconds,
  extractPersonaTexts,
  WORD_COUNT_SOFT_CEILING,
} from '@/lib/wordCountEstimate'
import { buildMp3Filename } from '@/lib/mp3Filename'
import WordCountConfirmDialog from '../Podcast/WordCountConfirmDialog'
import RegenerateConfirmDialog from '../Podcast/RegenerateConfirmDialog'

interface ActionToolbarProps {
  disabled: boolean
  onInsert: (text: string) => void
}

export default function ActionToolbar({ disabled, onInsert }: ActionToolbarProps) {
  const advanceRound = useGameStore((s) => s.advanceRound)
  const triggerDebrief = useGameStore((s) => s.triggerDebrief)
  const endGame = useGameStore((s) => s.endGame)
  const loading = useGameStore((s) => s.loading)
  const gameEnded = useGameStore((s) => s.gameEnded)
  const gameConfig = useGameStore((s) => s.gameConfig)
  const gameState = useGameStore((s) => s.gameState)
  const hasDebrief = useGameStore((s) =>
    s.messages.some((m) => m.type === 'debrief_divider'),
  )

  // Podcast store subscriptions
  const podcastStatus = usePodcastStore((s) => s.status)
  const podcastBlobUrl = usePodcastStore((s) => s.blobUrl)
  const podcastGeneratedAt = usePodcastStore((s) => s.generatedAt)
  const startPodcast = usePodcastStore((s) => s.startGeneration)

  // Local dialog state
  const [wordCountDialogOpen, setWordCountDialogOpen] = useState(false)
  const [wordCountDialogMinutes, setWordCountDialogMinutes] = useState(0)
  const [regenDialogOpen, setRegenDialogOpen] = useState(false)

  const nextRound = (gameState?.round ?? 0) + 1

  // ── Podcast handlers ──────────────────────────────────────────────────────────

  const handleGenerate = async (forceFresh: boolean) => {
    const s = useGameStore.getState()
    if (!s.gameConfig || !s.gameState) return
    const texts = extractPersonaTexts(s.messages)
    const wordCount = countDebriefWords(texts)
    if (!forceFresh && wordCount > WORD_COUNT_SOFT_CEILING) {
      setWordCountDialogMinutes(estimateAudioMinutes(wordCount))
      setWordCountDialogOpen(true)
      return
    }
    let voices: { kent: string; finch: string; chen: string }
    try {
      voices = await fetchTtsVoices()
    } catch {
      usePodcastStore.setState({
        status: 'error',
        error: { code: 'network_error', message: 'Could not fetch TTS voice configuration' },
      })
      return
    }
    void startPodcast({
      gameName: s.gameConfig.name,
      personaTexts: texts,
      voices,
      forceFresh,
    })
  }

  const handleDownloadMp3 = () => {
    const s = useGameStore.getState()
    if (!s.gameConfig || !podcastBlobUrl) return
    const filename = buildMp3Filename(
      s.gameConfig.name,
      podcastGeneratedAt ? new Date(podcastGeneratedAt) : new Date(),
    )
    const a = document.createElement('a')
    a.href = podcastBlobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Do NOT revoke the blob URL here — the store owns its lifecycle and will
    // revoke on next generation or reset. Revoking here breaks re-playing the
    // audio element.
  }

  // ── Debrief download handler ──────────────────────────────────────────────────

  // Read store state once per click via getState() — avoids re-render storms
  // when the Download button is visible (decision 6: no subscription hook in handler).
  const handleDownload = () => {
    const s = useGameStore.getState()
    if (!s.gameConfig || !s.gameState) return
    const snapshot: DebriefSnapshot = {
      gameConfig: s.gameConfig,
      gameState: s.gameState,
      stateSnapshots: s.stateSnapshots,
      messages: s.messages,
      exportedAt: new Date(),
    }
    const md = generateDebriefMarkdown(snapshot)
    const filename = buildDebriefFilename(s.gameConfig.name, new Date())
    downloadDebrief(md, filename)
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button
        onClick={() => advanceRound()}
        disabled={disabled || gameEnded}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Advance to Round {nextRound}
      </button>

      {/*
        LAYOUT-04 / FLOW-03: interim debrief, does NOT end the game.
        Gated on loading and gameEnded (cannot request interim debrief post-game).
      */}
      <button
        onClick={() => triggerDebrief()}
        disabled={loading || gameEnded}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Request Debrief Now
      </button>

      {/*
        FLOW-04b: final debrief via endGame(). Sets gameEnded=true + fires LLM turn.
        Also gated on gameEnded — cannot end the game twice (decision 4).
      */}
      <button
        onClick={() => endGame()}
        disabled={loading || gameEnded}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        End Game + Debrief
      </button>

      {/*
        DEB-01: Download button appears once at least one debrief_divider exists.
        Conditionally rendered (not just disabled) to avoid flash of disabled state.
        Each click regenerates from current store state (idempotent, no caching).
      */}
      {hasDebrief && (
        <button
          type="button"
          onClick={handleDownload}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          Download Debrief (.md)
        </button>
      )}

      {/*
        Podcast button group — three states based on podcastStatus:
        - idle:      "Generate Podcast" (PODGEN-01 / SC1)
        - done:      "Download MP3" + "Re-generate" (PODPLAY-02 / SC2 / SC5)
        - generating: buttons hidden; GenerationPanel (in PodcastSection) shows progress
      */}
      {hasDebrief && podcastStatus === 'idle' && (
        <button
          type="button"
          onClick={() => void handleGenerate(false)}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          Generate Podcast
        </button>
      )}
      {hasDebrief && podcastStatus === 'done' && (
        <>
          <button
            type="button"
            onClick={handleDownloadMp3}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          >
            Download MP3
          </button>
          <button
            type="button"
            onClick={() => setRegenDialogOpen(true)}
            className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated"
          >
            Re-generate
          </button>
        </>
      )}

      {/* Word-count ceiling confirmation dialog (SC4) */}
      <WordCountConfirmDialog
        open={wordCountDialogOpen}
        audioMinutes={wordCountDialogMinutes}
        generationSeconds={estimateGenerationSeconds()}
        onConfirm={() => {
          setWordCountDialogOpen(false)
          const s = useGameStore.getState()
          if (!s.gameConfig) return
          const texts = extractPersonaTexts(s.messages)
          // Fetch real voice IDs from backend (async; errors surface via podcast store error state)
          void fetchTtsVoices()
            .then((voices) =>
              startPodcast({
                gameName: s.gameConfig!.name,
                personaTexts: texts,
                voices,
                forceFresh: false,
              }),
            )
            .catch(() => {
              usePodcastStore.setState({
                status: 'error',
                error: { code: 'network_error', message: 'Could not fetch TTS voice configuration' },
              })
            })
        }}
        onCancel={() => setWordCountDialogOpen(false)}
      />

      {/* Re-generate confirmation dialog (SC5 / PODGEN-08) */}
      <RegenerateConfirmDialog
        open={regenDialogOpen}
        generationSeconds={estimateGenerationSeconds()}
        onConfirm={() => {
          setRegenDialogOpen(false)
          void handleGenerate(true)
        }}
        onCancel={() => setRegenDialogOpen(false)}
      />

      <select
        disabled={disabled}
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onInsert(e.target.value)
            e.target.value = ''
          }
        }}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm bg-bg-elevated border border-border-default disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Insert card…</option>
        {gameConfig?.cards.map((c) => (
          <option key={c.id} value={`${c.id} ${c.name}`}>
            {c.id} — {c.name}
          </option>
        ))}
      </select>

      <select
        disabled={disabled}
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onInsert(e.target.value)
            e.target.value = ''
          }
        }}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm bg-bg-elevated border border-border-default disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Insert national action…</option>
        {gameConfig?.nationalActions.map((na) => (
          <option key={na.id} value={`${na.id} ${na.name}`}>
            {na.id} — {na.name}
          </option>
        ))}
      </select>
    </div>
  )
}
