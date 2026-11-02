/** Boundary timers use the context clock and suspend while the document is hidden. */
export class ContextTimers {
  private entries = new Set<{ at: number; callback(): void; id?: number }>()
  constructor(
    private readonly view: Window,
    private readonly now: () => number,
    private readonly hidden: () => boolean,
  ) {}
  get size() {
    return this.entries.size
  }
  after(ms: number, callback: () => void) {
    if (!Number.isFinite(ms)) return () => {}
    const entry = {
      at: this.now() + Math.max(0, ms),
      callback,
      id: undefined as number | undefined,
    }
    this.entries.add(entry)
    this.schedule(entry)
    return () => {
      this.view.clearTimeout(entry.id)
      this.entries.delete(entry)
    }
  }
  private schedule(entry: { at: number; callback(): void; id?: number }) {
    this.view.clearTimeout(entry.id)
    entry.id = undefined
    if (this.hidden() || !this.entries.has(entry)) return
    entry.id = this.view.setTimeout(
      () => {
        entry.id = undefined
        if (!this.entries.has(entry)) return
        if (this.now() < entry.at) {
          this.schedule(entry)
          return
        }
        this.entries.delete(entry)
        entry.callback()
      },
      Math.min(2_147_483_647, Math.max(0, entry.at - this.now())),
    )
  }
  visibilityChanged() {
    for (const entry of this.entries) this.schedule(entry)
  }
  dispose() {
    for (const entry of this.entries) this.view.clearTimeout(entry.id)
    this.entries.clear()
  }
}
