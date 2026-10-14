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

    if (env.benchmark) {
      if (!env.ios || env.hmr || process.env.JOLT_BENCHMARK !== '1') {
        throw new Error('Use JOLT_BENCHMARK=1 with --env.benchmark --no-hmr on iOS.')
      }
      config
        .entry('bundle')
        .clear()
        .add('@nativescript/core/globals/index')
        .add('@nativescript/core/bundle-entry-points')
        .add(resolve(__dirname, '../benchmarks/ios-startup.ts'))
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
            runtime: require('@nativescript/ios/package.json').version,
            bundleMode: config.get('mode'),
            builtAt: new Date().toISOString(),
          }),
        },
      ])
    }
  })

  return webpack.resolveConfig()
}
