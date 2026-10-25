type Frame = (callback: () => void) => () => void

/**
 * NativeScript's first RAF outside a frame is a macrotask, not a display tick.
 * Three nested callbacks cross at least two display ticks before reading a held
 * presentation. Never poll for an expected value or retry a failed assertion.
 */
export function waitForPresentation(
  frame: Frame,
  signal?: { readonly aborted: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cancel = () => {},
      callbacks = 0,
      done = false
    const finish = (error?: Error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      cancel()
      if (error) reject(error)
      else resolve()
    }
    const timer = setTimeout(
      () => finish(new Error('Sampling presentation timed out after 1500 ms.')),
      1500,
    )
    const next = () => {
      if (signal?.aborted) {
        finish(new Error('Sampling check cancelled.'))
        return
      }
      try {
        cancel = frame(() => {
          if (done) return
          if (signal?.aborted) finish(new Error('Sampling check cancelled.'))
          else if (++callbacks === 3) finish()
          else next()
        })
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    }
    next()
  })
}
