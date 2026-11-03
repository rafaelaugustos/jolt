/** Fixed 240 Hz circle kernel. Kept in parity with the compiled iOS/Android kernels. */
export const CIRCLE_DT = 1 / 240
export const CIRCLE_SPEED = 1200
export class CircleAttachment {
  enabled = false
  u = 0
  v = 0
  length = 0
  stiffness = 180
  damping = 24
}
export class CircleSnap {
  count = 0
  index = 0
  previousIndex = 0
  active = false
  previousActive = false
  u: number[] = []
  v: number[] = []
  stiffness = 180
  damping = 24
  projection = 0.12
}
export class CircleBody {
  x = 0
  y = 0
  vx = 0
  vy = 0
  r = 12
  m = 1
  tx = 0
  ty = 0
  ax = 0
  ay = 0
  releaseX = 0
  releaseY = 0
  releaseVX = 0
  releaseVY = 0
  released = false
  held = false
  supported = false
  linked = false
  springAX = 0
  springAY = 0
  attachment = new CircleAttachment()
  drag = new CircleAttachment()
  snap = new CircleSnap()
}
export class CircleSpring {
  enabled = false
  a = 0
  b = 0
  length = 0
  stiffness = 180
  damping = 24
}
export const circleClamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))
export function limitCircle(b: CircleBody) {
  const speed = Math.hypot(b.vx, b.vy)
  if (speed > CIRCLE_SPEED) {
    b.vx *= CIRCLE_SPEED / speed
    b.vy *= CIRCLE_SPEED / speed
  }
}
const kinematic = (b: CircleBody) => b.held && !b.drag.enabled
export class CircleMath {
  readonly bodies: CircleBody[]
  readonly springs = Array.from({ length: 32 }, () => new CircleSpring())
  width = 1
  height = 1
  gx = 0
  gy = 750
  restitution = 0.65
  damping = 0.5
  quiet = 0
  steps = 0
  contacts = 0
  sleeping = false
  constructor(count: number) {
    this.bodies = Array.from({ length: count }, () => new CircleBody())
  }
  wake() {
    this.sleeping = false
    this.quiet = 0
  }
  fits(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      return false
    let area = 0
    for (const b of this.bodies) {
      if (2 * b.r > Math.min(width, height)) return false
      area += Math.PI * b.r * b.r
    }
    return area <= width * height * 0.4
  }
  private bodySprings() {
    for (const s of this.springs) {
      if (!s.enabled) continue
      const a = this.bodies[s.a]!,
        b = this.bodies[s.b]!
      a.linked = b.linked = true
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy),
        nx = d > 1e-9 ? dx / d : 1,
        ny = d > 1e-9 ? dy / d : 0,
        force = s.stiffness * (d - s.length)
      a.springAX += (nx * force) / a.m
      a.springAY += (ny * force) / a.m
      b.springAX -= (nx * force) / b.m
      b.springAY -= (ny * force) / b.m
    }
  }
  private bodySpringDamping() {
    for (const s of this.springs) {
      if (!s.enabled) continue
      const a = this.bodies[s.a]!,
        b = this.bodies[s.b]!
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy),
        nx = d > 1e-9 ? dx / d : 1,
        ny = d > 1e-9 ? dy / d : 0
      const ia = kinematic(a) ? 0 : 1 / a.m,
        ib = kinematic(b) ? 0 : 1 / b.m,
        relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      const impulse =
        (s.damping * relative * CIRCLE_DT) / (1 + s.damping * CIRCLE_DT * (ia + ib))
      a.vx += nx * impulse * ia
      a.vy += ny * impulse * ia
      b.vx -= nx * impulse * ib
      b.vy -= ny * impulse * ib
    }
  }
  private walls(b: CircleBody, impulse: boolean) {
    const e = this.restitution
    if (b.x <= b.r) {
      b.x = b.r
      if (b.ax < 0) b.supported = true
      if (impulse && !kinematic(b) && b.vx < 0) {
        b.vx = Math.abs(b.vx) < 40 ? 0 : -b.vx * e
        this.contacts++
      }
    }
    if (b.x >= this.width - b.r) {
      b.x = this.width - b.r
      if (b.ax > 0) b.supported = true
      if (impulse && !kinematic(b) && b.vx > 0) {
        b.vx = Math.abs(b.vx) < 40 ? 0 : -b.vx * e
        this.contacts++
      }
    }
    if (b.y <= b.r) {
      b.y = b.r
      if (b.ay < 0) b.supported = true
      if (impulse && !kinematic(b) && b.vy < 0) {
        b.vy = Math.abs(b.vy) < 40 ? 0 : -b.vy * e
        this.contacts++
      }
    }
    if (b.y >= this.height - b.r) {
      b.y = this.height - b.r
      if (b.ay > 0) b.supported = true
      if (impulse && !kinematic(b) && b.vy > 0) {
        b.vy = Math.abs(b.vy) < 40 ? 0 : -b.vy * e
        this.contacts++
      }
    }
  }
  solveContacts(impulse: boolean, iterations: number) {
    for (let iteration = 0; iteration < iterations; iteration++) {
      for (let i = 0; i < this.bodies.length; i++)
        for (let j = i + 1; j < this.bodies.length; j++) {
          const a = this.bodies[i]!,
            b = this.bodies[j]!,
            dx = b.x - a.x,
            dy = b.y - a.y,
            d = Math.hypot(dx, dy),
            radius = a.r + b.r
          if (d > radius + 0.02) continue
          const nx = d > 1e-9 ? dx / d : 1,
            ny = d > 1e-9 ? dy / d : 0,
            ia = kinematic(a) ? 0 : 1 / a.m,
            ib = kinematic(b) ? 0 : 1 / b.m,
            total = ia + ib
          if (total === 0) continue
          const overlap = Math.max(0, radius - d)
          a.x -= (nx * overlap * ia) / total
          a.y -= (ny * overlap * ia) / total
          b.x += (nx * overlap * ib) / total
          b.y += (ny * overlap * ib) / total
          if (nx * a.ax + ny * a.ay > Math.hypot(a.ax, a.ay) * 0.35) a.supported = true
          if (-nx * b.ax - ny * b.ay > Math.hypot(b.ax, b.ay) * 0.35) b.supported = true
          const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (impulse && closing < 0) {
            const e = closing < -40 ? this.restitution : 0,
              jolt = (-(1 + e) * closing) / total
            a.vx -= nx * jolt * ia
            a.vy -= ny * jolt * ia
            b.vx += nx * jolt * ib
            b.vy += ny * jolt * ib
            if (closing < -0.1) this.contacts++
          }
        }
      for (const b of this.bodies) this.walls(b, impulse)
    }
  }
  snapX(b: CircleBody, index: number) {
    return circleClamp(b.snap.u[index]! * this.width, b.r, this.width - b.r)
  }
  snapY(b: CircleBody, index: number) {
    return circleClamp(b.snap.v[index]! * this.height, b.r, this.height - b.r)
  }
  attach(
    index: number,
    enabled: boolean,
    x: number,
    y: number,
    length: number,
    stiffness: number,
    damping: number,
  ) {
    const b = this.bodies[index]!,
      a = b.attachment
    a.enabled = enabled
    a.u = x / this.width
    a.v = y / this.height
    a.length = length
    a.stiffness = stiffness
    a.damping = damping
    b.snap.active = b.snap.previousActive = false
    this.wake()
  }
  snapTo(index: number, target: number) {
    const b = this.bodies[index]!
    if (b.held || target < 0 || target >= b.snap.count) return
    b.snap.active = true
    b.snap.index = target
    this.wake()
  }
  cancel(index: number) {
    const b = this.bodies[index]!
    if (!b.held) return
    b.held = false
    b.vx = b.vy = 0
    b.snap.active = b.snap.previousActive
    b.snap.index = b.snap.previousIndex
    this.wake()
  }
  private targetClear(index: number, x: number, y: number) {
    const b = this.bodies[index]!
    return this.bodies.every(
      (other, i) =>
        i === index || Math.hypot(x - other.x, y - other.y) >= b.r + other.r + 0.001,
    )
  }
  step() {
    if (this.sleeping) return
    const decay = Math.exp(-this.damping * CIRCLE_DT)
    let still = true
    for (const b of this.bodies) {
      b.supported = b.linked = false
      b.springAX = b.springAY = 0
      b.ax = this.gx
      b.ay = this.gy
      if (kinematic(b)) {
        b.vx = (b.tx - b.x) / CIRCLE_DT
        b.vy = (b.ty - b.y) / CIRCLE_DT
      }
    }
    this.bodySprings()
    for (const b of this.bodies) {
      if (b.held) still = false
      if (kinematic(b)) {
        b.vx = (b.tx - b.x) / CIRCLE_DT
        b.vy = (b.ty - b.y) / CIRCLE_DT
        still = false
      } else {
        let damping = 0
        if ((b.held && b.drag.enabled) || b.attachment.enabled || b.snap.active) {
          let x: number, y: number, length: number, stiffness: number
          if (b.held && b.drag.enabled) {
            x = b.tx
            y = b.ty
            length = b.drag.length
            stiffness = b.drag.stiffness
            damping = b.drag.damping
          } else if (b.snap.active) {
            x = this.snapX(b, b.snap.index)
            y = this.snapY(b, b.snap.index)
            length = 0
            stiffness = b.snap.stiffness
            damping = b.snap.damping
            b.ax = b.ay = 0
          } else {
            x = b.attachment.u * this.width
            y = b.attachment.v * this.height
            length = b.attachment.length
            stiffness = b.attachment.stiffness
            damping = b.attachment.damping
          }
          const dx = b.x - x,
            dy = b.y - y,
            d = Math.hypot(dx, dy),
            nx = d > 1e-9 ? dx / d : 0,
            ny = d > 1e-9 ? dy / d : 1,
            force = (stiffness * (d - length)) / b.m
          b.ax -= force * nx
          b.ay -= force * ny
        }
        b.ax += b.springAX
        b.ay += b.springAY
        const divisor = 1 + (damping * CIRCLE_DT) / b.m
        b.vx = ((b.vx + b.ax * CIRCLE_DT) / divisor) * decay
        b.vy = ((b.vy + b.ay * CIRCLE_DT) / divisor) * decay
      }
    }
    this.bodySpringDamping()
    for (const b of this.bodies) {
      limitCircle(b)
      b.x += b.vx * CIRCLE_DT
      b.y += b.vy * CIRCLE_DT
    }
    this.solveContacts(true, 8)
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i]!
      limitCircle(b)
      const speed = Math.hypot(b.vx, b.vy),
        force = Math.hypot(b.ax, b.ay)
      let equilibrium = force <= 1e-9
      if (b.linked) equilibrium = force <= 4
      else if (b.snap.active) {
        const x = this.snapX(b, b.snap.index),
          y = this.snapY(b, b.snap.index)
        equilibrium = Math.hypot(b.x - x, b.y - y) <= 0.25
        if (equilibrium && speed <= 4 && this.targetClear(i, x, y)) {
          b.x = x
          b.y = y
          b.vx = b.vy = 0
        }
      } else if (b.attachment.enabled) {
        const dx = b.x - b.attachment.u * this.width,
          dy = b.y - b.attachment.v * this.height,
          gravity = Math.hypot(this.gx, this.gy)
        if (gravity > 1e-9) {
          const length = b.attachment.length + (b.m * gravity) / b.attachment.stiffness
          equilibrium =
            Math.hypot(
              dx - (length * this.gx) / gravity,
              dy - (length * this.gy) / gravity,
            ) <= 0.25
        } else equilibrium = Math.abs(Math.hypot(dx, dy) - b.attachment.length) <= 0.25
      }
      if (speed > 4 || (!b.supported && !equilibrium)) still = false
    }
    this.steps++
    this.quiet = still ? this.quiet + CIRCLE_DT : 0
    if (this.quiet >= 0.35) {
      this.sleeping = true
      for (const b of this.bodies) b.vx = b.vy = 0
    }
  }
  drag(index: number, x: number, y: number) {
    const b = this.bodies[index]!
    if (!b.held) {
      b.snap.previousActive = b.snap.active
      b.snap.previousIndex = b.snap.index
      b.snap.active = false
    }
    b.held = true
    const inset = b.drag.enabled ? 0 : b.r
    b.tx = circleClamp(x, inset, this.width - inset)
    b.ty = circleClamp(y, inset, this.height - inset)
    this.wake()
  }
  release(index: number, vx: number, vy: number) {
    const b = this.bodies[index]!
    if (!b.held || !b.drag.enabled) {
      b.vx = vx
      b.vy = vy
    }
    b.held = false
    limitCircle(b)
    b.released = true
    b.releaseX = b.x
    b.releaseY = b.y
    b.releaseVX = b.vx
    b.releaseVY = b.vy
    if (b.snap.count > 0) {
      const x = b.x + b.vx * b.snap.projection,
        y = b.y + b.vy * b.snap.projection
      let best = Infinity
      for (let i = 0; i < b.snap.count; i++) {
        const distance = Math.hypot(x - this.snapX(b, i), y - this.snapY(b, i))
        if (distance < best) {
          best = distance
          b.snap.index = i
        }
      }
      b.snap.active = true
    }
    this.wake()
  }
  resize(width: number, height: number) {
    for (let i = 0; i < this.bodies.length; i++) {
      this.cancel(i)
      const b = this.bodies[i]!
      b.x *= width / this.width
      b.y *= height / this.height
      b.vx = b.vy = 0
    }
    this.width = width
    this.height = height
    this.solveContacts(false, 64)
    this.wake()
  }
}
