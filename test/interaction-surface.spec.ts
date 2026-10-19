import { describe, expect, it } from 'vitest'
import { interactionSurface, motionScope } from '../src/index.js'
import { hasInteractionSurface } from '../src/interaction-surface.js'
import { createView } from './helpers.js'

describe('interaction surfaces', () => {
  it('opts in a subtree without changing view or accessibility properties', () => {
    const root = createView(),
      child = createView(),
      other = createView()
    child.parent = root
    child.translateX = 40
    child.isEnabled = false
    const surface = interactionSurface({ nativeView: root })
    expect(hasInteractionSurface(root)).toBe(true)
    expect(hasInteractionSurface(child)).toBe(true)
    expect(hasInteractionSurface(other)).toBe(false)
    expect(child.translateX).toBe(40)
    expect(child.isEnabled).toBe(false)
    surface.dispose()
    surface.dispose()
    expect(surface.disposed).toBe(true)
    expect(hasInteractionSurface(child)).toBe(false)
  })
  it('preserves overlapping registrations and follows reparenting', () => {
    const root = createView(),
      child = createView(),
      other = createView()
    child.parent = root
    const first = interactionSurface(root),
      second = interactionSurface(root),
      nested = interactionSurface(child)
    first.dispose()
    expect(hasInteractionSurface(root)).toBe(true)
    child.parent = other
    expect(hasInteractionSurface(child)).toBe(true)
    nested.dispose()
    expect(hasInteractionSurface(child)).toBe(false)
    second.dispose()
    expect(hasInteractionSurface(root)).toBe(false)
  })
  it('can be detached and recreated by scope suspension without owning animations', () => {
    const root = createView(),
      scope = motionScope()
    scope.use(() => interactionSurface(root))
    expect(hasInteractionSurface(root)).toBe(true)
    scope.suspend()
    expect(hasInteractionSurface(root)).toBe(false)
    scope.resume()
    expect(hasInteractionSurface(root)).toBe(true)
    scope.dispose()
    expect(hasInteractionSurface(root)).toBe(false)
  })
})
