import { createWebRuntime } from '../../src/web/public.js'
const mode = new URLSearchParams(location.search).get('demo') ?? 'items'
document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
*{box-sizing:border-box}body{margin:0;background:#101a20;color:#e8efed;font:17px system-ui}.shell{max-width:860px;margin:32px auto;padding:20px}small{letter-spacing:3px;color:#b7e798}h1{font-size:42px;margin:15px 0}p{color:#a7b7b9;line-height:1.6}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}button{font:inherit;color:inherit;cursor:pointer;border:1px solid #44605e;background:#243b3c;border-radius:10px;padding:12px 18px}button:hover{background:#355450}.panel{background:#182b30;border:1px solid #385153;border-radius:20px;padding:22px}#rows{height:390px;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:10px 20px}.card{padding:24px;text-align:left;background:#24423e;border:1px solid #54766a;border-radius:16px;min-height:80px;flex-shrink:0;display:flex;justify-content:space-between}.card strong{color:#c4eea1}.hint{color:#a6b6b9;font-size:14px}#rail{overflow:auto;width:100%;height:240px;border-radius:14px;outline-offset:8px}#chapters{display:flex;width:max-content;gap:16px}.chapter{width:280px;height:210px;padding:24px;background:#284b42;border-radius:16px;color:#c4eea1;font-size:26px;display:flex;align-items:flex-end}.meter{height:9px;background:#2f4549;border-radius:10px;margin:28px 0;overflow:hidden}#progress{height:100%;background:#c4eea1;transform-origin:left}#status{min-height:28px;color:#c4eea1;margin:18px 0}
</style>`,
)
document.querySelector('#stage')!.innerHTML =
  `<main class="shell"><small>JOLT · WEB</small><h1>${mode === 'items' ? 'Same row. New identity.' : 'Motion follows the scroll.'}</h1><p>${mode === 'items' ? 'Enter by item identity. Keep the motion when the list changes.' : 'Horizontal progress, forward and back. The same recipe works in RTL.'}</p><div class="toolbar">${mode === 'items' ? '<button id="append">Add item</button><button id="recycle">Recycle first row</button><button id="reorder">Reverse order</button><button id="forget">Replay identities</button>' : '<button id="rtl">Switch to RTL</button><button id="ltr">Switch to LTR</button><button id="reset">Back to start</button>'}</div><div class="panel">${mode === 'items' ? '<div id="rows"></div>' : '<div id="rail" tabindex="0"><div id="chapters"></div></div><div class="meter"><div id="progress"></div></div>'}<div id="status"></div><div class="hint">${mode === 'items' ? 'Press any row. Its feedback composes with the entrance.' : 'Scroll horizontally with a trackpad or focus the rail and use arrow keys.'}</div></div></main>`
const runtime = createWebRuntime(document)
const status = document.querySelector<HTMLElement>('#status')!
if (mode === 'items') {
  const host = document.querySelector<HTMLElement>('#rows')!
  let next = 0
  const make = () => {
    const key = ++next,
      target = document.createElement('button')
    target.className = 'card'
    target.innerHTML = `<strong>Item ${String(key).padStart(2, '0')}</strong><span>Press ↗</span>`
    host.append(target)
    runtime.press(target)
    return { key, target }
  }
  const rows = Array.from({ length: 3 }, make)
  const items = runtime.animateItems(
    rows,
    { opacity: [0.15, 1], x: [-40, 0] },
    { duration: 700, ease: 'easeOut', root: host, once: true },
  )
  status.textContent = 'Three identities. One collection controller.'
  document.querySelector('#append')!.addEventListener('click', () => {
    rows.push(make())
    items.update(rows)
    host.scrollTop = host.scrollHeight
    status.textContent = `Item ${next} joined the collection.`
  })
  document.querySelector('#recycle')!.addEventListener('click', () => {
    const row = rows[0]!
    row.key = ++next
    row.target.innerHTML = `<strong>Item ${String(next).padStart(2, '0')}</strong><span>Same DOM row ↗</span>`
    items.update(rows)
    host.scrollTop = 0
    status.textContent = 'The reused element enters for its new item.'
  })
  document.querySelector('#reorder')!.addEventListener('click', () => {
    rows.reverse()
    for (const row of rows) host.append(row.target)
    items.update(rows)
    host.scrollTop = 0
    status.textContent = 'Known identities keep their once history.'
  })
  document.querySelector('#forget')!.addEventListener('click', () => {
    items.forget()
    status.textContent = 'History cleared explicitly. Visible items enter again.'
  })
} else {
  const rail = document.querySelector<HTMLElement>('#rail')!,
    progress = document.querySelector<HTMLElement>('#progress')!
  document.querySelector('#chapters')!.innerHTML = Array.from(
    { length: 6 },
    (_, i) => `<div class="chapter">Chapter ${i + 1}<br>→</div>`,
  ).join('')
  const input = runtime.scrollValue(rail, { axis: 'x' })
  const maximum = rail.scrollWidth - rail.clientWidth
  const link = runtime.scrollLinked(
    rail,
    progress,
    { scaleX: [0.02, 1] },
    { axis: 'x', range: [0, maximum] },
  )
  const update = () => {
    status.textContent = `${getComputedStyle(rail).direction.toUpperCase()} · ${Math.round(input.get())} / ${maximum} CSS px`
  }
  input.subscribe(update)
  update()
  for (const direction of ['rtl', 'ltr'])
    document.querySelector('#' + direction)!.addEventListener('click', () => {
      rail.dir = direction
      rail.scrollLeft = 0
      input.refresh()
      link.refresh()
      update()
    })
  document.querySelector('#reset')!.addEventListener('click', () => {
    rail.scrollLeft = 0
    input.refresh()
    update()
  })
}
window.addEventListener('pagehide', () => runtime.dispose(), { once: true })
