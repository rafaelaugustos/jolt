import type { LifecycleLab } from './fixture.js'
import { advancedDemo } from './advanced-demo.js'

export function demo(lab: LifecycleLab) {
  const mode = new URLSearchParams(location.search).get('demo')!
  const title = document.querySelector('h1')!,
    description = document.querySelector('#description')!,
    status = document.querySelector('#status')!
  const control = (id: string, label: string, click: () => void) => {
    const button = document.createElement('button')
    button.id = id
    button.textContent = label
    button.addEventListener('click', click)
    document.querySelector('#controls')!.append(button)
  }
  if (['overlay', 'shared', 'recipes', 'diagnostics'].includes(mode)) {
    advancedDemo(lab, mode, control)
    return
  }
  lab.scroller.style.display = mode === 'viewport' ? 'block' : 'none'
  lab.region.style.display = mode === 'vue' || mode === 'viewport' ? 'none' : 'grid'
  lab.sibling.style.display = mode === 'scopes' ? 'inline-block' : 'none'
  if (mode === 'pointer') {
    title.textContent = 'Follow, press, pulse'
    description.textContent =
      'Move inside the region. The button follows with a spring; press and pulse keep their own motion.'
    const scope = lab.rt.scope()
    const pointer = scope.pointerFollow(lab.region, {
      range: { x: [-90, 90], y: [-45, 45] },
      spring: { stiffness: 150, damping: 18 },
    })
    scope.bind(lab.target, { x: pointer.x, y: pointer.y })
    scope.press(lab.target)
    lab.target.textContent = 'Press'
    lab.target.addEventListener('click', () => scope.animate(lab.target, 'pulse'))
    control('reduced', 'Reduce motion', () => {
      lab.rt.configure({ reducedMotion: 'always' })
      status.textContent =
        'Pointer following settles at rest. Press and clicks stay available.'
    })
    control('restore', 'Restore motion', () => {
      lab.rt.configure({ reducedMotion: 'never' })
      status.textContent = 'Move again: old pointer input is not replayed.'
    })
    control('dispose', 'Dispose', () => {
      scope.dispose()
      status.textContent = 'Disposed: input, values, springs and bindings released.'
    })
  } else if (mode === 'viewport') {
    title.textContent = 'Enter when visible'
    description.textContent =
      'Scroll the cards into view. Their stable order sets the stagger; scrolling out cancels pending entrances.'
    lab.scroller.style.height = '330px'
    lab.scroller.style.width = '600px'
    lab.rt.viewportEnter(lab.cards, {
      root: lab.scroller,
      once: false,
      keyframes: { y: [36, 0], opacity: [0, 1] },
      transition: { duration: 650, stagger: 130 },
    })
    control('remove', 'Remove last card', () => {
      lab.cards[2]!.remove()
      status.textContent =
        'Removed card: its observation and queued playback are cancelled.'
    })
    control('reduced', 'Reduce motion', () => {
      lab.rt.configure({ reducedMotion: 'always' })
      status.textContent = 'Content remains readable without decorative entrances.'
    })
  } else if (mode === 'scopes') {
    title.textContent = 'One runtime, independent owners'
    description.textContent =
      'Retarget both springs, remove one interaction, and keep using the other.'
    const first = lab.rt.scope(),
      second = lab.rt.scope()
    const a = first.motionValue(0),
      b = second.motionValue(0)
    first.bind(lab.target, { x: first.springValue(a) })
    second.bind(lab.sibling, { x: second.springValue(b) })
    lab.rt.press(lab.target)
    lab.target.textContent = 'Press'
    let removed = false
    control('retarget', 'Retarget both', () => {
      if (!removed) a.set(a.get() ? 0 : 90)
      b.set(b.get() ? 0 : 150)
      status.textContent = removed
        ? 'The remaining owner continues. Host press is still independent.'
        : 'Both owners share one scheduler.'
    })
    control('remove', 'Dispose first owner', () => {
      first.dispose()
      removed = true
      status.textContent =
        'First owner disposed. The shared runtime and second spring remain alive.'
    })
    control('suspend', 'Suspend second', () => {
      second.suspend()
      status.textContent =
        'Second spring paused; its binding is released at the current position.'
    })
  } else {
    title.textContent = 'Vue: keep, replace, clean up'
    description.textContent =
      'Retarget a spring, pulse the button, then deactivate or replace its ref. Vue renders do not drive the frames.'
    lab.vue = lab.mountVue()
    control('unmount', 'Unmount', () => {
      lab.vue!.unmount()
      status.textContent =
        'Unmounted: continuous resources, observers and owned runtime released.'
    })
  }
}
