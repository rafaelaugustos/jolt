import type { PredictiveBack } from './index.js'
/** Internal native-to-native composition. Never a JS progress callback. */
export const nativeBackSessions = new WeakMap<
  PredictiveBack,
  org.rafaelaugusto.jolt.PredictiveBackSession
>()
