import assert from 'node:assert/strict'
import { cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

export async function prepareFrameworks({ root, scratch, artifact, run }) {
  const consumer = join(scratch, 'web-frameworks')
  cpSync(join(root, 'test/fixtures/package-consumers/web-frameworks'), consumer, {
    recursive: true,
  })
  run('npm', ['install', artifact, '--no-audit', '--no-fund'], consumer)
  const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json')))
  assert(
    !Object.keys(lock.packages).some((name) =>
      /@nativescript|nativescript-vue/.test(name),
    ),
    'DOM consumers must not install NativeScript',
  )
  for (const mode of ['NodeNext', 'Bundler'])
    run(
      process.execPath,
      [
        join(root, 'node_modules/typescript/bin/tsc'),
        '-p',
        'tsconfig.json',
        '--moduleResolution',
        mode,
        '--module',
        mode === 'Bundler' ? 'ESNext' : 'NodeNext',
      ],
      consumer,
    )
  const require = createRequire(join(consumer, 'package.json'))
  const { compile } = require('svelte/compiler')
  const svelte = readFileSync(join(consumer, 'App.svelte'), 'utf8')
  for (const generate of ['client', 'server'])
    writeFileSync(
      join(consumer, `svelte-${generate}.js`),
      compile(svelte, { filename: 'App.svelte', generate }).js.code,
    )
  const { transformAsync } = await import(
    pathToFileURL(require.resolve('@babel/core')).href
  )
  for (const generate of ['dom', 'ssr']) {
    const output = await transformAsync(
      readFileSync(join(consumer, 'solid.jsx'), 'utf8'),
      {
        filename: 'solid.jsx',
        configFile: false,
        babelrc: false,
        presets: [
          [require.resolve('babel-preset-solid'), { generate, hydratable: true }],
        ],
      },
    )
    writeFileSync(join(consumer, `solid-${generate}.js`), output.code)
  }
  const servers = {
    react: `import React from 'react'; import {renderToString} from 'react-dom/server'; import {Tree} from './react.jsx'; const html=renderToString(React.createElement(Tree));`,
    svelte: `import {render} from 'svelte/server'; import App from './svelte-server.js'; const html=render(App).body;`,
    solid: `import {renderToString,generateHydrationScript} from 'solid-js/web'; import {App} from './solid-ssr.js'; const html=generateHydrationScript()+renderToString(()=>App({}));`,
    angular: `import '@angular/compiler'; import {renderApplication} from '@angular/platform-server'; import {bootstrapApplication,provideClientHydration} from '@angular/platform-browser'; import {App,provideZonelessChangeDetection} from './angular.js'; const html=await renderApplication(context=>bootstrapApplication(App,{providers:[provideZonelessChangeDetection(),provideClientHydration()]},context),{document:'<!doctype html><html><head></head><body><app-root></app-root></body></html>',url:'http://localhost/angular',allowedHosts:['localhost']});`,
  }
  const clients = {
    react: `import React from 'react'; import {hydrateRoot} from 'react-dom/client'; import {Tree} from './react.jsx'; const app=hydrateRoot(document.querySelector('#app'),React.createElement(Tree,{runtime})); const unmount=()=>app.unmount();`,
    svelte: `import {hydrate,unmount as remove} from 'svelte'; import App from './svelte-client.js'; const app=hydrate(App,{target:document.querySelector('#app'),props:{runtime}}); const unmount=()=>remove(app);`,
    solid: `import {hydrate} from 'solid-js/web'; import {App} from './solid-dom.js'; const unmount=hydrate(()=>App({runtime}),document.querySelector('#app'));`,
    angular: `import '@angular/compiler'; import {bootstrapApplication,provideClientHydration} from '@angular/platform-browser'; import {App,MOTION,provideZonelessChangeDetection} from './angular.js'; const app=await bootstrapApplication(App,{providers:[provideZonelessChangeDetection(),provideClientHydration(),{provide:MOTION,useValue:runtime}]}); const unmount=()=>app.destroy();`,
  }
  const output = join(consumer, 'built')
  mkdirSync(output)
  const results = {}
  for (const name of Object.keys(clients)) {
    const serverEntry = join(consumer, `${name}-server-entry.js`)
    writeFileSync(
      serverEntry,
      `${servers[name]}\nimport {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(join(output, `${name}-ssr.html`))},html);`,
    )
    const serverOutput = join(consumer, `${name}-ssr.mjs`)
    await build({
      entryPoints: [serverEntry],
      outfile: serverOutput,
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
    })
    // Separate Node process: server rendering has no browser globals or source aliases.
    run(process.execPath, [serverOutput], consumer)
    const rendered = readFileSync(join(output, `${name}-ssr.html`), 'utf8')
    assert(rendered.includes('Press me'), `${name}: actual SSR output missing`)
    const entry = join(consumer, `${name}-client-entry.js`)
    writeFileSync(
      entry,
      `import {createWebRuntime} from '@rafaelaugusto/jolt/web'; const runtime=createWebRuntime(document); ${clients[name]} window.fixture={runtime,unmount,dispose(){unmount();runtime.dispose()}, diagnostics:runtime.diagnostics({development:true})};`,
    )
    const bundle = await build({
      entryPoints: [entry],
      outfile: join(output, `${name}.js`),
      bundle: true,
      platform: 'browser',
      format: 'esm',
      conditions: ['browser'],
      metafile: true,
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"development"' },
    })
    assert(
      !Object.keys(bundle.metafile.inputs).some((path) =>
        /@nativescript|nativescript-vue|\/dist\/(react|angular|solid|svelte)\//.test(
          path,
        ),
      ),
      `${name}: native dependency leaked into DOM bundle`,
    )
    const head =
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css">'
    const script = `<script type="module" src="/${name}.js"></script>`
    const html =
      name === 'angular'
        ? rendered
            .replace('</head>', head + '</head>')
            .replace('</body>', script + '</body>')
        : `<!doctype html><html><head>${head}</head><body><div id="app">${rendered}</div>${script}</body></html>`
    writeFileSync(join(output, `${name}.html`), html)
    results[name] = {
      ssr: true,
      bytes: Object.values(bundle.metafile.outputs).reduce(
        (sum, value) => sum + value.bytes,
        0,
      ),
    }
  }
  cpSync(join(consumer, 'styles.css'), join(output, 'styles.css'))
  await build({
    entryPoints: [join(consumer, 'tools.js')],
    outfile: join(output, 'tools.js'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    logLevel: 'silent',
  })
  cpSync(join(consumer, 'tools.html'), join(output, 'tools.html'))
  return { consumer, output, results }
}
