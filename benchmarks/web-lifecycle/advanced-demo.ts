import type { LifecycleLab } from './fixture.js'
import { interactionRecipes } from './recipes.js'

export function advancedDemo(
  lab: LifecycleLab,
  mode: string,
  control: (id: string, label: string, action: () => void) => void,
) {
  const title = document.querySelector('h1')!,
    description = document.querySelector('#description')!,
    status = document.querySelector('#status')!
  lab.scroller.style.display = 'none'
  lab.sibling.style.display = 'none'
  lab.region.style.display = 'none'
  if (mode === 'recipes') {
    title.textContent = 'Three complete interactions'
    description.textContent =
      'Drag and return, expand real content, and reorder stable items. One scope owns their resources.'
    const scope = interactionRecipes(lab.rt, document.querySelector('#app')!)
    control('dispose', 'Dispose interactions', () => {
      scope.dispose()
      status.textContent = 'Interaction resources disposed; application content stays.'
    })
    control('reduced', 'Reduce motion', () => {
      lab.rt.configure({ reducedMotion: 'always' })
      status.textContent = 'Reduced motion: destinations settle immediately.'
    })
  } else if (mode === 'overlay') {
    title.textContent = 'A sheet inside a moving card'
    description.textContent =
      'The card moves behind the modal. Drag, choose an option, reopen, and dismiss with Escape.'
    lab.region.style.display = 'grid'
    lab.region.style.width = '460px'
    lab.region.style.height = '280px'
    lab.target.textContent = 'Card'
    lab.rt.animate(
      lab.region,
      { x: [0, 50, 0], rotate: [0, 6, 0] },
      { duration: 2800, repeat: 20 },
    )
    const dialog = document.createElement('dialog')
    dialog.setAttribute('aria-label', 'Select a destination')
    dialog.style.cssText =
      'width:430px;padding:28px;background:#1c2c43;color:#e7edf8;border:1px solid #567094;border-radius:20px;'
    dialog.innerHTML =
      '<h2>Select a destination</h2><p>Drag the panel. The animated card does not change its coordinates.</p><div id="overlay-sheet" style="height:130px;display:grid;place-items:center;background:#86c5b8;color:#17243a;border-radius:16px;margin:20px 0">Drag to explore</div><button id="overlay-choice">Choose Porto</button> <button id="overlay-close">Close</button>'
    lab.region.append(dialog)
    let owner: ReturnType<typeof lab.rt.scope> | undefined
    const open = () => {
      dialog.showModal()
      owner = lab.rt.scope()
      owner.drag(dialog.querySelector<HTMLElement>('#overlay-sheet')!, {
        axis: 'y',
        bounds: { top: 0, bottom: 90 },
        snap: { y: [0] },
      })
      status.textContent = 'Modal open: the browser owns focus and dismissal.'
    }
    dialog.addEventListener('close', () => {
      owner?.dispose()
      owner = undefined
    })
    dialog.querySelector('#overlay-choice')!.addEventListener('click', () => {
      dialog.close()
      status.textContent = 'Porto selected. The application owns this decision.'
    })
    dialog
      .querySelector('#overlay-close')!
      .addEventListener('click', () => dialog.close())
    control('open-overlay', 'Open Select / Sheet', open)
  } else if (mode === 'shared') {
    title.textContent = 'One identity, two places'
    description.textContent =
      'Card → detail and thumbnail → viewer, with reversal, cancellation and an explicit missing-target result.'
    const root = document.querySelector<HTMLElement>('#app')!
    root.style.cssText = 'position:relative;width:740px;height:360px;'
    const make = (large: boolean, photo: boolean) => {
      const node = document.createElement('div')
      node.style.cssText = `position:absolute;left:${large ? 300 : 20}px;top:${large ? 20 : 70}px;width:${large ? 390 : 140}px;height:${large ? 280 : 150}px;padding:22px;background:${photo ? '#365f69' : '#d7a65e'};color:${photo ? '#fff' : '#17243a'};border-radius:${large ? 28 : 18}px;box-sizing:border-box;`
      if (photo) {
        const image = document.createElement('img')
        image.alt = 'Geometric landscape'
        image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px'
        image.src =
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350"><rect width="500" height="350" fill="#b9d5d0"/><circle cx="360" cy="80" r="44" fill="#e8ba69"/><path d="M0 300 170 80 350 350H0" fill="#416d69"/><path d="m180 350 160-190 160 190" fill="#22464d"/></svg>',
          )
        node.append(image)
      } else
        node.innerHTML = `<strong style="font-size:${large ? 28 : 18}px">${large ? 'A closer look' : 'Open a card'}</strong><p>${large ? 'The application decides what to show. Jolt carries the visual identity into the new layout.' : 'One shared identity.'}</p>`
      return node
    }
    let large = false,
      photo = false,
      current = make(false, false)
    root.append(current)
    const shared = lab.rt.sharedLayout(root, {
      transition: { duration: 900, ease: 'easeInOut' },
      layoutTimeout: 250,
    })
    shared.attach(current, 'content')
    const move = (next: boolean, image = photo, missing = false) => {
      large = next
      photo = image
      const flight = shared.transition(() => {
        current.remove()
        current = make(next, image)
        if (!missing) {
          root.append(current)
          shared.attach(current, 'content')
        }
      })
      status.textContent = 'Shared transition in progress.'
      void flight.finished.then((result) => {
        status.textContent = `${result.status}${result.reason ? ': ' + result.reason : ''}`
      })
    }
    control('shared-card', 'Card / detail', () => move(!large, false))
    control('shared-photo', 'Thumbnail / viewer', () => move(!large, true))
    control('shared-back', 'Reverse', () => move(!large))
    control('shared-cancel', 'Cancel', () => shared.cancel())
    control('shared-missing', 'Missing target', () => move(true, photo, true))
  } else if (mode === 'diagnostics') {
    title.textContent = 'Explain ownership and cleanup'
    description.textContent =
      'Inspect on demand: owner IDs, channel takeover and remaining resources. No polling loop.'
    lab.region.style.display = 'grid'
    const diagnostics = lab.rt.diagnostics({ development: true, maxEvents: 12 })
    const scope = lab.rt.scope()
    const report = document.createElement('pre')
    report.style.cssText =
      'font:13px/1.45 ui-monospace,monospace;color:#bdcadb;white-space:pre-wrap;'
    document.querySelector('#app')!.append(report)
    const inspect = () => {
      const snapshot = diagnostics.snapshot()
      report.textContent =
        `Active: ${snapshot.resources.animations} animations · ${snapshot.resources.scopes} scopes · ${snapshot.resources.values} values\n` +
        snapshot.events
          .slice(-8)
          .map(
            (event) =>
              `${event.reason.padEnd(12)} ${event.property ?? 'lifecycle'} ${event.owner ? 'owner ' + event.owner : ''}`,
          )
          .join('\n')
    }
    control('diagnostic-start', 'Start x + y', () => {
      scope.animate(lab.target, { x: 80, y: 35 }, { duration: 3000 })
      inspect()
    })
    control('diagnostic-replace', 'Replace x', () => {
      scope.animate(lab.target, { x: -70 }, { duration: 2000 })
      inspect()
    })
    control('diagnostic-inspect', 'Inspect', inspect)
    control('diagnostic-dispose', 'Dispose screen', () => {
      scope.dispose()
      lab.rt.release(lab.target)
      inspect()
      status.textContent = 'No owned animations or scoped values remain.'
    })
    inspect()
  }
}
