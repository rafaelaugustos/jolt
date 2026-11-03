export interface WebReturnContext {
  readonly key: string
  readonly signal: AbortSignal
}
export interface WebReturnTarget {
  key: string
  resolve(
    context: WebReturnContext,
  ): HTMLElement | null | undefined | Promise<HTMLElement | null | undefined>
  timeout?: number
  fallbackFocus?: () => HTMLElement | undefined
}
export interface WebListTargetOptions {
  container: HTMLElement
  indexOf(key: string): number
  /** Realize/scroll the current index. May await the framework's DOM commit. */
  scrollToIndex(index: number, context: WebReturnContext): void | Promise<void>
  viewForKey(key: string): HTMLElement | undefined
  keyOf(view: HTMLElement): string | undefined
}
function frame(view: Window, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const finish = () => {
      view.cancelAnimationFrame(id)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const id = view.requestAnimationFrame(finish)
    signal.addEventListener('abort', finish, { once: true })
  })
}
function realization(work: void | Promise<void>, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', finish)
      resolve()
    }
    signal.addEventListener('abort', finish, { once: true })
    if (signal.aborted) finish()
    void Promise.resolve(work).then(finish, (error) => {
      signal.removeEventListener('abort', finish)
      reject(error)
    })
  })
}
/** Never retain a cell or index across a route. Revalidate identity and two layout frames. */
export async function resolveListTarget(
  context: WebReturnContext,
  options: WebListTargetOptions,
): Promise<HTMLElement | undefined> {
  if (
    !context ||
    typeof context.key !== 'string' ||
    !context.key.trim() ||
    !context.signal ||
    !options ||
    [options.indexOf, options.scrollToIndex, options.viewForKey, options.keyOf].some(
      (f) => typeof f !== 'function',
    )
  )
    throw new TypeError(
      'A list return requires a stable key, signal and realization callbacks.',
    )
  const container = options.container,
    view = container.ownerDocument.defaultView!
  let previous: { target: HTMLElement; box: number[] } | undefined
  for (let i = 0; i < 8 && !context.signal.aborted; i++) {
    if (!container.isConnected) return
    const index = options.indexOf(context.key)
    if (!Number.isSafeInteger(index) || index < 0) return
    await realization(options.scrollToIndex(index, context), context.signal)
    if (context.signal.aborted) return
    await frame(view, context.signal)
    if (context.signal.aborted || !container.isConnected) return
    if (options.indexOf(context.key) !== index) {
      previous = undefined
      continue
    }
    const target = options.viewForKey(context.key)
    if (
      !target ||
      !target.isConnected ||
      !container.contains(target) ||
      options.keyOf(target) !== context.key
    ) {
      previous = undefined
      continue
    }
    const r = target.getBoundingClientRect(),
      box = [r.x, r.y, r.width, r.height]
    if (r.width <= 0 || r.height <= 0 || box.some((v) => !Number.isFinite(v))) return
    if (
      previous?.target === target &&
      box.every((v, j) => Math.abs(v - previous!.box[j]!) < 0.5)
    )
      return target
    previous = { target, box }
  }
}
