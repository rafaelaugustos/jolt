// Explicit experiment, not a library/runtime default. Measure JS-heavy work too:
// V8's size profile favors memory over execution speed.
const profile = process.env.JOLT_COMPARISON_MEMORY_PROFILE ?? 'default'
if (!['default', 'size'].includes(profile))
  throw Error('Unknown comparison memory profile')
const workload = process.env.JOLT_COMPARISON_WORKLOAD ?? 'motion'
if (!['motion', 'js', 'retention'].includes(workload))
  throw Error('Unknown comparison workload')

export default {
  id:
    workload === 'js'
      ? 'dev.jolt.comparison.jswork'
      : workload === 'retention'
        ? 'dev.jolt.comparison.retention'
        : 'dev.jolt.comparison.jolt',
  appPath:
    workload === 'js' ? 'workload' : workload === 'retention' ? 'retention' : 'app',
  ...(workload === 'js'
    ? { main: 'workload/main.ts' }
    : workload === 'retention'
      ? { main: 'retention/main.ts' }
      : {}),
  appResourcesPath: 'App_Resources',
  ...(profile === 'size'
    ? { android: { v8Flags: '--expose_gc --optimize_for_size' } }
    : {}),
}
