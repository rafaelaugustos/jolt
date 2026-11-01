import { isAndroid, type View } from '@nativescript/core'
import type { Driver as MotionDriver } from '../core/driver.js'
import { createAndroidDriver } from './android.js'
import { createIOSDriver } from './ios.js'

export type { LayoutFrame } from '../core/driver.js'
export type Driver = MotionDriver<View>

export function after(ms: number, callback: () => void) {
  const timer = setTimeout(callback, ms)
  return () => clearTimeout(timer)
}

let driver: Driver | undefined

export function getDriver(): Driver {
  return (driver ??= isAndroid ? createAndroidDriver() : createIOSDriver())
}

export function setDriver(next: Driver | undefined) {
  driver = next
}
