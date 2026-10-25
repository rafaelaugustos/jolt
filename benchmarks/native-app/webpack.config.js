const { resolve } = require('node:path')
const { execFileSync } = require('node:child_process')
const webpack = require('@nativescript/webpack')

module.exports = (env) => {
  if (env.hmr || !env.production)
    throw new Error('Native CI requires --env.production --no-hmr.')
  webpack.init(env)
  webpack.chainWebpack((config) => {
    config.resolve.alias
      .set('@rafaelaugusto/jolt$', resolve(__dirname, '../../dist/index.js'))
      .set(
        '@rafaelaugusto/jolt/testing$',
        resolve(__dirname, '../../dist/testing/index.js'),
      )
      .set(
        '@rafaelaugusto/jolt/testing/native$',
        resolve(__dirname, '../../dist/testing/native.js'),
      )
      .set('@nativescript/core', resolve(__dirname, 'node_modules/@nativescript/core'))
    config.plugin('jolt-native-ci').use(require('webpack').DefinePlugin, [
      {
        __NATIVE_CI_BUILD__: JSON.stringify({
          commit: execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: __dirname,
            encoding: 'utf8',
          }).trim(),
          core: require('@nativescript/core/package.json').version,
          runtime: require(
            env.android
              ? '@nativescript/android/package.json'
              : '@nativescript/ios/package.json',
          ).version,
          jolt: require('../../package.json').version,
          mode: config.get('mode'),
        }),
      },
    ])
  })
  return webpack.resolveConfig()
}
