import { origin, prefix } from '../media.json'

export function videoUrl(name: string) {
  return `${origin}/${prefix}${name}.mp4`
}
