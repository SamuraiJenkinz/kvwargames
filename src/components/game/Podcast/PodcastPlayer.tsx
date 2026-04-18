import { useRef, useEffect, useState } from 'react'
import { usePodcastStore } from '@/lib/podcastStore'
import { PERSONA_META } from '@/lib/personaConfig'
import type { PersonaKey } from '@/lib/podcastStore'
import TranscriptPanel from './TranscriptPanel'

const PERSONA_ORDER: PersonaKey[] = ['kent', 'finch', 'chen']

/**
 * HTML5 audio player for the stitched podcast MP3.
 *
 * Structure (top to bottom per CONTEXT.md):
 * 1. "Now playing: {DisplayName}" label — updates via timeupdate at segment boundaries
 * 2. <audio controls> — src set imperatively to avoid re-mount flicker; no autoplay (PODPLAY-01)
 * 3. Skip button row — Kent | Finch | Chen; clicking seeks to offsets[i]
 * 4. TranscriptPanel — collapsed by default
 */
export default function PodcastPlayer() {
  const blobUrl = usePodcastStore((s) => s.blobUrl)
  const offsets = usePodcastStore((s) => s.offsets)
  const activePersona = usePodcastStore((s) => s.activePersona)
  const setActivePersona = usePodcastStore((s) => s.setActivePersona)

  const audioRef = useRef<HTMLAudioElement>(null)

  // Set audio src imperatively — avoids React re-mounting the <audio> element
  // when blobUrl changes (which would interrupt playback).
  useEffect(() => {
    if (!audioRef.current || !blobUrl) return
    audioRef.current.src = blobUrl
    audioRef.current.load()
    // Intentionally no autoplay — PODPLAY-01 "paused state (no auto-play)"
  }, [blobUrl])

  // timeupdate listener — segment-boundary detection (RESEARCH.md Pattern 6)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !offsets) return

    const onTimeUpdate = () => {
      const t = audio.currentTime
      // Walk offsets backwards to find the current segment
      let active: PersonaKey = 'kent'
      if (t >= offsets[2]) active = 'chen'
      else if (t >= offsets[1]) active = 'finch'
      setActivePersona(active)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
  }, [offsets, setActivePersona])

  // Phase 14 note: skip buttons set currentTime directly on the blob URL element.
  // If audio.readyState === 0 when the user clicks, the seek may have no effect;
  // the user can click again once the audio has loaded. This is acceptable for
  // a fully-local blob URL. Revisit if Phase 16 reveals flakiness with streaming URLs.
  const handleSkip = (key: PersonaKey, index: number) => {
    if (!audioRef.current || !offsets) return
    audioRef.current.currentTime = offsets[index]
    setActivePersona(key)
  }

  const activeMeta = PERSONA_META[activePersona]

  return (
    <div className="space-y-3">
      {/* 1. Now-playing label (PODPLAY-05 / SC3) */}
      <p className="text-sm text-text-secondary">
        Now playing:{' '}
        <span className={['font-medium', activeMeta.textClass].join(' ')}>
          {activeMeta.displayName}
        </span>
      </p>

      {/* 2. HTML5 audio element — controls always visible, no autoplay (PODPLAY-01) */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        controls
        className="w-full"
      />

      {/* 3. Skip button row — Kent | Finch | Chen (PODPLAY-04 / SC3) */}
      <div className="flex gap-2">
        {PERSONA_ORDER.map((key, i) => {
          const meta = PERSONA_META[key]
          const isActive = key === activePersona
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSkip(key, i)}
              className={[
                'flex-1 py-1 text-sm rounded-sm border transition-colors',
                isActive
                  ? [
                      'font-medium border-amber-500/60 bg-amber-500/10 text-amber-400',
                    ].join(' ')
                  : 'border-border-default hover:bg-bg-elevated text-text-secondary',
              ].join(' ')}
            >
              {meta.displayName}
            </button>
          )
        })}
      </div>

      {/* 4. Transcript panel — collapsed by default (PODPLAY-03 / SC6) */}
      <TranscriptPanel />
    </div>
  )
}
