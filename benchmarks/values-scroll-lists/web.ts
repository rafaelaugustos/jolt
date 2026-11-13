import { createWebRuntime } from '../../src/web/runtime.js'
import { createApp, h, ref } from 'vue'
import { JoltTransitionGroup } from '../../src/web/vue/index.js'
const runtime = createWebRuntime(document)
const el = (id: string) => document.getElementById(id)!
function scene(name: string) {
  document
    .querySelectorAll('section')
    .forEach((section) =>
      section.classList.toggle(
        'active',
        section.id === (['scroll', 'list'].includes(name) ? name + '-scene' : name),
      ),
    )
  if (name === 'scroll') {
    scrollBinding?.dispose()
    scrollBinding = runtime.bind(el('meter'), { scaleX: progress })
    scroll.refresh()
  }
  if (name === 'values') {
    binding.dispose()
    binding = bindValues()
  }
}
document
  .querySelectorAll<HTMLButtonElement>('[data-scene]')
  .forEach((button) => (button.onclick = () => scene(button.dataset.scene!)))
const a = runtime.motionValue(0),
  b = runtime.motionValue(0),
  sum = a.add(b),
  position = sum.mul(1.4).clamp(0, 530),
  angle = a.div(70).sin().mul(30)
const scale = sum.div(400).add(1).clamp(1, 1.7)
const bindValues = () => runtime.bind(el('orb'), { x: position, rotate: angle, scale })
let binding = bindValues()
el('combine').onclick = () => {
  a.set(0)
  b.set(0)
  runtime.animate(a, 210, { duration: 1800, ease: 'easeInOut' })
  runtime.animate(b, 110, { duration: 2600, ease: 'easeInOut' })
}
el('interrupt-values').onclick = () => {
  runtime.animate(a, 0, 'snappy')
  runtime.animate(b, 0, 'snappy')
}
el('scroll').firstElementChild!.innerHTML = Array.from(
  { length: 18 },
  (_, i) => `<p>Native browser scroll · checkpoint ${i + 1}</p>`,
).join('')
const scroll = runtime.scrollValue(el('scroll')),
  progress = scroll.to([0, 500], [0, 1])
let scrollBinding: ReturnType<typeof runtime.bind> | undefined
let cardId = 0,
  layout: ReturnType<typeof runtime.animateLayout> | undefined
function card() {
  const target = document.createElement('div')
  target.className = 'card'
  target.dataset.key = String(++cardId)
  target.innerHTML = `<b>Card ${cardId}</b>Stable identity`
  return target
}
function resetLayout() {
  layout?.stop()
  el('cards').replaceChildren(...Array.from({ length: 4 }, card))
}
function layoutChange(change: () => void) {
  layout = runtime.animateLayout(el('cards'), change, {
    duration: 800,
    ease: 'easeInOut',
    exit: { opacity: 0, y: 24, scale: 0.92 },
  })
  return layout
}
resetLayout()
el('mutate').onclick = () =>
  layoutChange(() => {
    const host = el('cards')
    host.children[1]?.remove()
    host.prepend(card())
    host.append(host.children[1]!)
  })
el('remove').onclick = () => layoutChange(() => el('cards').children[1]?.remove())
el('cancel').onclick = () => layout?.stop()
el('reset-layout').onclick = resetLayout
let items = Array.from({ length: 200 }, (_, id) => ({ id })),
  nextId = -1
const nodes = new Map<number, HTMLElement>(),
  list = el('list')
function render(next: readonly { id: number }[]) {
  items = [...next]
  const keys = new Set(items.map((item) => item.id))
  for (const [key, node] of nodes)
    if (!keys.has(key)) {
      node.remove()
      nodes.delete(key)
    }
  items.forEach((item, index) => {
    let node = nodes.get(item.id)
    if (!node) {
      node = document.createElement('div')
      node.className = 'row'
      node.dataset.key = String(item.id)
      node.innerHTML = `<span>${item.id}</span>Row ${item.id}<button aria-label="Focus row ${item.id}">Focus</button>`
      nodes.set(item.id, node)
    }
    if (list.children[index] !== node)
      list.insertBefore(node, list.children[index] ?? null)
  })
  el('list-status').textContent =
    `${items.length} rows · updates only animate visible keys`
}
render(items)
const rows = runtime.listChanges(list, {
  key: (item) => item.id,
  exit: 'fadeOut',
  move: { duration: 650, ease: 'easeInOut' },
  adapter: {
    items: () => items,
    render,
    rows: () => items.map((item) => ({ key: item.id, target: nodes.get(item.id)! })),
  },
})
function visible() {
  const top = list.getBoundingClientRect().top
  return items.filter((item) => {
    const rect = nodes.get(item.id)!.getBoundingClientRect()
    return rect.bottom > top && rect.top < top + list.clientHeight
  })
}
el('delete-row').onclick = () => {
  const target = visible()[2]
  if (target) rows.update(items.filter((item) => item.id !== target.id))
}
el('prepend').onclick = () => rows.update([{ id: nextId-- }, ...items])
el('sort').onclick = () => rows.update([...items].reverse())
el('filter').onclick = () => rows.update(items.filter((item) => item.id % 2 === 0))
el('reset-list').onclick = () =>
  rows.update(Array.from({ length: 200 }, (_, id) => ({ id })))
let groupNext = 4
const groupItems = ref([1, 2, 3])
const app = createApp({
  setup: () => () =>
    h('div', [
      h(
        'button',
        {
          id: 'group-change',
          onClick: () =>
            (groupItems.value = [groupNext++, ...groupItems.value.slice(0, 2)].reverse()),
        },
        'Change keyed children',
      ),
      h(
        JoltTransitionGroup,
        { class: 'cards', move: { duration: 800 }, leave: 'fadeOut' },
        () =>
          groupItems.value.map((id) =>
            h('div', { key: id, class: 'card' }, `Vue card ${id}`),
          ),
      ),
    ]),
})
app.mount('#vue')
Object.assign(window, {
  lab: {
    runtime,
    scene,
    a,
    b,
    sum,
    position,
    angle,
    binding,
    scroll,
    scrollBinding,
    rows,
    layoutChange,
    resetLayout,
    visible,
    stats: () => runtime.inspect(el('orb')),
    dispose: () => {
      app.unmount()
      rows.dispose()
      binding.dispose()
      scrollBinding?.dispose()
      scroll.dispose()
      a.dispose()
      b.dispose()
      runtime.dispose()
    },
  },
})
