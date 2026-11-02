import { mountDemo } from './demo.js'
import { createWebRuntime } from '../../src/web/runtime.js'
export const lab = {
  createWebRuntime,
  makeTarget() {
    const target = document.createElement('button')
    target.className = 'test-target'
    target.textContent = 'Motion'
    document.querySelector('#stage')!.append(target)
    return target
  },
}
Object.assign(window, { lab })
declare global {
  var lab: typeof import('./fixture.js').lab
  var rt: ReturnType<typeof createWebRuntime>
  var target: HTMLElement
}

mountDemo(new URLSearchParams(location.search).get('demo') ?? '')
