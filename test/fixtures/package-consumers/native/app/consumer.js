import {
  animate,
  motionValue,
  gradientText,
  motionBehaviors,
  withTimelineCues,
} from '@rafaelaugusto/jolt'
import { rig2d } from '@rafaelaugusto/jolt/rig'
import { mapKitCoordinate } from '@rafaelaugusto/jolt/native'
import { install } from '@rafaelaugusto/jolt/vue'

// Keep the public native entries in the production graph. This is a
// resolver/bundle probe; real native playback is covered by the existing CI app.
globalThis.__JOLT_PACKED_NATIVE__ = {
  animate,
  motionValue,
  mapKitCoordinate,
  install,
  gradientText,
  motionBehaviors,
  withTimelineCues,
  rig2d,
}
