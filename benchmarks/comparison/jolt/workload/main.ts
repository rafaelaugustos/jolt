import { Application, Color, knownFolders, Label, Page } from '@nativescript/core'

// Separate entry/app ID: never included in the motion benchmark. This fixed
// allocation workload checks a V8 profile's cost, not cross-framework JS speed.
Application.run({
  create: () => {
    const page = new Page()
    page.actionBarHidden = true
    page.backgroundColor = new Color('#102922')
    const label = new Label()
    Object.assign(label, {
      text: 'JavaScript allocation probe\nPreparing…',
      color: '#eff5da',
      fontSize: 22,
      textWrap: true,
      padding: 24,
    })
    page.content = label
    let cancelled = false
    page.on('unloaded', () => {
      cancelled = true
    })
    page.once('loaded', () => {
      const file = knownFolders.externalDocuments().getFile('js-work.json')
      const runtime = JSON.parse(
        knownFolders.currentApp().getFile('package.json').readTextSync(),
      )
      const report: {
        status: string
        processId: number
        v8Flags: string
        rows: number
        iterations: number
        warmupBatches: number
        samples: { wallMs: number; processCpuMs: number; checksum: number }[]
        encodedCharacters?: number
        expectedChecksum?: number
        error?: string
      } = {
        status: 'running',
        processId: android.os.Process.myPid(),
        v8Flags: runtime.android?.v8Flags ?? 'runtime default',
        rows: 4000,
        iterations: 10,
        warmupBatches: 1,
        samples: [],
      }
      const write = () => file.writeTextSync(JSON.stringify(report))
      write()
      setTimeout(() => {
        if (cancelled) return
        const records = Array.from({ length: report.rows }, (_, id) => ({
          id,
          label: `Motion record ${id}`,
          tags: ['native', 'allocation', 'report'],
          samples: Array.from({ length: 16 }, (_, i) => (id + i) / 10),
        }))
        report.encodedCharacters = JSON.stringify(records).length
        const checksum = (items: typeof records) =>
          items.reduce(
            (sum, item) =>
              sum + item.id + item.label.length + item.samples.length + item.tags.length,
            0,
          )
        report.expectedChecksum = checksum(records) * report.iterations
        const batch = () => {
          if (cancelled) return
          try {
            const cpuStart = android.os.Process.getElapsedCpuTime()
            const start = java.lang.System.nanoTime()
            let total = 0
            for (let i = 0; i < report.iterations; i++)
              total += checksum(JSON.parse(JSON.stringify(records)))
            const wallMs = (java.lang.System.nanoTime() - start) / 1e6
            const processCpuMs = android.os.Process.getElapsedCpuTime() - cpuStart
            if (total !== report.expectedChecksum)
              throw Error('JSON round-trip checksum changed')
            report.samples.push({ wallMs, processCpuMs, checksum: total })
            const complete = report.samples.length === 6
            report.status = complete ? 'complete' : 'running'
            label.text = `JavaScript allocation probe\n${report.v8Flags}\n\n${report.samples.length}/6 batches\n${wallMs.toFixed(1)} ms wall time\n${processCpuMs} ms process CPU\n${complete ? 'Complete · checksum verified' : 'Running…'}`
            write()
            if (!complete) setTimeout(batch, 500)
          } catch (error) {
            report.status = 'failed'
            report.error = String(error)
            label.text = report.error
            write()
          }
        }
        batch()
      }, 1000)
    })
    return page
  },
})
