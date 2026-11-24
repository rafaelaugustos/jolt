import { describe, expect, it, vi } from 'vitest'
import { createDropPolicy } from '../src/core/drop.js'
import { listTransferOptions } from '../src/core/list-transfer.js'
function scene(ids = ['D', 'E']) {
  const source = {},
    target = {},
    preview = vi.fn(),
    commit = vi.fn(),
    accept = vi.fn(() => true)
  let revision = 0,
    y = 25
  const options = listTransferOptions({
    key: 'A',
    target,
    sourceKeys: () => ['A', 'B'],
    targetKeys: () => ids,
    revision: () => revision,
    centers: () => ids.map((key, i) => ({ key, center: 20 + 40 * i })),
    preview,
    commit,
    accept,
  })
  const policy = createDropPolicy(source, options, {
    bounds: (view) =>
      view === source
        ? { x: 1, y, width: 10, height: 10 }
        : { x: 0, y: 0, width: 80, height: 150 },
    enabled: () => true,
    cancelDrag() {},
  })
  return {
    policy,
    commit,
    preview,
    accept,
    ids,
    invalidate: () => revision++,
    move: (value: number) => {
      y = value
      policy.move()
    },
  }
}
describe('two-list transfer', () => {
  it('previews measured insertion slots and commits exactly once from final release geometry', () => {
    const { policy, commit, preview, move } = scene()
    policy.begin()
    move(0)
    expect(preview.mock.lastCall?.[0].beforeKey).toBe('D')
    move(40)
    expect(preview.mock.lastCall?.[0].beforeKey).toBe('E')
    expect(policy.release()).toBe(true)
    expect(policy.release()).toBe(false)
    expect(commit.mock.calls).toEqual([
      [{ key: 'A', beforeKey: 'E', fromIndex: 0, toIndex: 1 }],
    ])
  })
  it('accepts empty destinations and supports application rejection', () => {
    const { policy, commit, accept } = scene([])
    policy.begin()
    policy.move()
    expect(policy.release()).toBe(true)
    expect(commit.mock.lastCall?.[0].toIndex).toBe(0)
    accept.mockReturnValue(false)
    policy.begin()
    policy.move()
    expect(policy.release()).toBe(false)
    expect(commit).toHaveBeenCalledTimes(1)
  })
  it.each(['revision', 'mutation', 'cancel', 'dispose'])(
    'rejects an outdated proposal after %s',
    (reason) => {
      const { policy, commit, ids, invalidate } = scene()
      policy.begin()
      policy.move()
      if (reason === 'revision') invalidate()
      if (reason === 'mutation') ids.reverse()
      if (reason === 'cancel') policy.handle.cancel()
      if (reason === 'dispose') policy.handle.dispose()
      expect(policy.release()).toBe(false)
      expect(commit).not.toHaveBeenCalled()
    },
  )
  it('rechecks ownership after synchronous acceptance', () => {
    const { policy, commit, accept, invalidate } = scene()
    accept.mockImplementation(() => {
      invalidate()
      return true
    })
    policy.begin()
    policy.move()
    expect(policy.release()).toBe(false)
    expect(commit).not.toHaveBeenCalled()
  })
})
