import type {
  DropMoveEvent,
  DropZones,
  WebMotionScope,
  WebRuntime,
} from '../../src/web/public.js'

export interface BoardMove {
  id: string | undefined
  x: number
  y: number
  width: number
  height: number
}

/** A two-column board: the grip starts the drag, a gap follows the insertion point. */
export function mountBoard(runtime: WebRuntime, scope: WebMotionScope) {
  const el = (id: string) => document.getElementById(id)!
  const status = (text: string) => {
    el('status').textContent = text
  }
  el('title').textContent = 'Drop into order'
  el('description').textContent =
    'Drag the grip. The card body keeps its button and scrolling; columns accept 60 px below their last card.'
  el('stage').innerHTML = `
    <div id="board">
      <section class="column" id="todo" aria-label="Backlog">
        <h2>Backlog</h2>
        <div class="cards" id="todo-cards">
          <article class="card" id="spec">Spec</article>
          <article class="card" id="card">
            <button id="grip" class="grip" aria-label="Move card">⋮⋮</button>
            <div class="body">
              <strong>Launch notes</strong>
              <ul id="notes"><li>Copy</li><li>Assets</li><li>Review</li><li>Ship</li></ul>
              <button id="open">Open · 0</button>
            </div>
          </article>
        </div>
      </section>
      <section class="column" id="done" aria-label="Done">
        <h2>Done</h2>
        <div class="cards" id="done-cards"><article class="card" id="ship">Ship</article></div>
      </section>
      <div class="padding" id="done-padding">+60 px hit padding</div>
      <div class="zone" id="locked">Locked</div>
    </div>`
  status('Ready · drag the grip, or focus it and press ← →')
  el('request').textContent = 'Send to Done'
  const card = el('card'),
    grip = el('grip'),
    columns = { todo: el('todo-cards'), done: el('done-cards') }
  const moves: BoardMove[] = []
  const gap = document.createElement('div')
  gap.className = 'gap'
  gap.id = 'gap'
  let opened = 0,
    insertion: { id: 'todo' | 'done'; before: Element | null } | undefined,
    last: DropMoveEvent<HTMLElement> | undefined
  el('open').onclick = () => {
    el('open').textContent = `Open · ${++opened}`
  }
  const outline = () => {
    const done = el('done')
    el('done-padding').style.top = `${done.offsetTop + done.offsetHeight}px`
  }
  outline()
  const place = (event: DropMoveEvent<HTMLElement>) => {
    const id = event.id === 'todo' || event.id === 'done' ? event.id : undefined
    if (!id) {
      insertion = undefined
      gap.remove()
      outline()
      return
    }
    const center = event.bounds.y + event.bounds.height / 2
    const before =
      [...columns[id].children].find((node) => {
        if (node === card || node === gap) return false
        const rect = node.getBoundingClientRect()
        return rect.y + rect.height / 2 > center
      }) ?? null
    insertion = { id, before }
    if (gap.parentElement !== columns[id] || gap.nextElementSibling !== before)
      columns[id].insertBefore(gap, before)
    outline()
  }
  const settle = (id: 'todo' | 'done', before: Element | null) => {
    const from = last?.bounds ?? card.getBoundingClientRect()
    const matrix = new DOMMatrixReadOnly(getComputedStyle(card).transform)
    columns[id].insertBefore(card, before && before.parentElement ? before : null)
    outline()
    const to = card.getBoundingClientRect()
    runtime.set(card, {
      x: matrix.m41 + from.x - to.x,
      y: matrix.m42 + from.y - to.y,
    })
    return scope.animate(card, { x: 0, y: 0 }, 'snappy')
  }
  const drop: DropZones = scope.dropZones(card, {
    targets: [
      { id: 'todo', target: el('todo'), padding: { bottom: 60 } },
      { id: 'done', target: el('done'), padding: { bottom: 60 } },
      { id: 'locked', target: el('locked'), accept: () => false },
    ],
    drag: { handle: grip, snap: [0] },
    onMove: (event) => {
      last = event
      moves.push({ id: event.id, ...event.bounds })
      if (moves.length > 500) moves.shift()
      place(event)
      status(
        `Moving · over ${event.id ?? 'nothing'} · x ${Math.round(event.bounds.x)} y ${Math.round(event.bounds.y)}`,
      )
    },
    onEnter: ({ target }) => {
      target.dataset.hover = ''
    },
    onLeave: ({ target }) => {
      delete target.dataset.hover
      gap.remove()
      outline()
    },
    onReject: (event) => {
      status(event ? `Rejected by ${event.id} · return spring` : 'No target · returned')
    },
    onDrop: ({ id, method }) => {
      const column = id === 'done' ? 'done' : 'todo'
      const before =
        method === 'drag' && insertion?.id === column ? insertion.before : null
      insertion = undefined
      last = method === 'drag' ? last : undefined
      status(`Dropped in ${column} · ${method}`)
      return settle(column, before)
    },
  })
  grip.addEventListener('keydown', (event) => {
    const id =
      event.key === 'ArrowRight' ? 'done' : event.key === 'ArrowLeft' ? 'todo' : ''
    if (!id) return
    event.preventDefault()
    drop.request(id)
  })
  return {
    drop,
    moves,
    get opened() {
      return opened
    },
    play: () => drop.request('done'),
    pause() {
      if (drop.paused) drop.play()
      else drop.pause()
      el('pause').textContent = drop.paused ? 'Resume' : 'Pause'
      status(drop.paused ? 'Paused · drag cancelled, no move reports' : 'Ready')
    },
  }
}
