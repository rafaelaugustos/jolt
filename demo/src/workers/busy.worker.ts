import '@nativescript/core/globals'
import { busyWork } from '../busy-work'

const scope = globalThis as unknown as {
  onmessage: (event: { data: unknown }) => void
  postMessage(message: unknown): void
}
scope.onmessage = (event) => {
  if (event.data !== 'work') return
  scope.postMessage({ type: 'done', ...busyWork(), threadId: android.os.Process.myTid() })
}
scope.postMessage({ type: 'ready' })
