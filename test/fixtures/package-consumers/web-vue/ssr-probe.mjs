import assert from 'node:assert/strict'
import { createSSRApp, defineComponent, h, shallowRef } from 'vue'
import { renderToString } from 'vue/server-renderer'
// Vue itself checks typeof document at module initialization. This consumer has
// no browser globals; once Vue loads, guard against Jolt touching them as well.
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'requestAnimationFrame',
  'MutationObserver',
  'matchMedia',
])
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      throw new Error(`Jolt accessed ${name}`)
    },
  })
const module = await import(process.argv[2] ?? '@rafaelaugusto/jolt/web/vue')
if (module.render)
  assert.equal(await module.render(), '<main data-motion="function">SSR</main>')
else {
  assert.deepEqual(Object.keys(module), ['useWebMotion'])
  const app = createSSRApp(
    defineComponent({
      setup() {
        const motion = module.useWebMotion(shallowRef(null))
        assert.throws(() => motion.animate({ x: 10 }), /mounted HTMLElement/)
        return () => h('main', 'SSR')
      },
    }),
  )
  assert.equal(await renderToString(app), '<main>SSR</main>')
}
console.log('PASS: packed Vue adapter SSR render without browser globals')
