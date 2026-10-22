// Unit tests use FakeDriver.frame(); platform tests can exercise cancellation without native globals.
export const requestAnimationFrame = (callback: () => void) =>
  setTimeout(callback, 16) as unknown as number
export const cancelAnimationFrame = (id: number) => clearTimeout(id)
