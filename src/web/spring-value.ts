import { springPhysics, springTrajectory, type SpringParams } from '../core/spring.js'
import { NumericValue, finite, type WebReadableValue } from './value.js'
import type { FrameScheduler, FrameTask } from './scheduler.js'

export interface WebSpringOptions extends SpringParams {
  initial?: number
  restDelta?: number
  restSpeed?: number
}
export interface WebSpringValue extends WebReadableValue {
  readonly moving: boolean
  readonly paused: boolean
  pause(): void
  play(): void
  /** Hold the current position with zero velocity until play(). */
  stop(): void
  /** Settle immediately at the input's current value. */
  jump(): void
}

export class SpringValueNode extends NumericValue {
  private readonly physics: ReturnType<typeof springPhysics>
  private readonly delta: number
  private readonly restSpeed: number
  private destination: number
  private trajectory?: ReturnType<typeof springTrajectory>
  private epoch = 0
  private rate = 1
  private held = false
  private active = false
  private unsubscribe: () => void
  private task: FrameTask = {
    update: (at) => {
      this.advance(at)
      return this.active && !this.held && !this.ended
    },
  }
  constructor(
    scheduler: FrameScheduler,
    private readonly source: NumericValue,
    options: WebSpringOptions,
    private readonly settings: () => { reduced: boolean; timeScale: number },
    report: (error: unknown) => void,
    forget: () => void,
  ) {
    if (!options || typeof options !== 'object')
      throw new TypeError('Expected spring options.')
    for (const [key, value] of Object.entries(options)) {
      if (
        ![
          'stiffness',
          'damping',
          'mass',
          'bounce',
          'duration',
          'initial',
          'restDelta',
          'restSpeed',
        ].includes(key)
      )
        throw new TypeError(`Unsupported continuous spring option: ${key}.`)
      if (value !== undefined) finite(value, key)
    }
    const physics = springPhysics(options)
    if (
      physics.stiffness <= 0 ||
      physics.damping < 0 ||
      physics.mass <= 0 ||
      (options.duration !== undefined && options.duration <= 0) ||
      (options.bounce !== undefined && Math.abs(options.bounce) >= 1) ||
      (options.restDelta !== undefined && options.restDelta <= 0) ||
      (options.restSpeed !== undefined && options.restSpeed <= 0) ||
      Object.values(physics).some((v) => !Number.isFinite(v))
    )
      throw new RangeError('Invalid continuous spring parameters.')
    super(scheduler, options.initial ?? source.get(), report, forget)
    this.physics = physics
    this.delta = options.restDelta ?? 0.001
    this.restSpeed = options.restSpeed ?? 0.01
    this.destination = source.get()
    this.unsubscribe = source.listen(
      () => this.retarget(),
      () => this.dispose(),
    )
    this.retarget()
  }
  override get moving() {
    return this.active && !this.held && !this.ended
  }
  get paused() {
    return this.held
  }
  private sample(at: number) {
    if (!this.trajectory || this.held || this.ended)
      return { position: this.position, velocity: this.speed }
    const elapsed = Math.max(0, at - this.epoch) * this.rate
    if (elapsed === 0) return { position: this.position, velocity: this.speed }
    return {
      position: this.trajectory.position(elapsed),
      velocity: this.trajectory.exactVelocity(elapsed) * this.rate,
    }
  }
  override get() {
    return this.sample(this.scheduler.now()).position
  }
  override getVelocity() {
    return this.ended ? 0 : this.sample(this.scheduler.now()).velocity
  }
  private advance(at: number) {
    if (this.ended || this.held || !this.active) return
    const next = this.sample(at)
    if (
      Math.abs(next.position - this.destination) <= this.delta &&
      Math.abs(next.velocity) <= this.restSpeed
    ) {
      this.active = false
      this.trajectory = undefined
      this.publish(this.destination, 0)
    } else this.publish(next.position, next.velocity)
  }
  private retarget() {
    if (this.ended) return
    const at = this.scheduler.now()
    this.advance(at)
    this.destination = this.source.get()
    if (this.settings().reduced) {
      this.jump()
      return
    }
    if (this.held) return
    this.rate = this.settings().timeScale
    this.epoch = at
    this.trajectory = springTrajectory(
      this.physics,
      this.position,
      this.destination,
      this.speed / this.rate,
    )
    this.active =
      Math.abs(this.position - this.destination) > this.delta ||
      Math.abs(this.speed) > this.restSpeed
    if (this.active) this.scheduler.add(this.task)
    else {
      this.trajectory = undefined
      this.publish(this.destination, 0)
      this.scheduler.remove(this.task)
    }
  }
  preferenceChanged() {
    if (!this.ended && this.settings().reduced) this.jump()
  }
  pause() {
    this.assert()
    if (this.held) return
    this.advance(this.scheduler.now())
    this.held = true
    this.scheduler.remove(this.task)
  }
  play() {
    this.assert()
    if (this.held) {
      this.held = false
      this.trajectory = undefined
      this.retarget()
    }
  }
  stop() {
    this.pause()
    this.speed = 0
  }
  jump() {
    this.assert()
    this.destination = this.source.get()
    this.trajectory = undefined
    this.active = false
    this.scheduler.remove(this.task)
    this.publish(this.destination, 0)
  }
  override dispose() {
    if (this.ended) return
    const sampled = this.sample(this.scheduler.now())
    this.position = sampled.position
    this.trajectory = undefined
    this.active = false
    this.unsubscribe?.()
    this.scheduler.remove(this.task)
    super.dispose()
  }
  springHandle(): WebSpringValue {
    const node = this
    return {
      get: () => node.get(),
      getVelocity: () => node.getVelocity(),
      subscribe: (listener) => node.subscribe(listener),
      get disposed() {
        return node.disposed
      },
      get moving() {
        return node.moving
      },
      get paused() {
        return node.paused
      },
      pause: () => node.pause(),
      play: () => node.play(),
      stop: () => node.stop(),
      jump: () => node.jump(),
      dispose: () => node.dispose(),
    }
  }
}
