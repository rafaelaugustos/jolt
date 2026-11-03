import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const captures = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'motion-recipe-captures.json'), 'utf8'),
)
mkdirSync(resolve(root, 'docs/public/recipes'), { recursive: true })
for (const clip of captures) {
  const source = resolve(root, 'docs/public/media', `${clip.source}.mp4`)
  const output = resolve(root, 'docs/public/media', `${clip.output}.mp4`)
  // Trim existing reviewed simulator footage. Do not retime, synthesize or replace it.
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-ss',
    String(clip.start),
    '-i',
    source,
    '-t',
    String(clip.end - clip.start),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    '-y',
    output,
  ])
  execFileSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-'])
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-ss',
    String(clip.poster),
    '-i',
    output,
    '-frames:v',
    '1',
    '-vf',
    'scale=480:-2',
    '-q:v',
    '3',
    '-y',
    resolve(root, 'docs/public/recipes', `${clip.output}.jpg`),
  ])
  console.log(
    `${clip.output}: native trim ${clip.start}–${clip.end}s, original timing; full decode passed`,
  )
}
