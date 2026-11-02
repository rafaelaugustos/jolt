import { demo } from './demo.js'
import { createWebRuntime } from '../../src/web/runtime.js'
export const lab = {
  createWebRuntime,
  makePath() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 600 180')
    svg.style.cssText = 'width:600px;height:180px'
    const path = document.createElementNS(svg.namespaceURI, 'path') as SVGPathElement
    path.setAttribute('d', 'M 10 90 C 100 0 200 180 400 90')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#86c5b8')
    path.setAttribute('stroke-width', '6')
    path.setAttribute('stroke-linecap', 'round')
    svg.append(path)
    document.body.append(svg)
    return path
  },
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

const mode = new URLSearchParams(location.search).get('demo')
if (mode) demo(mode)
