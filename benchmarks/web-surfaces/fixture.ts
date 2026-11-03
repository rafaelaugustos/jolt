import { createWebRuntime } from '../../src/web/public.js'
import type {
  WebParticles,
  WebBlur,
  WebShape,
  WebLiquid,
  WebImageEffect,
  WebAnimation,
} from '../../src/web/public.js'

const runtime = createWebRuntime(document)
const surface = document.querySelector<HTMLElement>('#surface')!
const photo = document.querySelector<HTMLImageElement>('#photo')!
const content = document.querySelector<HTMLElement>('#content')!
const status = document.querySelector<HTMLElement>('#status')!
const inside = document.querySelector<HTMLButtonElement>('#inside')!
let clicks = 0
inside.onclick = () => {
  clicks++
  inside.textContent = `Still interactive · ${clicks}`
}
function artwork(alternate = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 400
  const c = canvas.getContext('2d')!
  c.fillStyle = alternate ? '#d2ee8d' : '#76d6ed'
  c.fillRect(0, 0, 480, 400)
  for (let y = 0; y < 400; y += 32)
    for (let x = 0; x < 480; x += 32) {
      c.fillStyle =
        (x + y) % 64
          ? alternate
            ? '#a1d36a'
            : '#3396c5'
          : alternate
            ? '#e0edb0'
            : '#94dbea'
      c.fillRect(x, y, 31, 31)
    }
  c.fillStyle = alternate ? '#4c458e' : '#f1b44e'
  c.beginPath()
  c.arc(250, 160, 100, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = alternate ? '#284e3c' : '#242e65'
  c.beginPath()
  c.moveTo(0, 400)
  c.lineTo(160, 160)
  c.lineTo(310, 400)
  c.fill()
  c.fillStyle = alternate ? '#e5858a' : '#ed668c'
  c.beginPath()
  c.moveTo(160, 400)
  c.lineTo(350, 140)
  c.lineTo(480, 400)
  c.fill()
  return canvas.toDataURL()
}
const first = artwork(),
  second = artwork(true)
const destination = new Image()
destination.src = second
photo.src = first
let scope = runtime.scope()
let owner: WebParticles | WebBlur | WebShape | WebLiquid | WebImageEffect | undefined
let playback: WebAnimation | undefined
let mode = 'particles',
  alternate = false,
  reduced = false
const paths = ['M20 30 L80 30 L80 90 L20 90 Z', 'M50 8 L96 60 L50 112 L4 60 Z']
const descriptions: Record<string, string> = {
  particles:
    'Continuous particles · resize-safe emitters, gravity and transparent input.',
  confetti:
    'Confetti · a viewport burst escapes the clipped scene and expires automatically.',
  blur: 'Blur · retarget from the displayed intensity; restore the original surface on disposal.',
  shape: 'Shape · real SVG fill and stroke, path morphing and independent stroke trim.',
  liquid: 'Liquid · internal image pixels deform while the image boundary stays fixed.',
  image:
    'Image effects · ripple, deterministic dissolve and pointer distortion. Drag the image after selecting alternate twice.',
}
let imageMode = 0
function reset(next = mode) {
  scope.dispose()
  runtime.configure({ reducedMotion: 'never' })
  reduced = false
  scope = runtime.scope()
  owner = undefined
  playback = undefined
  alternate = false
  imageMode = 0
  mode = next
  photo.src = first
  photo.hidden = !['image', 'liquid'].includes(mode)
  content.hidden = ['image', 'liquid', 'shape'].includes(mode)
  surface.style.filter = ''
  photo.style.filter = ''
  document.querySelector('#description')!.textContent = descriptions[mode]!
  for (const button of document.querySelectorAll<HTMLElement>('[data-mode]'))
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
  status.textContent = 'Ready · original surface'
}
function start() {
  if (scope.disposed) scope = runtime.scope()
  if (mode === 'particles')
    owner = scope.particles(surface, {
      source: 'bottom',
      shape: alternate ? 'ring' : 'circle',
      colors: ['#c4a9ff', '#67e8f9', '#fff0a3'],
      rate: 45,
      size: alternate ? 18 : 7,
      lifetime: 2800,
      velocity: 100,
      spread: 60,
    })
  if (mode === 'confetti') owner = scope.confetti(inside, { count: 110 })
  if (mode === 'blur') {
    if (!owner || owner.disposed) owner = scope.blur(surface)
    playback = (owner as WebBlur).animate(alternate ? 0 : 0.8, {
      duration: 1800,
      ease: 'linear',
    })
  }
  if (mode === 'shape') {
    if (!owner || owner.disposed)
      owner = scope.shape(surface, {
        d: paths[0]!,
        viewBox: [0, 0, 100, 120],
        fill: '#6848a8',
        stroke: '#b9fff1',
        strokeWidth: 3,
      })
    playback = (owner as WebShape).animate(
      { d: paths[alternate ? 0 : 1]!, strokeEnd: alternate ? 1 : 0.72 },
      { duration: 1800, ease: 'linear' },
    )
  }
  if (mode === 'liquid') owner = scope.liquid(photo, { intensity: 1, duration: 4000 })
  if (mode === 'image') {
    const effect = ['ripple', 'dissolve', 'distortion'][imageMode % 3] as
      'ripple' | 'dissolve' | 'distortion'
    owner = scope.imageEffect(photo, effect, {
      amplitude: 50,
      radius: 160,
      duration: 2200,
      ...(effect === 'dissolve' ? { to: destination } : {}),
    })
    playback = owner
  }
  status.textContent = `Running · ${mode}${mode === 'image' ? ' / ' + ['ripple', 'dissolve', 'distortion'][imageMode % 3] : ''}`
}
for (const button of document.querySelectorAll<HTMLElement>('[data-mode]'))
  button.onclick = () => reset(button.dataset.mode!)
document.querySelector<HTMLButtonElement>('#action')!.onclick = start
document.querySelector<HTMLButtonElement>('#pause')!.onclick = () => {
  scope.suspend()
  status.textContent = 'Paused · current presentation held'
}
document.querySelector<HTMLButtonElement>('#play')!.onclick = () => {
  scope.resume()
  status.textContent = 'Resumed · same scope'
}
document.querySelector<HTMLButtonElement>('#reverse')!.onclick = () => {
  alternate = !alternate
  imageMode++
  start()
}
document.querySelector<HTMLButtonElement>('#reduced')!.onclick = () => {
  reduced = !reduced
  runtime.configure({ reducedMotion: reduced ? 'always' : 'never' })
  status.textContent = reduced ? 'Reduced motion · content preserved' : 'Motion enabled'
}
document.querySelector<HTMLButtonElement>('#dispose')!.onclick = () => {
  scope.dispose()
  status.textContent = 'Disposed · owned layers and listeners removed'
}
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => reset()
export const fixture = {
  createRuntime: createWebRuntime,
  runtime,
  surface,
  photo,
  destination,
  content,
  inside,
  first,
  second,
  paths,
  start,
  reset,
  get owner() {
    return owner
  },
  get playback() {
    return playback
  },
  get scope() {
    return scope
  },
}
declare global {
  interface Window {
    surfaces: typeof fixture
    ready: Promise<void>
  }
}
window.surfaces = fixture
window.ready = Promise.all([photo.decode(), destination.decode()]).then(() => reset())
