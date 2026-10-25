import { isIOS, type View } from '@nativescript/core'

export const probeProperties = [
  'x',
  'y',
  'scaleX',
  'scaleY',
  'rotate',
  'rotateX',
  'rotateY',
  'opacity',
] as const

export interface ProbeBatch {
  rows: (number | null)[][]
  dropped: number
  samples: number
  sampleCpuMs: number
  drainCpuMs: number
  active: boolean
}
export interface NativeProbe {
  drain(): ProbeBatch
  dispose(): void
}

/** Cost measurement uses a finer clock than Android's integer animation time. */
export function inspectorCostTime(): number {
  if (typeof CACurrentMediaTime === 'function') return CACurrentMediaTime() * 1000
  if (typeof java !== 'undefined') return java.lang.System.nanoTime() / 1e6
  return Date.now()
}

export function startProbe(view: View, capacity: number, hertz: number): NativeProbe {
  const native = view.nativeViewProtected
  if (!native || !view.isLoaded) throw new Error('Select a loaded native view.')
  const probe = isIOS
    ? JoltMotionProbe.startViewCapacityHertz(native, capacity, hertz)
    : org.rafaelaugusto.jolt.MotionProbe.start(native, capacity, hertz)
  return {
    drain: () => JSON.parse(probe.drain()) as ProbeBatch,
    dispose: () => probe.dispose(),
  }
}

export function activeNativeProbes() {
  return isIOS
    ? JoltMotionProbe.activeCount()
    : org.rafaelaugusto.jolt.MotionProbe.activeCount()
}
