import {
  Application,
  Color,
  GridLayout,
  knownFolders,
  Label,
  Page,
} from '@nativescript/core'
import { animate, configure, type PlaybackAnimation } from '@rafaelaugusto/jolt'

// A separate application/workload. No synthetic ballast: detached cards own
// the same 4,000-record model used by the existing JSON allocation probe.
configure({ reducedMotion: 'never', timeScale: 1 })
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

Application.run({
  create() {
    const page = new Page()
    page.actionBarHidden = true
    page.backgroundColor = new Color('#102922')
    const root = new GridLayout()
    root.rows = 'auto,*'
    root.padding = 24
    page.content = root
    const status = new Label()
    Object.assign(status, {
      text: 'Detached view retention',
      color: '#eff5da',
      fontSize: 20,
    })
    root.addChild(status)
    let cancelled = false
    page.on('unloaded', () => {
      cancelled = true
    })
    page.once('loaded', async () => {
      const file = knownFolders.externalDocuments().getFile('retention.json')
      const handles: PlaybackAnimation[] = []
      const views: WeakRef<Label>[] = []
      const models: WeakRef<object>[] = []
      const snapshots: object[] = []
      const processId = android.os.Process.myPid()
      const write = (state: string, extra: object = {}) =>
        file.writeTextSync(JSON.stringify({ state, processId, snapshots, ...extra }))
      const collect = async () => {
        // Outside the measured creation/disposal windows, equal on both builds.
        // Collection requests are observations, not a guarantee of reclamation.
        for (let pass = 0; pass < 4; pass++) {
          await sleep(200)
          if (typeof gc === 'function') gc()
          java.lang.System.gc()
        }
        await sleep(200)
      }
      const snapshot = (phase: string) => {
        const memory = new android.os.Debug.MemoryInfo()
        android.os.Debug.getMemoryInfo(memory)
        const row = {
          phase,
          pssKiB: memory.getTotalPss(),
          privateDirtyKiB: memory.getTotalPrivateDirty(),
          nativeHeapAllocatedBytes: android.os.Debug.getNativeHeapAllocatedSize(),
          handles: handles.length,
          liveViews: views.filter((ref) => ref.deref() !== undefined).length,
          liveModels: models.filter((ref) => ref.deref() !== undefined).length,
        }
        snapshots.push(row)
        write(phase)
      }
      const cycle = async (index: number, keep: boolean) => {
        const card = new Label()
        const model = Array.from({ length: 4000 }, (_, id) => ({
          id,
          label: `Motion record ${id}`,
          tags: ['native', 'allocation', 'report'],
          samples: Array.from({ length: 16 }, (_, i) => (id + i) / 10),
        }))
        card.bindingContext = model
        Object.assign(card, {
          text: model[index]!.label,
          color: '#eff5da',
          width: 240,
          height: 80,
          backgroundColor: new Color('#254c3c'),
          verticalAlignment: 'middle',
        })
        GridLayout.setRow(card, 1)
        root.addChild(card)
        await sleep(32)
        const handle = animate(
          card,
          { x: [0, 40], opacity: [1, 0.4] },
          { duration: 80, ease: 'linear' },
        )
        if (index % 2) {
          await sleep(32)
          handle.stop()
        }
        const completed = await handle.finished
        if (completed !== (index % 2 === 0)) throw Error('Unexpected animation result')
        root.removeChild(card)
        if (keep) {
          handles.push(handle)
          views.push(new WeakRef(card))
          models.push(new WeakRef(model))
        }
        if (cancelled) throw Error('Probe interrupted')
      }
      try {
        write('warming')
        for (let i = 0; i < 4; i++) await cycle(i, false)
        await collect()
        snapshot('before')
        const cpu = android.os.Process.getElapsedCpuTime()
        const start = java.lang.System.nanoTime()
        for (let i = 0; i < 16; i++) {
          await cycle(i, true)
          status.text = `Detached view retention · ${i + 1}/16`
        }
        const workload = {
          wallMs: (java.lang.System.nanoTime() - start) / 1e6,
          cpuMs: android.os.Process.getElapsedCpuTime() - cpu,
          recordsPerView: 4000,
          settledHandles: handles.length,
        }
        await collect()
        snapshot('held')
        // Validate settled controls remain harmless while public handles survive.
        for (const handle of handles) {
          handle.pause()
          handle.play()
          handle.stop()
          if (!Number.isFinite(handle.currentTime)) throw Error('Invalid settled clock')
        }
        await sleep(2000)
        await collect()
        snapshot('held-again')
        handles.length = 0
        await collect()
        snapshot('released')
        status.text = 'Detached view retention · complete'
        write('complete', {
          workload,
          gcRequested: true,
          jsGcAvailable: typeof gc === 'function',
          recording: false,
        })
      } catch (error) {
        for (const handle of handles) handle.stop()
        status.text = String(error)
        write('failed', { error: String(error) })
      }
    })
    return page
  },
})
