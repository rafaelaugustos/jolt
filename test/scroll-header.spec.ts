import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListView as CoreListView } from '@nativescript/core'
import { Application, GridLayout, ListView, View } from './shims/core.js'
import { driver, flush } from './helpers.js'
import {
  scrollHeader,
  type ScrollHeader,
  type ScrollHeaderOptions,
} from '../src/scroll-header/index.js'
import {
  headerGeometry,
  resizedOffset,
  restoredOffset,
} from '../src/scroll-header/geometry.js'
import {
  createScrollHeaderDriver,
  type ScrollHeaderDriver,
} from '../src/scroll-header/native.js'
import { setLiveSpringDriver, type LiveNode } from '../src/live-spring-driver.js'
vi.mock('../src/scroll-header/native.js', () => ({ createScrollHeaderDriver: vi.fn() }))

const owners: ScrollHeader[] = []
let offset = 0
let native: {
  snapshot: ReturnType<typeof vi.fn>
  configure: ReturnType<typeof vi.fn>
  scroll: ReturnType<typeof vi.fn>
  enabled: ReturnType<typeof vi.fn>
  refreshing: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}
const nodes: LiveNode[] = []
beforeEach(() => {
  offset = 0
  native = {
    snapshot: vi.fn(() => ({
      offset,
      phase: 'expanded' as const,
      updates: 1,
      callbacks: 1,
      first: 0,
      visible: 8,
      total: 81,
    })),
    configure: vi.fn(),
    scroll: vi.fn((y: number) => {
      offset = y
    }),
    enabled: vi.fn(),
    refreshing: vi.fn(),
    dispose: vi.fn(),
  }
  vi.mocked(createScrollHeaderDriver)
    .mockClear()
    .mockReturnValue(native as ScrollHeaderDriver)
  setLiveSpringDriver({
    create: (value) => {
      const node: LiveNode = {
        position: () => value,
        velocity: () => 0,
        moving: () => false,
        follow() {},
        update() {},
        inputs() {},
        reduced() {},
        paused() {},
        dispose: vi.fn(),
        bind: () => ({ value: () => value, layers() {}, cancel() {} }),
      }
      nodes.push(node)
      return node
    },
    sync() {},
  })
})
afterEach(() => {
  owners.splice(0).forEach((owner) => owner.dispose())
  nodes.length = 0
  setLiveSpringDriver(undefined)
})
function scene() {
  const host = new GridLayout(),
    list = new ListView(),
    header = new GridLayout(),
    toolbar = new GridLayout(),
    section = new View(),
    title = new View(),
    toolbarTitle = new View(),
    artwork = new View()
  for (const view of [list, header, toolbar, section]) view.parent = host
  title.parent = artwork.parent = header
  toolbarTitle.parent = toolbar
  header.actualSize.height = 300
  toolbar.actualSize.height = 60
  section.actualSize.height = 50
  let keys = ['a', 'b', 'c', 'd', 'e']
  const spacer = vi.fn()
  const options = {
    header,
    toolbar,
    section,
    title,
    toolbarTitle,
    artwork,
    rowHeight: 80,
    setSpacerHeight: spacer,
    keys: () => keys,
  } as unknown as ScrollHeaderOptions
  const start = () => {
    const owner = scrollHeader(list as unknown as CoreListView, options)
    owners.push(owner)
    return owner
  }
  return {
    host,
    list,
    header,
    toolbar,
    section,
    title,
    artwork,
    options,
    start,
    spacer,
    keys: (value: string[]) => {
      keys = value
    },
  }
}
async function layouts() {
  for (let i = 0; i < 8; i++) {
    await flush()
    driver.layout()
  }
  await flush()
}

describe('scrollHeader geometry and ownership', () => {
  it('hands reader focus over while both headings remain visible', () => {
    for (const [title, toolbar] of [
      [
        [0, 0.7],
        [0.55, 0.95],
      ],
      [
        [0, 0.9],
        [0.8, 1],
      ],
      [
        [0.7, 0.9],
        [0, 0.2],
      ],
    ] as const) {
      const geometry = headerGeometry(300, 60, 50, 80, 40, 0, title, toolbar)
      const progress = geometry.focusHandoff
      const titleAlpha = Math.min(1, (title[1] - progress) / (title[1] - title[0]))
      const toolbarAlpha = Math.min(
        1,
        (progress - toolbar[0]) / (toolbar[1] - toolbar[0]),
      )
      expect(titleAlpha).toBeGreaterThan(0.01)
      expect(toolbarAlpha).toBeGreaterThan(0.01)
      // Reduced Motion retains the original immediate visual transition.
      expect(geometry.handoff).toBe((toolbar[0] + toolbar[1]) / 2)
    }
  })
  it('accounts for Android pixel dividers in insertion anchors', () => {
    const before = headerGeometry(300, 60, 50, 80, 40, 0.4),
      after = headerGeometry(380, 60, 50, 80, 40, 0.4)
    expect(resizedOffset(710, before, after)).toBe(790)
    expect(restoredOffset(710, before, after, 4, 6)).toBeCloseTo(950.8)
    expect(resizedOffset(-20, before, after)).toBe(0)
    expect(restoredOffset(0, before, after, 0, 1)).toBe(0)
    expect(restoredOffset(710, before, before, 4, 3)).toBeCloseTo(629.6)
  })
  it('rejects unusable geometry and fade intervals', () => {
    for (const expanded of [0, 60, NaN, Infinity])
      expect(() => headerGeometry(expanded, 60, 50, 80, 40)).toThrow(RangeError)
    expect(() => headerGeometry(300, 60, 50, 80, 241)).toThrow(RangeError)
    expect(() => headerGeometry(300, 60, 50, 80, 40, 0, [0.8, 0.4])).toThrow(/Fade/)
    expect(() => headerGeometry(300, 60, 50, 80, 40, 0, [0, 1], [-1, 1])).toThrow(/Fade/)
  })
  it('rejects competing or unretained containers before taking ownership', () => {
    const s = scene()
    s.title.parent = s.host
    expect(s.start).toThrow(/retained/)
    s.title.parent = s.header
    Object.assign(s.list, { sectioned: true })
    expect(s.start).toThrow(/flat Core ListView/)
    Object.assign(s.list, { sectioned: false })
    Object.assign(s.options, { diagnostic: new View() })
    expect(s.start).toThrow(/Core Label/)
  })
  it('measures a real spacer and leaves an already-scrolled list in place at attachment', async () => {
    const s = scene()
    offset = 440
    const owner = s.start()
    await layouts()
    expect(owner.ready).toBe(true)
    expect(s.spacer).toHaveBeenCalledWith(350)
    expect(owner.geometry?.range).toBe(240)
    expect(native.scroll).not.toHaveBeenCalled()
    expect(s.list.listenerCount('scroll')).toBe(0)
    expect(driver.frames.size).toBe(0)
    expect(nodes).toHaveLength(1)
  })
  it('keeps a stable item on screen across insertion and deletion above it', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 420
    const inserted = owner.preserveAnchor(() => s.keys(['x', 'a', 'b', 'c', 'd', 'e']))
    await layouts()
    await inserted
    expect(offset).toBe(500)
    const deleted = owner.preserveAnchor(() => s.keys(['b', 'c', 'd', 'e']))
    await layouts()
    await deleted
    expect(offset).toBe(340)
    expect(() => owner.scrollToItem(-1)).toThrow(RangeError)
    owner.scrollToItem(3)
    expect(offset).toBe(480)
  })
  it('anchors late title sizing while collapsed and keeps the top at the top', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 560
    s.header.actualSize.height = 410
    const resize = owner.remeasure()
    await layouts()
    await resize
    expect(offset).toBe(670)
    expect(s.spacer).toHaveBeenLastCalledWith(460)
    offset = 0
    s.header.actualSize.height = 300
    const shrink = owner.remeasure()
    await layouts()
    await shrink
    expect(offset).toBe(0)
  })
  it('keeps the same row below a growing compact title and pinned section', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    owner.scrollToItem(3)
    const before = owner.geometry!
    const relativeTop = (g: typeof before) =>
      g.spacer + 3 * g.rowHeight - offset - g.minimum - g.section
    expect(relativeTop(before)).toBe(0)
    s.header.actualSize.height = 420
    s.toolbar.actualSize.height = 120
    s.section.actualSize.height = 70
    const resize = owner.remeasure()
    await layouts()
    await resize
    expect(relativeTop(owner.geometry!)).toBe(0)
    expect(offset).toBe(540)
    s.header.actualSize.height = 300
    s.toolbar.actualSize.height = 60
    s.section.actualSize.height = 50
    const shrink = owner.remeasure()
    await layouts()
    await shrink
    expect(relativeTop(owner.geometry!)).toBe(0)
    expect(offset).toBe(480)
  })
  it('clips an oversized native header even when Core already reports clipping enabled', async () => {
    const s = scene()
    s.host.clipToBounds = true
    const container = { clipsToBounds: false }
    s.host.nativeViewProtected = container
    const owner = s.start()
    await layouts()
    expect(container.clipsToBounds).toBe(true)
    owner.dispose()
    expect(container.clipsToBounds).toBe(false)
    expect(s.host.clipToBounds).toBe(true)
  })
  it('releases native sources on suspension and unload, then attaches exactly once on reload', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 500
    Application.notify({ eventName: Application.suspendEvent })
    expect(native.enabled).toHaveBeenLastCalledWith(false)
    Application.notify({ eventName: Application.resumeEvent })
    await layouts()
    expect(native.enabled).toHaveBeenLastCalledWith(true)
    s.list.notify({ eventName: 'unloaded' })
    s.list.unload()
    await flush()
    expect(native.dispose).toHaveBeenCalledOnce()
    expect(nodes[0]!.dispose).toHaveBeenCalledOnce()
    expect(owner.ready).toBe(false)
    s.list.load()
    await layouts()
    expect(createScrollHeaderDriver).toHaveBeenCalledTimes(2)
    expect(offset).toBe(500)
    owner.dispose()
    owner.dispose()
    expect(s.list.listenerCount('loaded')).toBe(0)
    expect(s.list.listenerCount('unloaded')).toBe(0)
    expect(s.host.clipToBounds).toBe(false)
    expect(s.spacer).toHaveBeenLastCalledWith(0)
  })
  it('remeasures a late layout change arriving while the spacer is being laid out', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 560
    s.header.actualSize.height = 380
    const resizing = owner.remeasure()
    driver.layout()
    await flush()
    expect(s.spacer).toHaveBeenLastCalledWith(430)
    s.header.actualSize.height = 420
    s.header.notify({ eventName: 'layoutChanged' })
    await layouts()
    await resizing
    expect(owner.geometry?.expanded).toBe(420)
    expect(offset).toBe(680)
    expect(driver.pendingLayouts).toBe(0)
  })
  it('reattaches after unloading and loading before a cancelled measurement settles', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 560
    const resizing = owner.remeasure()
    const rejection = expect(resizing).rejects.toThrow(/cancelled/)
    s.list.notify({ eventName: 'unloaded' })
    s.list.unload()
    s.list.load()
    await rejection
    await layouts()
    expect(owner.ready).toBe(true)
    expect(createScrollHeaderDriver).toHaveBeenCalledTimes(2)
    expect(offset).toBe(560)
    expect(driver.pendingLayouts).toBe(0)
  })
  it('preserves the original anchor if unloading interrupts a spacer resize', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 560
    s.header.actualSize.height = 380
    const resizing = owner.remeasure()
    const rejection = expect(resizing).rejects.toThrow(/cancelled/)
    driver.layout()
    await flush()
    expect(s.spacer).toHaveBeenLastCalledWith(430)
    s.list.notify({ eventName: 'unloaded' })
    s.list.unload()
    s.list.load()
    await rejection
    await layouts()
    expect(owner.ready).toBe(true)
    expect(owner.geometry?.expanded).toBe(380)
    expect(offset).toBe(640)
  })
  it('waits for the latest requested geometry when remeasure calls overlap', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 560
    s.header.actualSize.height = 380
    const first = owner.remeasure()
    driver.layout()
    await flush()
    s.header.actualSize.height = 420
    const observed = owner.remeasure().then(() => owner.geometry?.expanded)
    await layouts()
    await first
    expect(await observed).toBe(420)
    expect(offset).toBe(680)
  })
  it('waits for native anchor restoration before reporting a reloaded list ready', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 560
    s.list.notify({ eventName: 'unloaded' })
    s.list.unload()
    s.list.load()
    await flush()
    driver.layout()
    await flush()
    driver.layout()
    await flush()
    expect(native.scroll).toHaveBeenLastCalledWith(560, false)
    expect(owner.ready).toBe(false)
    await layouts()
    expect(owner.ready).toBe(true)
    expect(offset).toBe(560)
  })
  it('retains the requested anchor if unload interrupts asynchronous native scrolling', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 560
    s.header.actualSize.height = 380
    native.scroll.mockImplementationOnce(() => {}) // Android selection awaits layout.
    const resizing = owner.remeasure()
    const rejection = expect(resizing).rejects.toThrow(/cancelled/)
    driver.layout()
    await flush()
    driver.layout()
    await flush()
    expect(native.scroll).toHaveBeenLastCalledWith(640, false)
    s.list.notify({ eventName: 'unloaded' })
    s.list.unload()
    s.list.load()
    await rejection
    await layouts()
    expect(owner.ready).toBe(true)
    expect(offset).toBe(640)
  })
  it('cancels a pending layout and replaces an existing owner without leaked listeners', async () => {
    const s = scene()
    const first = s.start()
    const pending = first.remeasure()
    const rejection = expect(pending).rejects.toThrow(/cancelled/)
    const second = s.start()
    await rejection
    await layouts()
    expect(first.disposed).toBe(true)
    expect(second.ready).toBe(true)
    expect(s.list.listenerCount('unloaded')).toBe(1)
    expect(driver.pendingLayouts).toBe(0)
  })
})

describe('scrollHeader pull-to-refresh', () => {
  it('requires stable keys and validates callbacks and threshold', () => {
    const s = scene()
    s.options.onRefresh = () => {}
    s.options.keys = undefined
    expect(s.start).toThrow(/keys/)
    s.options.keys = () => ['a']
    s.options.refreshThreshold = 0
    expect(s.start).toThrow(/positive/)
    s.options.refreshThreshold = 80
    s.options.onRefresh = 42 as never
    expect(s.start).toThrow(/functions/)
  })
  it('coalesces duplicate requests and preserves the current anchor after loading', async () => {
    const s = scene()
    let resolveLoad!: () => void
    const loaded = new Promise<void>((resolve) => {
      resolveLoad = resolve
    })
    s.options.onRefresh = vi.fn(async (context) => {
      await loaded
      await context.commit(() => s.keys(['new', 'a', 'b', 'c', 'd', 'e']))
    })
    const owner = s.start()
    await layouts()
    offset = 0
    const first = owner.refresh()
    expect(owner.refresh()).toBe(first)
    await flush()
    expect(s.options.onRefresh).toHaveBeenCalledOnce()
    offset = 400 // The user scrolls while the request is pending.
    resolveLoad()
    await layouts()
    expect(await first).toBe(true)
    expect(offset).toBe(480) // Preserve this new position, not the request-time top.
    expect(native.refreshing.mock.calls.map(([value]) => value)).toEqual([true, false])
  })
  it('keeps top refresh at the top, including an empty list', async () => {
    const s = scene()
    s.keys([])
    s.options.onRefresh = async (context) => {
      await context.commit(() => s.keys(['new']))
    }
    const owner = s.start()
    await layouts()
    offset = -100 // Native iOS overscroll.
    const request = owner.refresh()
    await layouts()
    expect(await request).toBe(true)
    expect(offset).toBe(0)
  })
  it('settles a failure, reports it once, and permits a fresh retry', async () => {
    const s = scene(),
      error = new Error('offline')
    s.options.onRefresh = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined)
    s.options.onRefreshError = vi.fn()
    const owner = s.start()
    await layouts()
    expect(await owner.refresh()).toBe(false)
    expect(s.options.onRefreshError).toHaveBeenCalledExactlyOnceWith(error)
    expect(native.refreshing).toHaveBeenLastCalledWith(false)
    expect(await owner.refresh()).toBe(true)
    expect(s.options.onRefresh).toHaveBeenCalledTimes(2)
  })
  for (const action of [
    'pause',
    'background',
    'unload',
    'dispose',
    'replace',
    'cancel',
  ] as const) {
    it(`ignores late results after ${action} and settles immediately`, async () => {
      const s = scene()
      let resolveLoad!: () => void
      const loaded = new Promise<void>((resolve) => {
        resolveLoad = resolve
      })
      const mutate = vi.fn()
      let cancelled = false
      s.options.onRefresh = async (context) => {
        await loaded
        cancelled = context.cancelled
        expect(await context.commit(mutate)).toBe(false)
      }
      const owner = s.start()
      await layouts()
      const request = owner.refresh()
      await flush()
      if (action === 'pause') owner.pause()
      else if (action === 'background')
        Application.notify({ eventName: Application.suspendEvent })
      else if (action === 'unload') {
        s.list.notify({ eventName: 'unloaded' })
        s.list.unload()
      } else if (action === 'dispose') owner.dispose()
      else if (action === 'replace') s.start()
      else owner.cancelRefresh()
      expect(await request).toBe(false)
      resolveLoad()
      await layouts()
      expect(cancelled).toBe(true)
      expect(mutate).not.toHaveBeenCalled()
      expect(native.refreshing).toHaveBeenLastCalledWith(false)
    })
  }
  it('an old completion cannot stop a newer spinner or report a stale error', async () => {
    const s = scene()
    let rejectOld!: (reason: Error) => void, finishNew!: () => void
    const old = new Promise<void>((_, reject) => {
      rejectOld = reject
    })
    const fresh = new Promise<void>((resolve) => {
      finishNew = resolve
    })
    s.options.onRefresh = vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(fresh)
    s.options.onRefreshError = vi.fn()
    const owner = s.start()
    await layouts()
    const first = owner.refresh()
    await flush()
    owner.cancelRefresh()
    const second = owner.refresh()
    await flush()
    rejectOld(new Error('late'))
    await flush()
    expect(await first).toBe(false)
    expect(native.refreshing).toHaveBeenLastCalledWith(true)
    expect(s.options.onRefreshError).not.toHaveBeenCalled()
    finishNew()
    expect(await second).toBe(true)
    expect(native.refreshing).toHaveBeenLastCalledWith(false)
  })
  it('does not run unavailable, paused or disposed refresh callbacks', async () => {
    const s = scene()
    s.options.onRefresh = vi.fn()
    const owner = s.start()
    expect(await owner.refresh()).toBe(false)
    await layouts()
    owner.pause()
    expect(await owner.refresh()).toBe(false)
    owner.play()
    expect(await owner.refresh()).toBe(true)
    owner.dispose()
    expect(await owner.refresh()).toBe(false)
    expect(s.options.onRefresh).toHaveBeenCalledOnce()
  })
  it('does not restore an old anchor into a reloaded native list', async () => {
    const s = scene()
    const owner = s.start()
    await layouts()
    offset = 400
    let finish!: () => void
    const pending = owner.preserveAnchor(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    s.list.notify({ eventName: 'unloaded' })
    s.list.unload()
    s.list.load()
    await layouts()
    native.scroll.mockClear()
    finish()
    await pending
    expect(native.scroll).not.toHaveBeenCalled()
  })
})

describe('refresh native boundary', () => {
  it('starts once from repeated native refresh notifications', async () => {
    const s = scene()
    let finish!: () => void
    s.options.onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const owner = s.start()
    await layouts()
    const base = (native as ScrollHeaderDriver).snapshot()
    let refreshing = true
    native.snapshot.mockImplementation(() => ({
      ...base,
      refresh: refreshing ? 'refreshing' : 'idle',
    }))
    native.refreshing.mockImplementation((value: boolean) => {
      refreshing = value
    })
    const notify = vi.mocked(createScrollHeaderDriver).mock.calls[0]![5]
    notify()
    notify()
    notify()
    await flush()
    expect(s.options.onRefresh).toHaveBeenCalledOnce()
    finish()
    await flush()
    expect(owner.state.refresh).toBe('idle')
  })

  it('does not start application loading when cancelled in the same turn', async () => {
    const s = scene()
    s.options.onRefresh = vi.fn()
    const owner = s.start()
    await layouts()
    const result = owner.refresh()
    owner.cancelRefresh()
    await expect(result).resolves.toBe(false)
    await flush()
    expect(s.options.onRefresh).not.toHaveBeenCalled()
  })
})

describe('refresh during remeasurement', () => {
  it('waits for a pending cover measurement before committing loaded data', async () => {
    const s = scene()
    let commit!: () => Promise<boolean>
    let release!: () => void
    const loaded = new Promise<void>((resolve) => {
      release = resolve
    })
    const changed = vi.fn(() => s.keys(['new', 'a', 'b', 'c', 'd', 'e']))
    s.options.onRefresh = async (context) => {
      commit = () => context.commit(changed)
      await loaded
    }
    const owner = s.start()
    await layouts()
    const refresh = owner.refresh()
    await flush()
    s.header.actualSize.height = 400
    const measurement = owner.remeasure()
    await flush()
    const applied = commit()
    await flush()
    expect(changed).not.toHaveBeenCalled()
    await layouts()
    await measurement
    await expect(applied).resolves.toBe(true)
    expect(changed).toHaveBeenCalledOnce()
    release()
    await expect(refresh).resolves.toBe(true)
  })
})
