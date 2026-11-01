import { Surface, type Handle, type Property } from './surface.js'
import type { Transition } from '../../src/core/transition.js'

const matrixOf = (element: HTMLElement) => {
  const m = new DOMMatrix(getComputedStyle(element).transform)
  return { a: m.a, b: m.b, c: m.c, d: m.d, x: m.e, y: m.f }
}
const testTarget = document.querySelector<HTMLElement>('#test-target')!
let testSurface: Surface | undefined
const handles = new Map<string, Handle>()

const proof = {
  reset(css = '') {
    testSurface?.dispose()
    testTarget.style.cssText = css
    testTarget.className = ''
    testSurface = new Surface(testTarget)
    handles.clear()
  },
  animate(
    id: string,
    property: Property,
    to: number,
    transition: Transition = { type: 'spring', duration: 650, bounce: 0.2 },
    layer = 'base',
  ) {
    handles.set(id, testSurface!.animate(property, to, transition, layer))
    return handles.get(id)!.read()
  },
  command(id: string, command: 'pause' | 'play' | 'stop' | 'seek' | 'late', time = 0) {
    const handle = handles.get(id)!
    if (command === 'seek') handle.seek(time)
    else if (command === 'late') handle.deliverLateCompletion()
    else handle[command]()
  },
  read(id: string) {
    return handles.get(id)!.read()
  },
  model() {
    return testSurface!.read()
  },
  presented() {
    return matrixOf(testTarget)
  },
  finished(id: string) {
    return handles.get(id)!.finished
  },
  dispose() {
    testSurface?.dispose()
  },
  target: testTarget,
  recreate() {
    testSurface!.dispose()
    testSurface = new Surface(testTarget)
  },
  candidates() {
    const target = document.createElement('div')
    Object.assign(target.style, {
      position: 'absolute',
      width: '100px',
      height: '100px',
      transformOrigin: '0 0',
    })
    document.body.append(target)
    const animations: Animation[] = []
    const play = (frames: Keyframe[], composite: CompositeOperation = 'replace') => {
      const animation = target.animate(frames, {
        duration: 1000,
        fill: 'both',
        composite,
      })
      animation.pause()
      animation.currentTime = 500
      animations.push(animation)
    }
    const clear = () => {
      for (const animation of animations.splice(0)) animation.cancel()
    }
    play([{ translate: '0px 0px' }, { translate: '100px 0px' }])
    play([{ translate: '0px 0px' }, { translate: '0px 50px' }])
    const individual = getComputedStyle(target).translate
    clear()
    play([{ transform: 'translateX(0px)' }, { transform: 'translateX(100px)' }], 'add')
    play([{ transform: 'rotate(90deg)' }, { transform: 'rotate(90deg)' }], 'add')
    const translateThenRotate = matrixOf(target)
    clear()
    play([{ transform: 'rotate(90deg)' }, { transform: 'rotate(90deg)' }], 'add')
    play([{ transform: 'translateX(0px)' }, { transform: 'translateX(100px)' }], 'add')
    const rotateThenTranslate = matrixOf(target)
    clear()
    play([{ scale: '1.1' }, { scale: '1.1' }])
    play([{ scale: '0.96' }, { scale: '0.96' }], 'add')
    const additiveIndividualScale = getComputedStyle(target).scale
    clear()
    target.remove()
    return {
      individual,
      translateThenRotate,
      rotateThenTranslate,
      additiveIndividualScale,
    }
  },
}
declare global {
  interface Window {
    proof: typeof proof
  }
}
window.proof = proof

let card: Surface
let appScale = 1
let pressFactor = 1
const element = document.querySelector<HTMLElement>('#card')!
const status = document.querySelector<HTMLElement>('#status')!
const spring: Transition = { type: 'spring', duration: 650, bounce: 0.15 }
const scale = (value: number, layer = 'base') => {
  card.animate('scaleX', value, spring, layer)
  card.animate('scaleY', value, spring, layer)
}
const reset = () => {
  card?.dispose()
  card = new Surface(element)
  appScale = 1
  pressFactor = 1
  status.textContent = 'Ready. Each channel can be interrupted independently.'
}
const actions: Record<string, () => void> = {
  move: () => {
    card.animate('x', 250, { type: 'spring', duration: 1600, bounce: 0.2 })
    card.animate('y', 80, { type: 'spring', duration: 2400, bounce: 0.1 })
    status.textContent = 'x and y are moving on independent timelines.'
  },
  retarget: () => {
    card.animate('x', 40, spring)
    status.textContent = 'Only x changed direction. y keeps its original motion.'
  },
  scale: () => {
    scale(1.1)
    appScale = 1.1
    status.textContent = 'The application owns a base scale of 1.1.'
  },
  hold: () => {
    scale(0.96, 'press')
    pressFactor = 0.96
    status.textContent = `Settled target: ${appScale} × 0.96 = ${Number((appScale * pressFactor).toFixed(3))}.`
  },
  grow: () => {
    scale(1.2)
    appScale = 1.2
    status.textContent = `The base changes: 1.2 × ${pressFactor} = ${Number((appScale * pressFactor).toFixed(3))}.`
  },
  release: () => {
    scale(1, 'press')
    pressFactor = 1
    status.textContent = `Release removes only the press contribution. Base scale stays ${appScale}.`
  },
  reset,
}
for (const [id, action] of Object.entries(actions))
  document.getElementById(id)!.addEventListener('click', action)
reset()
