const { resolve } = require('path')
const webpack = require('@nativescript/webpack')

module.exports = (env) => {
  webpack.init(env)

  webpack.chainWebpack((config) => {
    config.resolve.alias
      // Jolt from this repository: run `npm run dev` at the root
      .set('@rafaelaugusto/jolt', resolve(__dirname, '../dist/index.js'))
      // sharing this app's copy of NativeScript
      .set('@nativescript/core', resolve(__dirname, 'node_modules/@nativescript/core'))
  })

  return webpack.resolveConfig()
}
