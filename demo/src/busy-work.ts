export const WORK_MS = 300

/** Deliberate CPU work for the demo, shared unchanged with its worker. */
export function busyWork() {
  const started = Date.now()
  let checksum = 0
  while (Date.now() - started < WORK_MS) {
    for (let i = 0; i < 2048; i++)
      checksum = Math.imul(checksum ^ i, 1664525) + 1013904223
  }
  return { elapsedMs: Date.now() - started, checksum }
}
