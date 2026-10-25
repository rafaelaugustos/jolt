import type { Frame } from '@nativescript/core'
import type { SharedNavigation } from './index.js'
export const navigationScopes = new WeakMap<Frame, SharedNavigation>()
