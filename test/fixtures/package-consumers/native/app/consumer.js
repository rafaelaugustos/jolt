import { animate, motionValue } from '@rafaelaugusto/jolt'
import { mapKitCoordinate } from '@rafaelaugusto/jolt/native'
import { install } from '@rafaelaugusto/jolt/vue'

// Keep all three public native entries in the production graph. This is a
// resolver/bundle probe; real native playback is covered by the existing CI app.
globalThis.__JOLT_PACKED_NATIVE__ = { animate, motionValue, mapKitCoordinate, install }
