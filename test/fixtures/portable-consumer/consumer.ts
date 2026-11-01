import {
  createTrack,
  resolveTransition,
  createClock,
  createOwnership,
  type Driver,
  type PlaybackAnimation,
  type PlaybackState,
} from '@jolt-internal/core-boundary-probe'

const target = { id: 'plain object' }
const track = createTrack(
  'x',
  [0, 200],
  resolveTransition({ type: 'spring' }, 'x', 2),
  900,
  { timeScale: 1, reducedMotion: false },
)
const driver: Driver<typeof target> = {
  now: () => 0,
  frame: () => () => {},
  play: (value, curve, startedAt, done) => ({ id: value.id, curve, startedAt, done }),
  stop: () => {},
  presented: () => undefined,
  after: () => () => {},
  clock: () => createClock(() => 0),
  control: (_target, _handle, _elapsed, _paused, command) => {
    const valid: 'play' | 'pause' | 'seek' | undefined = command
    void valid
  },
}
driver.play(target, track, 0, () => {})
createOwnership<typeof target, 'x'>().claim(target, 'x')
declare const animation: PlaybackAnimation
const completion: Promise<boolean> = animation.finished
const state: PlaybackState = {
  time: 0,
  duration: 100,
  paused: false,
  ready: true,
  settled: false,
  completed: false,
}
void completion
void state
