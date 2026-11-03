import { createWebRuntime } from '../../src/web/runtime.js'

export function elementDemo() {
  document.querySelector('main')!.innerHTML = `
    <h1>Motion that follows the section</h1>
    <p>Scroll, insert content, then resize the section. The same link follows its layout.</p>
    <div class="panels">
      <section class="panel">
        <h2>Section-driven motion</h2>
        <div class="stage"><button id="range-card">Linked card</button></div>
        <p>Enter → leave the scroll viewport</p>
        <div class="controls"><button id="insert">Insert above</button><button id="grow">Grow section</button></div>
        <p id="range-status">One binding. Automatic layout updates.</p>
      </section>
      <section class="panel">
        <h2>Scroll this panel ↕</h2>
        <div id="range-source" tabindex="0" aria-label="Section scroll example" style="height:240px;overflow:auto;overflow-anchor:none;background:#111a16">
          <div id="range-before" style="height:300px;padding:20px">Content before the section ↓</div>
          <section id="range-anchor" style="height:300px;background:#496a43;padding:20px">Tracked section<br>Its layout defines the range.</section>
          <div style="height:600px;padding:20px">Content after the section ↑</div>
        </div>
      </section>
    </div>
    <div class="panel" style="margin-top:20px">
      <div style="display:flex;gap:24px;align-items:center">
        <button id="diagnostic-card" style="width:120px;height:50px">Responsive</button>
        <button id="conflict">Change size</button><button id="observe">Observe size</button>
      </div>
      <p id="diagnostic" style="font-size:13px;min-height:60px;overflow-wrap:anywhere">Diagnostics identify the element, property and previous/current values.</p>
    </div>`
  const motion = createWebRuntime(document, { reducedMotion: 'never' })
  const source = document.querySelector<HTMLElement>('#range-source')!
  const anchor = document.querySelector<HTMLElement>('#range-anchor')!
  const target = document.querySelector<HTMLElement>('#range-card')!
  motion.scrollLinked(
    source,
    target,
    { x: [0, 160], opacity: [1, 0.4] },
    { range: { element: anchor } },
  )
  document.querySelector('#insert')!.addEventListener('click', () => {
    document.querySelector<HTMLElement>('#range-before')!.style.height = '460px'
    document.querySelector('#range-status')!.textContent =
      '160 px inserted above. The existing link updates automatically.'
  })
  document.querySelector('#grow')!.addEventListener('click', () => {
    anchor.style.height = '500px'
    document.querySelector('#range-status')!.textContent =
      'The section is taller. Its entry/exit range follows the new size.'
  })
  const card = document.querySelector<HTMLElement>('#diagnostic-card')!
  motion.set(card, { scale: 1.02 })
  document.querySelector('#conflict')!.addEventListener('click', () => {
    card.style.width = '180px'
    try {
      motion.set(card, { scale: 1.03 })
    } catch (error) {
      document.querySelector('#diagnostic')!.textContent = (error as Error).message
    }
  })
  document.querySelector('#observe')!.addEventListener('click', () => {
    motion.refresh(card)
    motion.observeGeometry(card)
    card.style.width = '220px'
    motion.set(card, { scale: 1.03 })
    document.querySelector('#diagnostic')!.textContent =
      'observeGeometry accepts the intended resize; the same motion surface remains active.'
  })
  window.addEventListener('pagehide', () => motion.dispose(), { once: true })
}
