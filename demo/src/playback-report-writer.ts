import type { PlaybackReportEvent } from '../../benchmarks/playback-report'

type Reply = {
  type: string
  id?: number
  error?: string
  threadId: number
  elapsedMs?: number
  characters?: number
  readMs?: number
}

/** Demo tooling only. One acknowledged message at a time; terminate on exit/error. */
export class PlaybackReportWriter {
  readonly ready: Promise<{ threadId: number; startupMs: number }>
  private worker: Worker
  private closed = false
  private sequence = 0
  private pending:
    | {
        id: number
        resolve(value: Reply): void
        reject(error: Error): void
        timer: ReturnType<typeof setTimeout>
      }
    | undefined
  private failReady!: (error: Error) => void
  private readyTimer: ReturnType<typeof setTimeout>

  constructor(
    makeWorker = () => new Worker('./workers/playback-report.worker'),
    timeout = 10000,
  ) {
    const started = performance.now()
    this.worker = makeWorker()
    this.ready = new Promise((resolve, reject) => {
      this.failReady = reject
      this.worker.onmessage = (message) => {
        if (this.closed) return
        const reply = message.data as Reply
        if (reply.type === 'ready') {
          clearTimeout(this.readyTimer)
          resolve({ threadId: reply.threadId, startupMs: performance.now() - started })
        } else if (this.pending && this.pending.id === reply.id) {
          const pending = this.pending
          this.pending = undefined
          clearTimeout(pending.timer)
          if (reply.type === 'error') {
            const error = new Error(reply.error ?? 'Report worker failed')
            pending.reject(error)
            this.dispose(error)
          } else pending.resolve(reply)
        }
      }
      this.worker.onerror = (event) => {
        this.dispose(new Error(event.message))
        return true
      }
    })
    this.readyTimer = setTimeout(
      () => this.dispose(new Error('Report worker startup timed out')),
      timeout,
    )
  }

  async send(event: PlaybackReportEvent) {
    return this.request({ type: 'record', event })
  }

  /** Re-export the collector's real report for the separate main/worker comparison. */
  async replay() {
    return this.request({ type: 'replay' })
  }

  private async request(value: object) {
    await this.ready
    if (this.closed) throw Error('Report writer is closed')
    if (this.pending) throw Error('Wait for the previous report write to finish')
    return new Promise<Reply>((resolve, reject) => {
      const id = ++this.sequence
      const timer = setTimeout(
        () => this.dispose(new Error('Report write timed out')),
        10000,
      )
      this.pending = { id, resolve, reject, timer }
      try {
        this.worker.postMessage({ id, ...value })
      } catch (error) {
        this.dispose(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  dispose(error = new Error('Report writer disposed')) {
    if (this.closed) return
    this.closed = true
    clearTimeout(this.readyTimer)
    this.failReady(error)
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.reject(error)
      this.pending = undefined
    }
    this.worker.terminate()
  }
}
