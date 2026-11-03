/** A fixed research snapshot, not release telemetry or a cross-device ranking. */
export const performanceStudy = {
  date: '2026-11-03',
  commit: 'c15b7f0da59168bcf1baa187daa7a622e9e5c19b',
  pullRequest: 'https://github.com/rafaelaugustos/jolt/pull/395',
  statusAtSnapshot: 'open',
  device: 'ASUS ZenFone 3',
  os: 'Android 8.0.0',
  seconds: 30,
  pairs: 5,
  // Default-profile cohort only. Do not combine with the sequential size cohort.
  cpu: { jolt: 6.79, reanimated: 14.63, unit: 's / 30 s' },
  memory: { jolt: 88.27, reanimated: 85.65, unit: 'MiB' },
  presentation: { jolt: 32.43, reanimated: 25.28, unit: 'ms' },
} as const
export const studySource = `https://github.com/rafaelaugustos/jolt/blob/${performanceStudy.commit}/benchmarks/results/android-followup-2026-11-03/README.md`
