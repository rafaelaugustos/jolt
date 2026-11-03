import { createElement, useRef } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, it, expect } from 'vitest'
import { useAnimate, usePress } from '../src/react/index.js'
import { createView, driver } from './helpers.js'

describe('React NativeScript lifecycle hooks', () => {
  it('handles commit-time refs, replacement, removal and remount without retaining old views', () => {
    const views = new Map<string, ReturnType<typeof createView>>()
    const firstValue = { x: 100 },
      nextValue = { x: 180 }
    function Component({
      id,
      show = true,
      value = firstValue,
    }: {
      id: string
      show?: boolean
      value?: { x: number }
    }) {
      const ref = useRef<{ nativeView: ReturnType<typeof createView> }>(null)
      useAnimate(ref, value)
      usePress(ref)
      return show ? createElement('label', { ref, id, key: id }) : null
    }
    const options = {
      createNodeMock(element: { props: { id: string } }) {
        const nativeView = createView()
        views.set(element.props.id, nativeView)
        return { nativeView }
      },
    }
    let root: ReactTestRenderer
    act(() => {
      root = create(createElement(Component, { id: 'first' }), options)
    })
    expect(driver.last('x').track.to).toBe(100)
    const first = views.get('first')!
    act(() => {
      root.update(createElement(Component, { id: 'first', value: nextValue }))
    })
    expect(driver.last('x').track.to).toBe(180)
    act(() => {
      root.update(createElement(Component, { id: 'replacement' }))
    })
    expect(first.listenerCount('loaded')).toBe(0)
    expect(first.listenerCount('unloaded')).toBe(0)
    expect(driver.last('x').view).toBe(views.get('replacement'))
    act(() => {
      root.update(createElement(Component, { id: 'replacement', show: false }))
    })
    expect(views.get('replacement')!.listenerCount('loaded')).toBe(0)
    act(() => {
      root.update(createElement(Component, { id: 'remount' }))
    })
    expect(driver.last('x').view).toBe(views.get('remount'))
    act(() => root.unmount())
    expect(views.get('remount')!.listenerCount('loaded')).toBe(0)
    expect(driver.played.every((p) => p.stopped)).toBe(true)
  })
})
