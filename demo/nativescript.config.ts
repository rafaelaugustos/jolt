import type { NativeScriptConfig } from '@nativescript/core'

export default {
  id:
    process.env.JOLT_BINDING_BENCHMARK === '1'
      ? 'org.nativescript.jolt.bindings'
      : process.env.JOLT_BENCHMARK === '1'
        ? 'org.nativescript.jolt.benchmark'
        : 'org.nativescript.jolt',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
} satisfies NativeScriptConfig
