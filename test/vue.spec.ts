import type { NSVElement } from 'nativescript-vue'
import { describe, expect, it, vi } from 'vitest'
import JoltVue, {
  JoltTransition,
  install,
  transitionHooks,
  vAnimate,
  vPress,
  type AnimateValue,
  type PressValue,
} from '../src/vue/index.js'
import { BaseTransition, rendered } from './shims/vue.js'
import { createView, driver, flush } from './helpers.js'

type Hook = (el: NSVElement, done: () => void) => void

function element() {
  const view = createView()
  return { view, el: { nativeView: view } as unknown as NSVElement }
}

function binding<T>(value: T, oldValue: T | null = null) {
  return { value, oldValue, instance: null, modifiers: {}, dir: {} } as never
}

const hook = (fn: unknown) => fn as Hook
const vnode = null as never

describe('v-animate', () => {
  it('plays on mount and keeps an unloaded view at its first keyframe', () => {
    const { view, el } = element()
    view.unload()
    vAnimate.mounted!(el, binding<AnimateValue>('fadeInUp'), vnode, vnode)
    expect(view.opacity).toBe(0)
    expect(driver.played).toHaveLength(0)
    view.load()
    expect(driver.last('opacity').track.to).toBe(1)
    expect(driver.last('y').track.to).toBe(0)
  })

  it('takes a tuple with options', () => {
    const { el } = element()
    vAnimate.mounted!(
      el,
      binding<AnimateValue>([{ opacity: [0, 1] }, { duration: 500, delay: 40 }]),
      vnode,
      vnode,
    )
    expect(driver.last('opacity').track.duration).toBe(500)
    expect(driver.last('opacity').track.delay).toBe(40)
  })

  it('animates again only when the value changes', () => {
    const { el } = element()
    vAnimate.mounted!(el, binding<AnimateValue>({ opacity: 0 }), vnode, vnode)
    vAnimate.updated!(
      el,
      binding<AnimateValue>({ opacity: 0 }, { opacity: 0 }),
      vnode,
      vnode,
    )
    expect(driver.played).toHaveLength(1)
    vAnimate.updated!(
      el,
      binding<AnimateValue>({ opacity: 0.5 }, { opacity: 0 }),
      vnode,
      vnode,
    )
    expect(driver.played).toHaveLength(2)
    expect(driver.last('opacity').track.to).toBe(0.5)
    vAnimate.updated!(el, binding<AnimateValue>('popIn', { opacity: 0.5 }), vnode, vnode)
    expect(driver.last('scaleX').track.to).toBe(1)
  })

  it('stops its animation on unmount', () => {
    const { view, el } = element()
    vAnimate.mounted!(
      el,
      binding<AnimateValue>([{ x: 100 }, { duration: 1000 }]),
      vnode,
      vnode,
    )
    fadeFromAnotherElement(view)
    driver.advance(500)
    vAnimate.unmounted!(el, binding<AnimateValue>({ x: 100 }), vnode, vnode)
    expect(driver.last('x').stopped).toBe(true)
    expect(driver.last('opacity').stopped).toBe(false)
    expect(view.translateX).toBeGreaterThan(0)
    expect(view.translateX).toBeLessThan(100)
  })
})

function fadeFromAnotherElement(view: ReturnType<typeof createView>) {
  return vAnimate.mounted!(
    { nativeView: view } as unknown as NSVElement,
    binding<AnimateValue>([{ opacity: 0 }, { duration: 1000 }]),
    vnode,
    vnode,
  )
}

describe('v-press', () => {
  it('presses with the defaults and removes the effect on unmount', () => {
    const { view, el } = element()
    vPress.mounted!(el, binding<PressValue | undefined>(undefined), vnode, vnode)
    view.touch('down')
    expect(driver.last('scaleX').track.to).toBe(0.96)
    driver.advance(50)
    view.touch('up')
    expect(driver.last('scaleX').track.to).toBe(1)
    vPress.unmounted!(el, binding<PressValue | undefined>(undefined), vnode, vnode)
    expect(view.listenerCount('touch')).toBe(0)
  })

  it('attaches again only when the value changes', () => {
    const { view, el } = element()
    vPress.mounted!(el, binding<PressValue>({ scale: 0.9 }), vnode, vnode)
    vPress.updated!(el, binding<PressValue>({ scale: 0.9 }, { scale: 0.9 }), vnode, vnode)
    expect(view.listenerCount('touch')).toBe(1)
    vPress.updated!(
      el,
      binding<PressValue>([{ scale: 0.8 }, 'bouncy'], { scale: 0.9 }),
      vnode,
      vnode,
    )
    expect(view.listenerCount('touch')).toBe(1)
    view.touch('down')
    expect(driver.last('scaleX').track.to).toBe(0.8)
  })
})

describe('transitionHooks', () => {
  it('releases the enter once the animation finishes', async () => {
    const { el } = element()
    const done = vi.fn()
    hook(transitionHooks({ enter: 'fadeIn' }).onEnter)(el, done)
    expect(driver.last('opacity').track.duration).toBe(300)
    await flush()
    expect(done).not.toHaveBeenCalled()
    driver.advance(300)
    await flush()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('still releases an enter that was cancelled', async () => {
    const { el } = element()
    const done = vi.fn()
    const hooks = transitionHooks({ enter: 'fadeIn' })
    hook(hooks.onEnter)(el, done)
    driver.advance(100)
    ;(hooks.onEnterCancelled as (el: NSVElement) => void)(el)
    expect(driver.last('opacity').stopped).toBe(true)
    await flush()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('keeps the element until the leave animation settles', async () => {
    const { view, el } = element()
    const done = vi.fn()
    const hooks = transitionHooks({ leave: 'fadeOut' })
    hook(hooks.onLeave)(el, done)
    expect(driver.last('opacity').track.to).toBe(0)
    driver.advance(100)
    await flush()
    expect(done).not.toHaveBeenCalled()
    driver.advance(100)
    await flush()
    expect(done).toHaveBeenCalledTimes(1)
    expect(view.opacity).toBe(0)
  })

  it('stops a cancelled leave', async () => {
    const { el } = element()
    const done = vi.fn()
    const hooks = transitionHooks({ leave: [{ x: 50 }, { duration: 400 }] })
    hook(hooks.onLeave)(el, done)
    driver.advance(100)
    ;(hooks.onLeaveCancelled as (el: NSVElement) => void)(el)
    expect(driver.last('x').stopped).toBe(true)
    await flush()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('mirrors the enter hooks for appear', () => {
    const hooks = transitionHooks({ enter: 'popIn', appear: true })
    expect(hooks.onAppear).toBe(hooks.onEnter)
    expect(hooks.onAppearCancelled).toBe(hooks.onEnterCancelled)
    expect(transitionHooks({ enter: 'popIn' }).onAppear).toBeUndefined()
  })

  it('releases a phase without an animation right away', () => {
    const { el } = element()
    const done = vi.fn()
    const hooks = transitionHooks({})
    hook(hooks.onEnter)(el, done)
    hook(hooks.onLeave)(el, done)
    expect(done).toHaveBeenCalledTimes(2)
    expect(driver.played).toHaveLength(0)
  })
})

describe('JoltTransition', () => {
  it('renders BaseTransition with the hooks, mode and slots', () => {
    const component = JoltTransition as unknown as {
      name: string
      props: Record<string, unknown>
      setup(props: unknown, context: unknown): () => unknown
    }
    const slots = { default: () => [] }
    const render = component.setup(
      { enter: 'popIn', leave: 'fadeOut', appear: true, mode: 'out-in' },
      { slots },
    )
    render()
    const vnode = rendered.at(-1)!
    expect(component.name).toBe('JoltTransition')
    expect(Object.keys(component.props)).toEqual(['enter', 'leave', 'appear', 'mode'])
    expect(vnode.type).toBe(BaseTransition)
    expect(vnode.children).toBe(slots)
    expect(vnode.props).toMatchObject({ mode: 'out-in', appear: true })
    expect(typeof vnode.props!.onEnter).toBe('function')
    expect(vnode.props!.onAppear).toBe(vnode.props!.onEnter)
    expect(typeof vnode.props!.onLeave).toBe('function')
  })
})

describe('install', () => {
  it('registers the directives and the component', () => {
    const app = { directive: vi.fn(), component: vi.fn() }
    install(app as never)
    expect(app.directive).toHaveBeenCalledWith('animate', vAnimate)
    expect(app.directive).toHaveBeenCalledWith('press', vPress)
    expect(app.component).toHaveBeenCalledWith('JoltTransition', JoltTransition)
    expect(JoltVue.install).toBe(install)
  })
})
