const { resolve } = require('path')
const webpack = require('@nativescript/webpack')
const { execFileSync } = require('child_process')

module.exports = (env) => {
  webpack.init(env)

  webpack.chainWebpack((config) => {
    config.resolve.alias
      // Jolt from this repository: run `npm run dev` at the root
      .set('@rafaelaugusto/jolt', resolve(__dirname, '../dist/index.js'))
      // sharing this app's copy of NativeScript
      .set('@nativescript/core', resolve(__dirname, 'node_modules/@nativescript/core'))

    if (env.benchmark || env.fadeBenchmark) {
      if (
        env.hmr ||
        process.env.JOLT_BENCHMARK !== '1' ||
        (env.benchmark && !env.ios) ||
        (env.fadeBenchmark && !env.android) ||
        (env.benchmark && env.fadeBenchmark)
      ) {
        throw new Error(
          'Use JOLT_BENCHMARK=1 and --no-hmr with --env.benchmark on iOS or --env.fadeBenchmark on Android.',
        )
      }
      config
        .entry('bundle')
        .clear()
        .add('@nativescript/core/globals/index')
        .add('@nativescript/core/bundle-entry-points')
        .add(
          resolve(
            __dirname,
            env.fadeBenchmark
              ? '../benchmarks/android-fade.ts'
              : '../benchmarks/ios-startup.ts',
          ),
        )
      if (env.android) {
        config
          .entry('bundle')
          .add('@nativescript/core/ui/frame')
          .add('@nativescript/core/ui/frame/activity')
      }
      config.plugin('jolt-benchmark').use(require('webpack').DefinePlugin, [
        {
          __BENCHMARK_BUILD__: JSON.stringify({
            commit: execFileSync('git', ['rev-parse', 'HEAD'], {
              cwd: __dirname,
              encoding: 'utf8',
            }).trim(),
            dirty: !!execFileSync('git', ['status', '--porcelain'], {
              cwd: __dirname,
              encoding: 'utf8',
            }).trim(),
            jolt: require('../package.json').version,
            core: require('@nativescript/core/package.json').version,
            runtime: require(
              env.android
                ? '@nativescript/android/package.json'
                : '@nativescript/ios/package.json',
            ).version,
            driverSha256: require('crypto')
              .createHash('sha256')
              .update(
                require('fs').readFileSync(
                  resolve(__dirname, '../src/driver/android.ts'),
                ),
              )
              .digest('hex'),
            bundleMode: config.get('mode'),
            builtAt: new Date().toISOString(),
          }),
        },
      ])
    }
  })

  return webpack.resolveConfig()
}
