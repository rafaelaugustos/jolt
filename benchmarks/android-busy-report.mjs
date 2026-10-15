/** Only UI-thread gfxinfo records. This is not a RenderThread presentation counter. */
export function summarizeFrames(text, trial) {
  let columns
  const rows = []
  for (const line of text.split('\n')) {
    if (line.startsWith('Flags,')) {
      columns = line.split(',').filter(Boolean)
      continue
    }
    if (!columns || !/^\d+,/.test(line)) continue
    const values = line.split(',').map(Number)
    const row = Object.fromEntries(columns.map((name, i) => [name, values[i]]))
    if (
      row.Flags === 0 &&
      row.FrameCompleted > row.IntendedVsync &&
      row.FrameCompleted < 1e18 &&
      row.IntendedVsync >= trial.startedAt * 1e6 &&
      row.IntendedVsync <= trial.completedAt * 1e6
    )
      rows.push(row)
  }
  rows.sort((a, b) => a.IntendedVsync - b.IntendedVsync)
  const gaps = rows.slice(1).map((row, i) => ({
    start: rows[i].IntendedVsync / 1e6,
    end: row.IntendedVsync / 1e6,
    ms: (row.IntendedVsync - rows[i].IntendedVsync) / 1e6,
  }))
  const nearWork = gaps.filter(
    (gap) => gap.end >= trial.workStartedAt && gap.start <= trial.workReturnedAt,
  )
  const maximum = (values) => (values.length ? Math.max(...values) : null)
  return {
    samples: rows.length,
    maxUiFrameGapMs: maximum(gaps.map((gap) => gap.ms)),
    maxGapAcrossWorkMs: maximum(nearWork.map((gap) => gap.ms)),
    maxRecordedFrameMs: maximum(
      rows.map((row) => (row.FrameCompleted - row.IntendedVsync) / 1e6),
    ),
  }
}
