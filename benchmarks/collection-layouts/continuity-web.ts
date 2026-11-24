import {
  type createWebRuntime,
  listTransferOptions,
  listTransferScroll,
} from '../../src/web/public.js'

export function collectionContinuity(
  mode: string,
  runtime: ReturnType<typeof createWebRuntime>,
  host: HTMLElement,
  status: HTMLOutputElement,
) {
  if (mode === 'GridSheet') {
    host.innerHTML =
      '<section id="sheet"><header id="grip">Featured cards · drag to explore</header><div id="sheet-grid"></div></section>'
    const panel = host.querySelector<HTMLElement>('#sheet')!,
      grip = host.querySelector<HTMLElement>('#grip')!,
      grid = host.querySelector<HTMLElement>('#sheet-grid')!
    for (let i = 0; i < 100; i++) {
      const cell = document.createElement('div')
      cell.className = 'card'
      cell.textContent = 'Card ' + String(i + 1).padStart(2, '0')
      grid.append(cell)
    }
    const min = 135,
      max = 300
    const sheet = runtime.bottomSheet(panel, {
      host,
      handle: grip,
      scrollView: grid,
      snap: [min, max],
      keyboard: 'none',
      dismissible: false,
    })
    sheet.open(min)
    status.value = 'Expand the sheet, then scroll its grid'
    return () => ({ height: sheet.visibleHeight, offset: grid.scrollTop, min, max })
  }
  host.innerHTML =
    '<section class="origin"><div id="atlas" class="card">Atlas</div></section><section id="destination"></section>'
  const card = host.querySelector<HTMLElement>('#atlas')!,
    target = host.querySelector<HTMLElement>('#destination')!
  const source = ['Atlas'],
    keys = Array.from({ length: 48 }, (_, i) => 'Task ' + String(i + 1).padStart(2, '0'))
  const tiles = keys.map((key) => {
    const tile = document.createElement('div')
    tile.className = 'card'
    tile.textContent = key
    target.append(tile)
    return tile
  })
  let commits = 0,
    index = -1,
    slot = -1
  const owner = runtime.dropZones(card, {
    drag: { snap: [0] },
    ...listTransferOptions<HTMLElement, string>({
      key: 'Atlas',
      target,
      sourceKeys: () => source,
      targetKeys: () => keys,
      edgeScroll: listTransferScroll(target),
      centers: () =>
        tiles.map((tile, i) => {
          const r = tile.getBoundingClientRect()
          return { key: keys[i]!, center: r.top + r.height / 2 }
        }),
      preview(move) {
        tiles[slot]?.classList.remove('slot')
        slot = move?.toIndex ?? -1
        tiles[slot]?.classList.add('slot')
        if (move) status.value = 'Insert Atlas at position ' + (slot + 1)
      },
      commit(move) {
        index = move.toIndex
        keys.splice(index, 0, source.shift()!)
        commits++
        queueMicrotask(() => {
          owner.dispose()
          runtime.release(card)
          target.insertBefore(card, tiles[index] ?? null)
          status.value = 'Moved Atlas to position ' + (index + 1)
        })
      },
    }),
  })
  const button = document.createElement('button')
  button.textContent = 'Cancel'
  button.onclick = () => owner.cancel()
  document.querySelector('nav')!.append(button)
  status.value = 'Hold Atlas at the lower edge of the destination'
  return () => ({ commits, index, slot, offset: target.scrollTop })
}
