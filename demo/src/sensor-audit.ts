import { launchArgument } from './launch'

// Keep one trace across real route destruction/recreation, only in the opt-in audit.
const session = Date.now()
const lifecycleEvents: object[] = []
let instance = 0
export function sensorAudit() {
  const lifecycle = launchArgument('sensors-lifecycle') !== undefined
  return {
    enabled: lifecycle || launchArgument('sensors-audit') !== undefined,
    lifecycle,
    session,
    instance: ++instance,
    events: lifecycle ? lifecycleEvents : ([] as object[]),
  }
}
