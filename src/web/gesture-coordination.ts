import { ownStyle } from './interaction.js'
/** Related nested controllers share one capture owner, so siblings cannot steal each other's contact. */
const captures = new WeakMap<Document, Map<number, number>>()
export function coordinatedCapture(document: Document, id: number) {
  let owners = captures.get(document)
  if (!owners) {
    owners = new Map()
    captures.set(document, owners)
  }
  const count = owners.get(id) ?? 0
  if (!count) document.documentElement.setPointerCapture(id)
  owners.set(id, count + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    const next = (owners!.get(id) ?? 1) - 1
    if (next) owners!.set(id, next)
    else {
      owners!.delete(id)
      if (document.documentElement.hasPointerCapture(id))
        document.documentElement.releasePointerCapture(id)
    }
  }
}

const touchOwners = new WeakMap<HTMLElement, { count: number; restore(): void }>()
/** Browser scrolling must be decided before contact; related Jolt surfaces own the contact. */
export function coordinateTouch(target: HTMLElement) {
  let owner = touchOwners.get(target)
  if (!owner) {
    owner = { count: 0, restore: ownStyle(target, 'touch-action', 'none') }
    touchOwners.set(target, owner)
  }
  owner.count++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--owner!.count === 0) {
      owner!.restore()
      touchOwners.delete(target)
    }
  }
}
