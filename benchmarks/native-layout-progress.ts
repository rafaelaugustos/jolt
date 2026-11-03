/** Observe real layout progress without assuming when the first frame is scheduled. */
export async function waitForLayoutProgress(
  read: () => number,
  minimum: number,
  maximum: number,
  label: string,
  timeoutMs = 3000,
): Promise<{ value: number; elapsedMs: number }> {
  const started = Date.now()
  while (true) {
    const value = read()
    const elapsedMs = Date.now() - started
    if (!Number.isFinite(value) || value >= maximum)
      throw new Error(
        `${label} missed intermediate layout: ${value}; expected ${minimum} < size < ${maximum} after ${elapsedMs}ms`,
      )
    if (elapsedMs >= timeoutMs)
      throw new Error(
        `${label} layout stalled: ${value}; expected ${minimum} < size < ${maximum} within ${timeoutMs}ms`,
      )
    if (value > minimum) return { value, elapsedMs }
    await new Promise<void>((resolve) => setTimeout(resolve, 16))
  }
}
