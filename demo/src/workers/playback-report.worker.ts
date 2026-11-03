import '@nativescript/core/globals'
import { knownFolders } from '@nativescript/core'
import {
  PlaybackReport,
  type PlaybackReportEvent,
} from '../../../benchmarks/playback-report'

const report = new PlaybackReport()
const threadId = android.os.Process.myTid()
let replay: object | undefined
self.onmessage = (message) => {
  const { id, type, event } = message.data as {
    id: number
    type: 'record' | 'replay'
    event: PlaybackReportEvent
  }
  try {
    let readMs = 0
    if (type === 'replay' && !replay) {
      const start = performance.now()
      replay = JSON.parse(
        knownFolders.externalDocuments().getFile('profile-input.json').readTextSync(),
      )
      readMs = performance.now() - start
    }
    const start = performance.now()
    const text = JSON.stringify(
      type === 'record' ? report.accept(event) : replay,
      null,
      2,
    )
    if (type === 'record') {
      knownFolders
        .documents()
        .getFile('jolt-playback-efficiency.json')
        .writeTextSync(text)
      knownFolders
        .externalDocuments()
        .getFile('jolt-playback-efficiency.json')
        .writeTextSync(text)
    } else
      knownFolders.externalDocuments().getFile('profile-output.json').writeTextSync(text)
    self.postMessage({
      type: 'saved',
      id,
      threadId,
      elapsedMs: performance.now() - start,
      readMs,
      characters: text.length,
    })
  } catch (error) {
    self.postMessage({ type: 'error', id, threadId, error: String(error) })
  }
}
self.postMessage({ type: 'ready', threadId })
