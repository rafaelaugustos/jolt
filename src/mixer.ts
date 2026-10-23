import type { View } from '@nativescript/core'
import { getDriver } from './driver/index.js'
import { readValue, writeValue, type Property } from './properties.js'
import type { Track } from './track.js'
import type { LiveInput } from './live-spring-driver.js'

/** The channel of regular animations; layers are named next to it. */
export const BASE = ''

const SAMPLES_PER_SECOND = 60
const MAX_SAMPLES = 6000
/** Endless channels loop natively over the least common multiple of their periods, up to this. */
const MAX_LOOP = 30000
/** Beyond it, the composition is played in windows and sampled again at each one. */
const WINDOW = 4000

export const multiplies = (property: Property) =>
  property === 'opacity' || property === 'scaleX' || property === 'scaleY'
export const identity = (property: Property) => (multiplies(property) ? 1 : 0)
export const layerable = (property: Property) =>
  multiplies(property) ||
  property === 'x' ||
  property === 'y' ||
  property === 'rotate' ||
  property === 'rotateX' ||
  property === 'rotateY'

interface Channel {
  track: Track
  anchor: number
  offset: number
  paused: boolean
  onEnd: (finished: boolean) => void
  timer?: () => void
}

/** What the engine holds instead of a driver handle while a property is mixed. */
export class MixHandle {
  constructor(
    readonly mix: Mix,
    readonly key: string,
  ) {}
  elapsed() {
    return this.mix.elapsed(this.key)
  }
  control(position: number, paused: boolean) {
    this.mix.control(this.key, position, paused)
  }
}

const mixes = new WeakMap<View, Map<Property, Mix>>()

export function mixOf(view: View, property: Property): Mix | undefined {
  return mixes.get(view)?.get(property)
}

export function mixesOf(view: View): Mix[] {
  return [...(mixes.get(view)?.values() ?? [])]
}

export function mixFor(view: View, property: Property): Mix {
  let properties = mixes.get(view)
  if (!properties) mixes.set(view, (properties = new Map()))
  let mix = properties.get(property)
  if (!mix) properties.set(property, (mix = new Mix(view, property)))
  return mix
}

/** One property of one view: a base and named layers, played natively as one composite track. */
export class Mix {
  private live: { read(): number; layers(inputs: readonly LiveInput[]): void } | undefined
  private readonly rests = new Map<string, number>()
  private readonly channels = new Map<string, Channel>()
  private native: unknown
  private generation = 0

  constructor(
    readonly view: View,
    readonly property: Property,
  ) {
    this.rests.set(BASE, readValue(view, property))
  }

  rest(key: string): number {
    if (key === BASE && this.live) return this.live.read()
    return (
      this.rests.get(key) ??
      (key === BASE ? readValue(this.view, this.property) : identity(this.property))
    )
  }

  attachLive(base: {
    read(): number
    layers(inputs: readonly LiveInput[]): void
  }): () => void {
    this.live = base
    this.compose()
    return () => {
      if (this.live !== base) return
      this.rests.set(BASE, base.read())
      this.live = undefined
      this.compose()
    }
  }

  setRest(key: string, value: number) {
    this.rests.set(key, value)
    this.compose()
  }

  adopt(
    key: string,
    track: Track,
    startedAt: number,
    onEnd: (finished: boolean) => void,
  ) {
    this.channels.get(key)?.timer?.()
    const channel: Channel = { track, anchor: startedAt, offset: 0, paused: false, onEnd }
    this.channels.set(key, channel)
    this.schedule(key, channel)
    this.compose()
    return new MixHandle(this, key)
  }

  elapsed(key: string, now = getDriver().now()): number {
    const channel = this.channels.get(key)
    if (!channel) return 0
    return channel.paused ? channel.offset : channel.offset + now - channel.anchor
  }

  control(key: string, position: number, paused: boolean) {
    const channel = this.channels.get(key)
    if (!channel) return
    channel.timer?.()
    channel.timer = undefined
    channel.offset = position
    channel.anchor = getDriver().now()
    channel.paused = paused
    if (!paused) this.schedule(key, channel)
    this.compose()
  }

  /**
   * A channel leaves: replaced, stopped or done. A stopped layer takes its contribution
   * with it; anything else rests where it is.
   */
  detach(key: string, stopped: boolean) {
    const channel = this.channels.get(key)
    if (!channel) return
    const value = channel.track.valueAt(this.elapsed(key))
    channel.timer?.()
    this.channels.delete(key)
    this.rests.set(key, stopped && key !== BASE ? identity(this.property) : value)
    this.compose()
  }

  /** Everything stops: what is on screen becomes the base, and layers are cleared. */
  freeze() {
    const value = this.value()
    for (const [key, channel] of [...this.channels]) {
      channel.timer?.()
      this.channels.delete(key)
      channel.onEnd(false)
    }
    this.rests.clear()
    this.rests.set(BASE, value)
    this.compose()
  }

  /** The composed value on screen at `time`. */
  value(time = getDriver().now()): number {
    const now = getDriver().now()
    let result = this.part(BASE, time, now)
    const keys = new Set([...this.rests.keys(), ...this.channels.keys()])
    for (const key of keys) {
      if (key === BASE) continue
      const part = this.part(key, time, now)
      result = multiplies(this.property) ? result * part : result + part
    }
    return result
  }

  private part(key: string, time: number, now: number) {
    const channel = this.channels.get(key)
    if (!channel) return this.rest(key)
    const elapsed = channel.paused
      ? channel.offset
      : channel.offset + now - channel.anchor + (time - now)
    return channel.track.valueAt(elapsed)
  }

  private schedule(key: string, channel: Channel) {
    const remaining = channel.track.end - this.elapsed(key)
    if (!Number.isFinite(remaining)) return
    channel.timer = getDriver().after(Math.max(0, remaining), () => {
      if (this.channels.get(key) !== channel) return
      this.channels.delete(key)
      this.rests.set(key, channel.track.valueAt(channel.track.end))
      channel.onEnd(true)
      this.compose()
    })
  }

  /** Samples the composition from now and plays it as one native track. */
  private compose() {
    const driver = getDriver()
    const now = driver.now()
    const instance = ++this.generation
    const previous = this.native
    this.native = undefined

    if (this.live) {
      if (previous !== undefined) driver.stop(this.view, previous)
      const layers: LiveInput[] = []
      for (const key of new Set([...this.rests.keys(), ...this.channels.keys()])) {
        if (key === BASE) continue
        const channel = this.channels.get(key)
        const value = this.part(key, now, now)
        const track = channel?.track
        layers.push({
          value,
          running: !!channel && !channel.paused,
          elapsed: this.elapsed(key, now),
          duration: track?.duration ?? 0,
          delay: track?.delay ?? 0,
          repeat: track ? (Number.isFinite(track.repeat) ? track.repeat : -1) : 0,
          reverse: track?.reverse ?? false,
          to: track?.to ?? value,
          times: track?.times ?? [],
          values: track?.values ?? [],
        })
      }
      this.live.layers(layers)
      return
    }

    let finite = 0
    const periods: number[] = []
    for (const [key, channel] of this.channels) {
      if (channel.paused) continue
      const elapsed = this.elapsed(key, now)
      const { track } = channel
      if (Number.isFinite(track.end)) finite = Math.max(finite, track.end - elapsed)
      else if (elapsed < track.delay) finite = Math.max(finite, track.delay - elapsed)
      else periods.push(Math.max(1, Math.round(track.duration * (track.reverse ? 2 : 1))))
    }

    if (previous !== undefined) driver.stop(this.view, previous)
    const loop = finite <= 0 && periods.length ? leastCommonMultiple(periods) : undefined
    if (finite <= 0 && !periods.length) {
      writeValue(this.view, this.property, this.value(now))
      driver.sync?.(this.view)
      this.dissolve()
      return
    }

    const span = finite > 0 ? finite : (loop ?? WINDOW)
    const steps = Math.max(
      1,
      Math.min(MAX_SAMPLES, Math.ceil((span / 1000) * SAMPLES_PER_SECOND)),
    )
    const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
    const values = times.map((time) => this.value(now + time * span))
    const endless = loop !== undefined
    const at = (elapsed: number) =>
      this.value(now + (endless ? elapsed % span : Math.min(Math.max(elapsed, 0), span)))
    const track: Track = {
      property: this.property,
      delay: 0,
      duration: span,
      repeat: endless ? Infinity : 0,
      reverse: false,
      times,
      values,
      to: endless ? values[0]! : values[steps]!,
      end: endless ? Infinity : span,
      arrival: endless ? Infinity : span,
      valueAt: at,
      velocityAt: (elapsed) => (at(elapsed + 0.5) - at(elapsed - 0.5)) * 1000,
    }
    writeValue(this.view, this.property, track.to)
    this.native = driver.play(this.view, track, now, (finished = true) => {
      if (instance !== this.generation || !finished) return
      this.native = undefined
      this.compose()
    })
  }

  private dissolve() {
    if (this.live || this.channels.size) return
    for (const [key, value] of this.rests)
      if (key !== BASE && value !== identity(this.property)) return
    const properties = mixes.get(this.view)
    if (properties?.get(this.property) === this) properties.delete(this.property)
  }
}

function leastCommonMultiple(periods: readonly number[]): number | undefined {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  let result = periods[0]!
  for (const period of periods.slice(1)) {
    result = (result / gcd(result, period)) * period
    if (result > MAX_LOOP) return undefined
  }
  return result
}
