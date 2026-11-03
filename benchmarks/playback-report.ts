/** Append-only messages keep frame histories out of the UI runtime. */
export type PlaybackReportEvent =
  | { type: 'start'; header: Record<string, unknown> }
  | { type: 'patch'; value: Record<string, unknown> }
  | {
      type: 'append'
      collection: 'batches' | 'playback' | 'retention'
      value: Record<string, unknown>
      framesJSON?: string
    }

export class PlaybackReport {
  private report: Record<string, unknown> | undefined

  accept(event: PlaybackReportEvent) {
    if (event.type === 'start') {
      if (this.report) throw Error('Report already started')
      this.report = { ...event.header, batches: [], playback: [], retention: [] }
    } else {
      if (!this.report) throw Error('Start the report before appending data')
      if (event.type === 'patch') Object.assign(this.report, event.value)
      else {
        const value =
          event.framesJSON === undefined
            ? event.value
            : { ...event.value, frames: JSON.parse(event.framesJSON) }
        ;(this.report[event.collection] as object[]).push(value)
      }
    }
    return this.report
  }
}
