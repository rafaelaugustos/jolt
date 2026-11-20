import { animate, press, motionValue, motionScope } from '@rafaelaugusto/jolt'
import { mapKitCoordinate } from '@rafaelaugusto/jolt/native'

// Installation/bundle probe: the application owns framework lifecycle and imports
// only the imperative API. It does not claim renderer or binding runtime acceptance.
globalThis.__JOLT_PACKED_IMPERATIVE__ = {
  animate,
  press,
  motionValue,
  motionScope,
  mapKitCoordinate,
}
