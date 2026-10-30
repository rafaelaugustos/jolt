import {
  Application,
  Button,
  Color,
  Device,
  File,
  GridLayout,
  isIOS,
  knownFolders,
  Label,
  Page,
} from '@nativescript/core'
import { bind } from '@rafaelaugusto/jolt'
import { sensor, type Sensor } from '@rafaelaugusto/jolt/sensors'

declare const JoltSensorSource: { activeCount(): number; sourceCount(): number }
declare const JoltLiveSpring: { nodeCount(): number; activeCount(): number }
declare const JoltSensorFaultProbe: {
  install(): void
  stopDelivery(): void
  failAccess(): void
}
declare const org: {
  rafaelaugusto: {
    jolt: {
      SensorSource: typeof JoltSensorSource
      LiveSpring: typeof JoltLiveSpring
      fixture: { SensorFaultProbe: { stopDelivery(): void } }
    }
  }
}

/** Explicit diagnostic page: real measurements; controlled failures are labelled. */
export function sensorAcceptancePage(recoveryOnly = false) {
  const page = new Page()
  page.actionBarHidden = true
  page.backgroundColor = new Color('#0B2522')
  const grid = new GridLayout()
  grid.rows = 'auto,*,auto,auto'
  grid.padding = 16
  page.content = grid
  const title = new Label()
  Object.assign(title, {
    fontSize: 16,
    textWrap: true,
    color: '#EDF0D8',
    textAlignment: 'center',
  })
  grid.addChild(title)
  const card = new Label()
  Object.assign(card, {
    text: 'REAL SENSOR INPUT',
    fontSize: 16,
    color: '#20392E',
    backgroundColor: '#DFE8A4',
    borderRadius: 16,
    width: 220,
    height: 90,
    textAlignment: 'center',
    verticalAlignment: 'middle',
    horizontalAlignment: 'center',
  })
  GridLayout.setRow(card, 1)
  grid.addChild(card)
  const detail = new Label()
  Object.assign(detail, {
    fontSize: 11,
    textWrap: true,
    color: '#CCD6C2',
    textAlignment: 'center',
  })
  GridLayout.setRow(detail, 2)
  grid.addChild(detail)
  const button = new Button()
  Object.assign(button, {
    text: 'Capture pose',
    automationText: 'sensor-acceptance-next',
    height: 48,
    backgroundColor: '#DFE8A4',
    color: '#20392E',
    borderRadius: 20,
  })
  GridLayout.setRow(button, 3)
  grid.addChild(button)
  const poses = [
    ['face-up', '1 / 5 · Lay the phone flat, screen facing up.'],
    ['portrait', '2 / 5 · Hold upright in portrait, top edge up.'],
    ['landscape-left', '3 / 5 · Hold upright in landscape, top edge to your left.'],
    ['landscape-right', '4 / 5 · Hold upright in landscape, top edge to your right.'],
    ['portrait-return', '5 / 5 · Return upright to portrait.'],
  ] as const
  const session = Date.now(),
    events: object[] = []
  const sources = new Map<string, Sensor>(),
    releases: (() => void)[] = []
  let index = recoveryOnly ? poses.length : 0,
    busy = false,
    started = false,
    disposed = false
  const native = isIOS ? JoltSensorSource : org.rafaelaugusto.jolt.SensorSource
  const live = isIOS ? JoltLiveSpring : org.rafaelaugusto.jolt.LiveSpring
  const orientation = () => {
    if (!isIOS)
      return (
        (
          Application.android.context.getSystemService(
            'window',
          ) as android.view.WindowManager
        )
          .getDefaultDisplay()
          .getRotation() * 90
      )
    for (const scene of UIApplication.sharedApplication.connectedScenes.allObjects) {
      if (
        scene instanceof UIWindowScene &&
        scene.activationState === UISceneActivationState.ForegroundActive
      )
        return scene.interfaceOrientation === UIInterfaceOrientation.LandscapeLeft
          ? 90
          : scene.interfaceOrientation === UIInterfaceOrientation.LandscapeRight
            ? 270
            : scene.interfaceOrientation === UIInterfaceOrientation.PortraitUpsideDown
              ? 180
              : 0
    }
    return -1
  }
  const path =
    (isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()) +
    '/sensor-acceptance.json'
  const snapshot = (name: string) => {
    const event = {
      name,
      sequence: events.length,
      time: Date.now(),
      orientation: orientation(),
      native: {
        active: native.activeCount(),
        sources: native.sourceCount(),
        nodes: live.nodeCount(),
        clock: live.activeCount(),
      },
      sources: Object.fromEntries(
        [...sources].map(([key, value]) => [key, value.snapshot()]),
      ),
    }
    events.push(event)
    File.fromPath(path).writeTextSync(
      JSON.stringify(
        {
          schemaVersion: 1,
          platform: isIOS ? 'ios' : 'android',
          device: {
            model: Device.model,
            os: Device.osVersion,
            physical: isIOS
              ? !NSProcessInfo.processInfo.environment.objectForKey('SIMULATOR_UDID')
              : !/generic|emulator|sdk_gphone|goldfish|ranchu/.test(
                  android.os.Build.FINGERPRINT +
                    android.os.Build.MODEL +
                    android.os.Build.HARDWARE,
                ),
          },
          session,
          input: 'real-hardware',
          mode: recoveryOnly ? 'recovery-only' : 'manual-poses-and-recovery',
          failureMode: 'demo-only-service-dropout',
          events,
        },
        null,
        2,
      ),
    )
    return event
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const cleanup = () => {
    if (disposed) return
    disposed = true
    releases.splice(0).forEach((release) => release())
    sources.forEach((source) => source.dispose())
    snapshot('disposed')
  }
  page.on('closedModally', cleanup)
  page.on('loaded', () => {
    if (started) return
    started = true
    if (isIOS) JoltSensorFaultProbe.install()
    snapshot('baseline')
    for (const coordinates of ['interface', 'device'] as const)
      for (const kind of ['rotation', 'gravity'] as const) {
        const source = sensor(kind, { coordinates, interval: 16 })
        sources.set(`${kind}-${coordinates}`, source)
        // Each source has actual native binding demand. Only interface rotation
        // changes the visible card; diagnostic consumers preserve the same view.
        const target =
          kind === 'rotation' && coordinates === 'interface' ? card : new Label()
        if (target !== card) {
          target.width = 1
          target.height = 1
          target.opacity = 0
          GridLayout.setRow(target, 1)
          grid.addChild(target)
        }
        releases.push(
          bind(
            target,
            kind === 'rotation'
              ? {
                  rotateX: source.x.to([-1, 1], [-25, 25]),
                  rotateY: source.y.to([-1, 1], [-25, 25]),
                }
              : { x: source.x },
          ),
        )
      }
    title.text = recoveryOnly ? 'Controlled native service-failure check' : poses[0][1]
    detail.text = recoveryOnly
      ? 'Real hardware; test-only delivery interruption and recovery.'
      : 'Hold still for two seconds, then tap Capture pose. Allow screen rotation.'
    if (recoveryOnly) button.text = 'Run recovery checks'
  })
  button.on('tap', async () => {
    if (busy) return
    if (disposed) {
      page.closeModal()
      return
    }
    busy = true
    button.isEnabled = false
    try {
      if (index < poses.length) {
        // Capture at the tap, before the user moves toward the next instruction.
        // Guard against a still-locked interface or a pose that is not ready.
        const g = sources.get('gravity-device')!.snapshot().values
        const axis = index === 0 ? 2 : index === 2 || index === 3 ? 0 : 1
        const sign = index === 3 ? 1 : -1
        const angle = orientation()
        if (
          g[axis]! * sign < 8.5 ||
          g.some((v, i) => i !== axis && Math.abs(v) > 2.5) ||
          (index === 2 || index === 3 ? angle !== 90 && angle !== 270 : angle !== 0)
        ) {
          detail.text =
            'Pose not ready. Follow the instruction above; keep still and allow screen rotation, then capture again.'
          return
        }
        const event = snapshot(poses[index]![0])
        if (Object.values(event.sources).some((s) => s.status !== 'active'))
          throw new Error('A real sensor is not active')
        index++
        detail.text =
          'Hold still for two seconds, then tap Capture pose. Wait for the next instruction before moving.'
        title.text =
          index < poses.length
            ? poses[index]![1]
            : 'Poses captured · controlled service-failure check'
        if (index === poses.length) {
          detail.text =
            'The test stops native delivery, waits for no-data, then retries real hardware. No permissions are changed.'
          button.text = 'Run recovery checks'
        }
      } else {
        title.text = 'Controlled dropout · waiting for watchdog'
        snapshot('before-dropout')
        if (isIOS) JoltSensorFaultProbe.stopDelivery()
        else org.rafaelaugusto.jolt.fixture.SensorFaultProbe.stopDelivery()
        await wait(3800)
        snapshot('no-data')
        await wait(1000)
        snapshot('error-held')
        sources.forEach((source) => source.play())
        await wait(1800)
        snapshot('recovered')
        if (isIOS) {
          JoltSensorFaultProbe.failAccess()
          snapshot('injected-access-failure')
          sources.forEach((source) => source.play())
          await wait(1800)
          snapshot('access-recovered')
        }
        cleanup()
        title.text = 'Captured · native resources released'
        detail.text =
          'The host verifier checks the recorded poses, failure, recovery and cleanup.'
        button.text = 'Close'
      }
    } catch (error) {
      snapshot('failed')
      title.text = 'Audit failed'
      detail.text = String(error)
      cleanup()
      button.text = 'Close'
    } finally {
      busy = false
      button.isEnabled = true
    }
  })
  return page
}
