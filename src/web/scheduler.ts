/** Internal phased frame task. Returning true retains demand for another frame. */
export interface FrameTask {
  read?(time: number): void
  update?(time: number): boolean | void
  write?(time: number): void
}
export interface FrameHost {
  now(): number
  request(callback: (time: number) => void): number
  cancel(id: number): void
  error(error: unknown): void
}

/** One clock per context. Hidden time is excluded; no fixed refresh-rate step. */
export class FrameScheduler {
  private tasks = new Set<FrameTask>()
  private frame?: number
  private hiddenAt?: number
  private offset = 0
  private ended = false
  frames = 0
  constructor(private readonly host: FrameHost) {}
  now() {
    return (this.hiddenAt ?? this.host.now()) - this.offset
  }
  get pending() {
    return this.frame !== undefined
  }
  get size() {
    return this.tasks.size
  }
  add(task: FrameTask) {
    if (this.ended) return
    this.tasks.add(task)
    this.schedule()
  }
  remove(task: FrameTask) {
    this.tasks.delete(task)
    this.cancelIdle()
  }
  hidden(hidden: boolean) {
    if (this.ended || hidden === (this.hiddenAt !== undefined)) return
    if (hidden) {
      this.hiddenAt = this.host.now()
      if (this.frame !== undefined) this.host.cancel(this.frame)
      this.frame = undefined
    } else {
      this.offset += this.host.now() - this.hiddenAt!
      this.hiddenAt = undefined
      this.schedule()
    }
  }
  private cancelIdle() {
    if (!this.tasks.size && this.frame !== undefined) {
      this.host.cancel(this.frame)
      this.frame = undefined
    }
  }
  private schedule() {
    if (
      this.ended ||
      this.hiddenAt !== undefined ||
      this.frame !== undefined ||
      !this.tasks.size
    )
      return
    this.frame = this.host.request(this.flush)
  }
  private flush = (timestamp: number) => {
    this.frame = undefined
    if (this.ended || this.hiddenAt !== undefined) return
    this.frames++
    // Keep membership until each update: a read can cancel another task safely.
    const batch = [...this.tasks]
    const failed = new Set<FrameTask>()
    const time = timestamp - this.offset
    const invoke = (task: FrameTask, action: (() => void) | undefined) => {
      try {
        action?.()
      } catch (error) {
        failed.add(task)
        this.tasks.delete(task)
        this.host.error(error)
      }
    }
    for (const task of batch)
      if (this.tasks.has(task)) invoke(task, () => task.read?.(time))
    const writes: FrameTask[] = []
    for (const task of batch) {
      if (!this.tasks.delete(task) || failed.has(task)) continue
      invoke(task, () => {
        if (task.update?.(time) && !this.ended) this.tasks.add(task)
        writes.push(task)
      })
    }
    for (const task of writes)
      if (!failed.has(task) && !this.ended) invoke(task, () => task.write?.(time))
    this.cancelIdle()
    this.schedule()
  }
  dispose() {
    this.ended = true
    this.tasks.clear()
    this.cancelIdle()
  }
}
