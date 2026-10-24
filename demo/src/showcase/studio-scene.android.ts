import { View } from '@nativescript/core'
export class StudioScene extends View {}
export function studioEnvironment(_warm = false): never {
  throw new Error('The automotive studio is available on iOS.')
}
