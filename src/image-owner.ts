import type { Image } from '@nativescript/core'

/** Rendering effects share one image surface; ordinary view transforms stay independent. */
const owners = new WeakMap<Image, () => void>()

export function ownImage(image: Image, stop: () => void): () => void {
  owners.get(image)?.()
  owners.set(image, stop)
  return () => {
    if (owners.get(image) === stop) owners.delete(image)
  }
}
