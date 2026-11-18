import { readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '../..'),
  results = resolve(import.meta.dirname, 'results'),
  output = resolve(root, '.local/media')
mkdirSync(output, { recursive: true })
const files = readdirSync(results)
const clip = (prefix) => {
  const directory = files.find(
    (name) => name.startsWith(prefix) && name.endsWith('-chromium'),
  )
  if (!directory) throw new Error(`Missing successful Chromium recording: ${prefix}`)
  return resolve(results, directory, 'video.webm')
}
const scenes = [
  'contracts-inner-',
  'contracts-outer-',
  'contracts-carousel-',
  'contracts-trusted-',
  'contracts-photo-',
].map(clip)
const concat = resolve(output, 'gesture-relations-web-sources.txt')
writeFileSync(
  concat,
  scenes.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n'),
)
const encode = [
  '-an',
  '-vf',
  'fps=30',
  '-c:v',
  'libx264',
  '-crf',
  '20',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
]
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-v',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concat,
    ...encode,
    resolve(output, 'gesture-relations-web.mp4'),
  ],
  { stdio: 'inherit' },
)
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-v',
    'error',
    '-i',
    clip('contracts-paused-'),
    ...encode,
    resolve(output, 'spring-velocity-web.mp4'),
  ],
  { stdio: 'inherit' },
)
console.log(
  'Saved real Chromium input recordings; separate gesture scenarios joined at their original playback speed.',
)
