export interface TrialWindow {
  startedAt: number
  completedAt: number
  workStartedAt: number
  workReturnedAt: number
}
export function summarizeFrames(
  text: string,
  trial: TrialWindow,
): {
  samples: number
  maxUiFrameGapMs: number | null
  maxGapAcrossWorkMs: number | null
  maxRecordedFrameMs: number | null
}
