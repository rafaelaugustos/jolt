import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

// Existing composition server on 4337; adb reverse 4337 and forward 9237 to
// chrome_devtools_remote. OS virtual sensors, never dispatchEvent/CDP overrides.
const [serial, output] = process.argv.slice(2)
assert(serial?.startsWith('emulator-') && output)
mkdirSync(output, { recursive: false })
const adb = (...args) =>
  execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8' }).trim()
assert.equal(adb('shell', 'getprop', 'ro.kernel.qemu'), '1')
const browser = await chromium.connectOverCDP('http://127.0.0.1:9237')
try {
  const page = browser
    .contexts()[0]
    .pages()
    .find((page) => page.url().includes(':4337/'))
  assert(page, 'Open the composition sensor fixture in emulator Chrome')
  await page.bringToFront()
  await page.context().grantPermissions(['accelerometer', 'gyroscope'])
  page.on('pageerror', (error) => console.error('Browser error:', error.message))
  await page.reload()
  await page.waitForFunction(() => !!window.composition)
  const initial = await page.evaluate(() => {
    const raw = { count: 0, trusted: true, last: null }
    const listener = (event) => {
      raw.count++
      raw.trusted &&= event.isTrusted
      const vector = (value) => value && { x: value.x, y: value.y, z: value.z }
      raw.last = {
        acceleration: vector(event.acceleration),
        total: vector(event.accelerationIncludingGravity),
        rotation: event.rotationRate && {
          alpha: event.rotationRate.alpha,
          beta: event.rotationRate.beta,
          gamma: event.rotationRate.gamma,
        },
        interval: event.interval,
      }
    }
    window.addEventListener('devicemotion', listener)
    const scope = window.composition.runtime.scope()
    const sensors = [
      'acceleration',
      'linearAcceleration',
      'gyroscope',
      'magneticField',
    ].map((kind) => scope.sensor(kind, { coordinates: 'device' }))
    const off = sensors.map((sensor) => sensor.x.subscribe(() => {}))
    window.platformSensorAudit = { scope, sensors, off, raw, listener }
    const grant = document.createElement('button')
    grant.id = 'audit-grant'
    grant.textContent = 'Enable platform sensor audit'
    grant.addEventListener('click', () => {
      void Promise.all(sensors.map((sensor) => sensor.requestPermission()))
    })
    document.querySelector('#sensor-controls').append(grant)
    return {
      secure: isSecureContext,
      ua: navigator.userAgent,
      initial: sensors.map((s) => s.snapshot()),
    }
  })
  assert(initial.secure, 'Loopback must be a secure browser context')
  console.log('Initial:', JSON.stringify(initial))
  await page.locator('#audit-grant').click()
  const states = []
  const snapshot = async (name) => {
    const result = await page.evaluate(() => ({
      raw: window.platformSensorAudit.raw,
      sensors: window.platformSensorAudit.sensors.map((sensor) => ({
        kind: sensor.kind,
        ...sensor.snapshot(),
      })),
    }))
    states.push({ name, ...result })
    console.log(
      name,
      result.sensors.map((s) => `${s.kind}:${s.status}:${s.samples}`).join(' '),
    )
    return result
  }
  adb('emu', 'sensor', 'set', 'acceleration', '1:2:9.8')
  adb('emu', 'sensor', 'set', 'gyroscope', '0.4:-0.2:0.8')
  try {
    await page.waitForFunction(
      () =>
        window.platformSensorAudit.sensors
          .slice(0, 3)
          .every((s) => s.snapshot().samples > 5),
      null,
      { timeout: 15000 },
    )
  } catch (error) {
    const failed = await snapshot('delivery-failed')
    writeFileSync(
      output + '/failure.json',
      JSON.stringify(
        { initial, failed, error: String(error), physicalHardware: false },
        null,
        2,
      ),
    )
    throw error
  }
  const active = await snapshot('platform-delivery')
  assert(active.raw.count > 5 && active.raw.trusted)
  assert(
    active.sensors
      .slice(0, 3)
      .every((s) => s.backend === 'device-motion' && s.sampleSource === 'device-event'),
  )
  assert.deepEqual(
    active.sensors.map((s) => s.unit),
    ['m/s²', 'm/s²', 'rad/s', 'µT'],
  )
  assert.equal(active.sensors[3].status, 'unavailable')
  assert.equal(active.sensors[3].reason, 'unsupported-kind')
  const epsilon = 0.025
  for (const [index, raw] of [
    [0, active.raw.last.total],
    [1, active.raw.last.acceleration],
  ]) {
    assert(raw)
    active.sensors[index].values.forEach((n, axis) =>
      assert(Math.abs(n - raw[['x', 'y', 'z'][axis]]) < epsilon),
    )
  }
  const rotation = active.raw.last.rotation
  active.sensors[2].values.forEach((n, axis) =>
    assert(
      Math.abs(n - (rotation[['beta', 'gamma', 'alpha'][axis]] * Math.PI) / 180) <
        epsilon,
    ),
  )
  await page.evaluate(() => window.platformSensorAudit.scope.suspend())
  const paused = await snapshot('paused')
  adb('emu', 'sensor', 'set', 'acceleration', '-3:1:8')
  await page.waitForTimeout(400)
  const held = await snapshot('paused-input')
  assert.deepEqual(
    held.sensors.map((s) => s.samples),
    paused.sensors.map((s) => s.samples),
  )
  await page.evaluate(() => window.platformSensorAudit.scope.resume())
  await page.waitForFunction(
    (count) => window.platformSensorAudit.sensors[0].snapshot().samples > count + 3,
    held.sensors[0].samples,
  )
  await snapshot('resumed')
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await page.waitForTimeout(800)
  const hidden = await snapshot('background')
  await page.waitForTimeout(400)
  const hiddenAfter = await snapshot('background-held')
  assert.deepEqual(
    hiddenAfter.sensors.map((s) => s.samples),
    hidden.sensors.map((s) => s.samples),
  )
  adb(
    'shell',
    'am',
    'start',
    '-n',
    'com.android.chrome/com.google.android.apps.chrome.Main',
  )
  await page.bringToFront()
  await page.waitForFunction(
    (count) => window.platformSensorAudit.sensors[0].snapshot().samples > count,
    hidden.sensors[0].samples,
  )
  await snapshot('foreground')
  await page.evaluate(() => {
    const audit = window.platformSensorAudit
    audit.off.forEach((off) => off())
    audit.scope.dispose()
    window.removeEventListener('devicemotion', audit.listener)
  })
  const disposed = await snapshot('disposed')
  assert(disposed.sensors.every((s) => s.status === 'disposed'))
  writeFileSync(
    output + '/acceptance.json',
    JSON.stringify(
      {
        platform: 'Android API 36 emulator, actual Chrome and OS virtual sensors',
        source:
          'platform DeviceMotionEvent, no DOM event injection or CDP sensor overrides',
        physicalHardware: false,
        limitations:
          'Emulator delivery and units/lifecycle only; no physical accuracy, hardware rate, battery or performance claim.',
        initial,
        states,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  adb('emu', 'sensor', 'set', 'acceleration', '0:9.8:0')
  adb('emu', 'sensor', 'set', 'gyroscope', '0:0:0')
  await browser.close()
}
