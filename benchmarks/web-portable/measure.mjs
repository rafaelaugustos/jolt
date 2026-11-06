/** Repeat equivalent browser workloads, without screenshots or video. */
import { chromium, firefox, webkit } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import os from 'node:os'
import { resolve } from 'node:path'
const output = resolve(process.argv[2] || 'benchmarks/results/portable-foundations')
await mkdir(output, { recursive: true })
const sourceFiles = ['src/core', 'src/web', 'benchmarks/web-portable']
  .flatMap((dir) =>
    readdirSync(dir, { recursive: true })
      .filter((path) => /\.(ts|mjs|html)$/.test(path))
      .map((path) => dir + '/' + path),
  )
  .concat('demo/src/portable-recipe.ts')
  .sort()
const identity = {
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceSHA256: Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash('sha256').update(readFileSync(path)).digest('hex'),
    ]),
  ),
  host: { os: os.release(), cpu: os.cpus()[0]?.model, totalMemoryBytes: os.totalmem() },
}
const server = spawn(process.execPath, ['benchmarks/web-portable/server.mjs'], {
  stdio: 'ignore',
})
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4326')).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 920, height: 740 } })
      await page.goto('http://127.0.0.1:4326/?mode=drawing')
      await page.waitForFunction(() => !!window.portable)
      const report = {
        browser: name,
        version: browser.version(),
        platform: process.platform,
        arch: process.arch,
        recorded: false,
        collection: { ...identity, timestampUTC: new Date().toISOString() },
        runs: [],
        limits:
          'RAF callback opportunities, not presentation. Chromium TaskDuration is browser main-thread task time; JSHeapUsedSize is retained JS heap, not total browser memory/PSS. Other engines expose no equivalent CPU/heap counter here.',
      }
      const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : null
      await cdp?.send('Performance.enable')
      for (const kind of ['groups', 'drawing', 'activity'])
        for (const density of kind === 'drawing' ? [259, 512, 1024] : [3])
          for (let repetition = -1; repetition < 5; repetition++)
            for (const variant of repetition % 2
              ? ['candidate', 'baseline']
              : ['baseline', 'candidate']) {
              const before = cdp
                ? (await cdp.send('Performance.getMetrics')).metrics
                : undefined
              const run = await page.evaluate(
                async ({ kind, density, variant }) => {
                  const runtime = window.portable.runtime,
                    scope = runtime.scope(),
                    stage = document.createElement('div')
                  stage.style.cssText = 'position:relative;width:760px;height:300px'
                  const host = document.getElementById('stage')
                  host.replaceChildren(stage)
                  const wait = (ms) => new Promise((r) => setTimeout(r, ms)),
                    frames = []
                  let observing = true,
                    frame
                  const tick = (time) => {
                    frames.push(time)
                    if (observing) frame = requestAnimationFrame(tick)
                  }
                  frame = requestAnimationFrame(tick)
                  let setupMs = 0,
                    updates = [],
                    skewMs = null,
                    writes = 0,
                    renderFrames = 0,
                    activeMs = 0,
                    lastActive = 0,
                    raf
                  const begin = performance.now(),
                    first = [null, null, null]
                  try {
                    if (kind === 'drawing') {
                      let items = window.portable.dots(density),
                        update
                      const circle = (i) =>
                        `M${i.cx - i.radius} ${i.cy}a${i.radius} ${i.radius} 0 1 0 ${i.radius * 2} 0a${i.radius} ${i.radius} 0 1 0 ${-i.radius * 2} 0Z`
                      if (variant === 'candidate') {
                        const drawing = scope.drawBatch(stage, {
                          viewBox: [0, 0, 760, 300],
                          styles: { dots: { fill: '#63e3c2', strokeWidth: 0 } },
                          items,
                        })
                        update = (phase) =>
                          drawing.update(
                            items
                              .slice(0, 37)
                              .map((i) => ({ ...i, cy: 15 + phase * 5, radius: 4 })),
                          )
                      } else {
                        const drawings = []
                        for (let index = 0; index < items.length; index += 32) {
                          const layer = document.createElement('div')
                          layer.style.cssText = 'position:absolute;inset:0'
                          stage.append(layer)
                          drawings.push(
                            scope.shape(layer, {
                              viewBox: [0, 0, 760, 300],
                              d: items
                                .slice(index, index + 32)
                                .map(circle)
                                .join(''),
                              fill: '#63e3c2',
                              strokeWidth: 0,
                            }),
                          )
                        }
                        update = (phase) => {
                          items = items.map((item, i) =>
                            i < 37 ? { ...item, cy: 15 + phase * 5 } : item,
                          )
                          for (let index = 0; index < 37; index += 32)
                            drawings[index / 32].set({
                              d: items
                                .slice(index, index + 32)
                                .map(circle)
                                .join(''),
                            })
                        }
                      }
                      setupMs = performance.now() - begin
                      const animation = scope.animate(
                        stage,
                        { x: [0, 8, 0] },
                        { duration: 1200, ease: 'linear' },
                      )
                      for (let phase = 0; phase < 5; phase++) {
                        await wait(160)
                        const at = performance.now()
                        update(phase)
                        updates.push(performance.now() - at)
                      }
                      await animation.finished
                    } else {
                      const targets = Array.from({ length: 3 }, (_, i) => {
                        const el = document.createElement('div')
                        el.style.cssText =
                          'height:40px;width:10px;background:#63e3c2;margin:15px'
                        stage.append(el)
                        return { el, n: 0, i }
                      })
                      const properties = targets.map((target) =>
                        scope.property(target, {
                          name: 'bench/value',
                          units: ['number'],
                          read: (t) => t.n,
                          write: (t, n) => {
                            t.n = n
                            t.el.style.width = 20 + n * 200 + 'px'
                            writes++
                            if (n > 0 && first[t.i] === null)
                              first[t.i] = performance.now()
                          },
                          encode: (n) => [n],
                          decode: (v) => v[0],
                        }),
                      )
                      const group = scope.propertyGroup({
                        a: properties[0],
                        b: properties[1],
                        c: properties[2],
                      })
                      const duration = kind === 'activity' ? 900 : 1200
                      let stopTimer
                      const render = (active) => {
                        if (raf !== undefined) cancelAnimationFrame(raf)
                        raf = undefined
                        if (lastActive) {
                          activeMs += performance.now() - lastActive
                          lastActive = 0
                        }
                        if (active) {
                          lastActive = performance.now()
                          const draw = () => {
                            renderFrames++
                            stage.style.borderColor =
                              renderFrames % 2 ? '#16273c' : '#17283d'
                            raf = requestAnimationFrame(draw)
                          }
                          raf = requestAnimationFrame(draw)
                        }
                      }
                      const activity = scope.renderActivity({
                        change: render,
                        redraw() {
                          renderFrames++
                        },
                      })
                      const animations =
                        kind === 'groups' && variant === 'baseline'
                          ? properties.map((p) =>
                              p.animate(1, { duration, ease: 'linear' }),
                            )
                          : [
                              group.animate(
                                { a: 1, b: 1, c: 1 },
                                { duration, ease: 'linear' },
                              ),
                            ]
                      if (kind === 'activity') {
                        if (variant === 'candidate') activity.track(animations[0])
                        else {
                          render(true)
                          stopTimer = setTimeout(() => render(false), 1300)
                        }
                      }
                      setupMs = performance.now() - begin
                      await Promise.all(animations.map((a) => a.finished))
                      if (kind === 'activity') {
                        await wait(800)
                        clearTimeout(stopTimer)
                        render(false)
                      }
                      if (first.every((n) => n !== null))
                        skewMs = Math.max(...first) - Math.min(...first)
                    }
                    const during = stage.querySelectorAll('*').length
                    scope.dispose()
                    const after = stage.querySelectorAll('[data-jolt-effect]').length
                    return {
                      setupMs,
                      updateMs: updates,
                      skewMs,
                      writes,
                      renderFrames,
                      activeMs,
                      frames,
                      domDescendants: during,
                      ownedEffectsAfterDispose: after,
                    }
                  } finally {
                    observing = false
                    cancelAnimationFrame(frame)
                    if (raf !== undefined) cancelAnimationFrame(raf)
                    scope.dispose()
                    stage.remove()
                  }
                },
                { kind, density, variant },
              )
              const after = cdp
                ? (await cdp.send('Performance.getMetrics')).metrics
                : undefined
              report.runs.push({
                kind,
                density,
                variant,
                repetition,
                warmup: repetition < 0,
                ...run,
                chromium: before ? { before, after } : undefined,
              })
              await page.waitForTimeout(100)
            }
      await writeFile(
        resolve(output, 'browser-' + name + '.json'),
        JSON.stringify(report, null, 2) + '\n',
      )
      console.log('Saved ' + name + ' ' + report.runs.length + ' runs')
    } finally {
      await browser.close()
    }
  }
} finally {
  server.kill()
}
