import type { ReplayAdapter } from './replay.js'
import { parseTrace, type TraceInput, type TraceMotion } from './trace.js'

export interface HandoffIds {
  sheet: string
  scroll: string
}
export const handoffIds: HandoffIds = { sheet: 'sheet', scroll: 'scroll' }

/** Both entries describe bounded y positions; no free-running spring is part of this adapter. */
export function handoffMotions(motions: readonly TraceMotion[], ids = handoffIds) {
  // Reuse the trace schema rather than trusting a cast from a file or consumer.
  const validated = parseTrace({
    version: 1,
    seed: 0,
    settings: { timeScale: 1, reducedMotion: false },
    metadata: {
      platform: 'test',
      os: 'test',
      model: 'test',
      refreshRate: 60,
      density: 1,
      width: 1,
      height: 1,
    },
    motions,
    entries: [],
  }).motions
  const sheet = validated.find((m) => m.id === ids.sheet),
    scroll = validated.find((m) => m.id === ids.scroll)
  if (
    validated.length !== 2 ||
    !sheet ||
    !scroll ||
    sheet === scroll ||
    validated.some((m) => m.kind !== 'drag' || m.axis !== 'y' || m.snap.length) ||
    scroll.min !== 0
  )
    throw new TypeError(
      'Handoff needs two distinct y drag motions, no snap, and scroll min 0.',
    )
  return { sheet, scroll }
}

/** Normalize cumulative contact positions once; membership changes rebase without a delta. */
export function handoffInput(
  send: (phase: number, delta: number, velocity: number) => void,
) {
  let contact = false,
    suspended = false,
    previous = 0,
    pointers = ''
  return {
    get contact() {
      return contact
    },
    gesture(event: Extract<TraceInput, { type: 'gesture' }>) {
      if (suspended) return
      if (event.phase === 'begin') {
        contact = true
        previous = event.y
        pointers = event.pointers.join(',')
        send(1, 0, 0)
      } else if (contact && event.phase === 'move') {
        const next = event.pointers.join(',')
        const changed = pointers !== next
        const delta = changed ? 0 : event.y - previous
        previous = event.y
        pointers = next
        send(2, delta, changed ? 0 : event.velocityY)
      } else if (contact) {
        contact = false
        send(event.phase === 'cancel' ? 4 : 3, 0, 0)
      }
    },
    lifecycle(state: string) {
      if (state === 'suspend' || state === 'unload') {
        suspended = true
        contact = false
        send(4, 0, 0)
      } else suspended = false
    },
  }
}

/** Independent headless contract: scroll to its top before pulling the sheet down;
 * expand the sheet before scrolling content up. Native replay exercises the production policy.
 */
export function scrollHandoffTraceGraph(
  motions: readonly TraceMotion[],
  ids: HandoffIds = handoffIds,
): ReplayAdapter {
  const config = handoffMotions(motions, ids)
  let y = config.sheet.initial,
    offset = config.scroll.initial,
    velocity = 0,
    disposed = false
  const input = handoffInput((phase, delta, speed) => {
    if (phase !== 2) {
      velocity = 0
      return
    }
    const before = y
    if (delta > 0) {
      const content = Math.min(offset, delta)
      offset -= content
      y = Math.min(config.sheet.max, y + delta - content)
    } else {
      const panel = Math.min(y - config.sheet.min, -delta)
      y -= panel
      offset = Math.min(config.scroll.max, offset - delta - panel)
    }
    velocity = y === before ? 0 : speed
  })
  return {
    input(event) {
      if (disposed) throw new Error('Handoff graph is disposed.')
      if (event.type === 'gesture' && event.id === ids.sheet) input.gesture(event)
      else if (event.type === 'scroll' && event.id === ids.scroll) {
        if (event.offset < 0 || event.offset > config.scroll.max)
          throw new RangeError('Scroll offset is outside the recorded bounds.')
        offset = event.offset
      } else if (event.type === 'lifecycle') input.lifecycle(event.state)
      else throw new Error(`Handoff has no adapter for ${event.type}.`)
    },
    read(id) {
      if (id !== ids.sheet && id !== ids.scroll)
        throw new Error('Unknown handoff view ID.')
      return {
        position: id === ids.sheet ? y : offset,
        velocity: id === ids.sheet ? velocity : 0,
        settled: !input.contact,
      }
    },
    dispose() {
      disposed = true
    },
    resources: () => (disposed ? 0 : 1),
  }
}
