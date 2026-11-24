import { createWebRuntime, listTransferOptions } from '../../src/web/public.js'
const runtime = createWebRuntime(document),
  list = document.querySelector<HTMLElement>('#list')!,
  status = document.querySelector('output')!
const mode = location.hash.slice(1) || 'Grid',
  horizontal = mode === 'Carousel' || mode === 'RTL'
document.querySelector('h1')!.textContent =
  mode === 'Heights'
    ? 'Measured row heights'
    : mode === 'RTL'
      ? 'Right-to-left carousel'
      : mode
list.className = mode.toLowerCase()
if (mode === 'RTL') list.dir = 'rtl'
let items = Array.from(
    { length: 60 },
    (_, i) => 'Card ' + String(i + 1).padStart(2, '0'),
  ),
  commits = 0,
  mutations = 0
let right = ['Dune', 'Elm']
const nodes = new Map<string, HTMLElement>()
function card(key: string) {
  let el = nodes.get(key)
  if (!el) {
    el = document.createElement('div')
    el.className = 'card'
    el.dataset.key = key
    el.textContent = key
    nodes.set(key, el)
  }
  return el
}
function button(title: string, fn: () => void) {
  const b = document.createElement('button')
  b.textContent = title
  b.onclick = fn
  document.querySelector('nav')!.append(b)
}
function render(next: readonly string[]) {
  items = [...next]
  list.replaceChildren(...items.map(card))
}
if (mode === 'Transfer') {
  items = ['Atlas', 'Birch', 'Cedar']
  const left = document.createElement('section'),
    target = document.createElement('section')
  list.append(left, target)
  let reject = false,
    revision = 0
  const owners: ReturnType<typeof runtime.dropZones>[] = []
  function draw() {
    for (const o of owners.splice(0)) o.dispose()
    for (const retained of nodes.values()) runtime.release(retained)
    left.replaceChildren(...items.map(card))
    target.replaceChildren(...right.map(card))
    for (const [from, to, container] of [
      [items, right, target],
      [right, items, left],
    ] as const)
      for (const key of from) {
        owners.push(
          runtime.dropZones(card(key), {
            ...listTransferOptions({
              key,
              target: container,
              sourceKeys: () => from,
              targetKeys: () => to,
              revision: () => revision,
              centers: () =>
                to.map((key) => {
                  const r = card(key).getBoundingClientRect()
                  return { key, center: r.top + r.height / 2 }
                }),
              accept: () => !reject,
              preview(move) {
                for (const el of nodes.values()) el.classList.remove('slot')
                container.classList.toggle('end', !!move && !move.beforeKey)
                if (move?.beforeKey) card(move.beforeKey).classList.add('slot')
                if (move)
                  status.value = 'Insert ' + key + ' at position ' + (move.toIndex + 1)
              },
              commit(move) {
                from.splice(move.fromIndex, 1)
                to.splice(move.toIndex, 0, key)
                commits++
                revision++
                status.value = 'Moved ' + key
                queueMicrotask(draw)
              },
            }),
            drag: { snap: [0] },
          }),
        )
      }
  }
  draw()
  button('Empty', () => {
    right.splice(0)
    revision++
    draw()
    status.value = 'Empty destination'
  })
  button('Reject', () => {
    reject = !reject
    status.value = reject ? 'Reject drops' : 'Accept drops'
  })
} else {
  render(items)
  const rows = () => items.map((key) => ({ key, target: card(key) }))
  const changes = runtime.listChanges(list, {
    axis: horizontal ? 'x' : 'y',
    key: (s: string) => s,
    adapter: { items: () => items, render, rows },
  })
  if (mode !== 'Heights')
    runtime.reorder(list, {
      items: rows,
      axis: horizontal ? 'x' : 'y',
      layout: horizontal ? 'linear' : 'grid',
      onCommit(move) {
        const next = [...items]
        next.splice(move.toIndex, 0, next.splice(move.fromIndex, 1)[0]!)
        render(next)
        commits++
        status.value = 'Moved ' + move.key + ' to ' + (move.toIndex + 1)
      },
    })
  function update(next: string[], message: string) {
    changes.update(next)
    mutations++
    status.value = message
  }
  button('Insert', () => update(['New ' + mutations, ...items], 'Inserted one card'))
  button('Delete', () =>
    update(
      items.filter((_, i) => i !== 1),
      'Deleted one card',
    ),
  )
  button('Move pair', () => {
    const viewport = list.getBoundingClientRect()
    const index = items.findIndex((key) => {
      const r = card(key).getBoundingClientRect()
      return (
        r.top >= viewport.top &&
        r.bottom <= viewport.bottom &&
        r.left >= viewport.left &&
        r.right <= viewport.right
      )
    })
    if (index < 0 || index + 2 >= items.length) return
    const next = [...items]
    next.splice(index + 2, 0, next.splice(index + 1, 1)[0]!)
    update(next, 'Moved a visible card')
  })
  button('Jump', () =>
    card('Card 19').scrollIntoView({ block: 'nearest', inline: 'nearest' }),
  )
}
Object.assign(window, {
  snapshot: () => ({ items: [...items], right: [...right], commits, mutations }),
})
