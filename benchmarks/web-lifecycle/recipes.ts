import type { WebRuntime } from '../../src/web/public.js'

/** Application decisions are the buttons/data order; Jolt owns motion and lifetime. */
export function interactionRecipes(runtime: WebRuntime, root: HTMLElement) {
  const scope = runtime.scope()
  root.innerHTML = `<div style="display:flex;gap:24px;align-items:start">
    <div><p>Drag → spring return</p><button id="recipe-drag" style="width:100px;height:80px;background:#d7a65e;color:#17243a">Drag me</button>
      <p><button id="recipe-return">Return</button></p></div>
    <div style="width:260px"><button id="recipe-expand" aria-expanded="false" aria-controls="recipe-panel">Expand panel</button>
      <div id="recipe-panel" inert style="height:0;overflow:hidden"><p>Real intrinsic height. This content reflows and moves the list below.</p><button>Panel action</button></div>
      <p><button id="recipe-reorder">Reorder list</button> <button id="recipe-remove">Remove item</button></p>
      <div id="recipe-list" style="display:flex;gap:8px"><button>A</button><button>B</button><button>C</button></div></div></div>`
  const drag = root.querySelector<HTMLElement>('#recipe-drag')!
  scope.drag(drag, {
    bounds: { left: -10, right: 120, top: -10, bottom: 80 },
    snap: { x: [0], y: [0] },
  })
  scope.press(drag)
  const listen = (id: string, action: () => void) => {
    const target = root.querySelector(id)!
    target.addEventListener('click', action)
    scope.add(() => target.removeEventListener('click', action))
  }
  listen('#recipe-return', () => scope.animate(drag, { x: 0, y: 0 }, 'snappy'))
  const trigger = root.querySelector<HTMLButtonElement>('#recipe-expand')!
  const panel = root.querySelector<HTMLElement>('#recipe-panel')!
  let open = false
  listen('#recipe-expand', () => {
    open = !open
    trigger.setAttribute('aria-expanded', String(open))
    trigger.textContent = open ? 'Collapse panel' : 'Expand panel'
    if (!open && panel.contains(panel.ownerDocument.activeElement)) trigger.focus()
    panel.inert = !open
    scope.animateSize(panel, { height: open ? 'auto' : 0 }, 'snappy')
  })
  const list = root.querySelector<HTMLElement>('#recipe-list')!
  for (const item of list.children) scope.press(item as HTMLElement)
  listen('#recipe-reorder', () =>
    scope.animateLayout(
      list,
      () => {
        if (list.lastElementChild) list.prepend(list.lastElementChild)
      },
      'snappy',
    ),
  )
  listen('#recipe-remove', () =>
    scope.animateLayout(list, () => list.lastElementChild?.remove(), 'snappy'),
  )
  return scope
}
