import { describe, expect, it } from 'vitest'
import { summarizeFrames } from '../benchmarks/android-busy-report.mjs'

const window = {
  startedAt: 1000,
  completedAt: 2000,
  workStartedAt: 1200,
  workReturnedAt: 1500,
}
const header = 'Flags,IntendedVsync,FrameCompleted,\n'
const frame = (ms: number, flags = 0, end = ms + 8) =>
  `${flags},${ms * 1e6},${end * 1e6},\n`
describe('busy benchmark UI records', () => {
  it('finds a long UI gap across work without calling it RenderThread FPS', () => {
    const result = summarizeFrames(
      header + frame(1100) + frame(1180) + frame(1510) + frame(1530),
      window,
    )
    expect(result).toEqual({
      samples: 4,
      maxUiFrameGapMs: 330,
      maxGapAcrossWorkMs: 330,
      maxRecordedFrameMs: 8,
    })
  })
  it('rejects flagged frames, missing completions and records outside the trial', () => {
    const result = summarizeFrames(
      header +
        frame(900) +
        frame(1150, 1) +
        frame(1200) +
        frame(1250, 0, 9.223372e12) +
        frame(1300) +
        frame(2100),
      window,
    )
    expect(result.samples).toBe(2)
    expect(result.maxGapAcrossWorkMs).toBe(100)
  })
  it('does not invent a gap with too few samples', () => {
    expect(summarizeFrames(header + frame(1400), window).maxGapAcrossWorkMs).toBeNull()
    expect(summarizeFrames('', window)).toEqual({
      samples: 0,
      maxUiFrameGapMs: null,
      maxGapAcrossWorkMs: null,
      maxRecordedFrameMs: null,
    })
  })
})
