// Run the actual portable Web kernel with the same vectors as the native probes.
import { readFileSync } from 'node:fs'
import { CircleMath } from '../src/core/circle-math.ts'
const tokens = readFileSync(0, 'utf8').trim().split(/\s+/)
let at = 0
const n = () => Number(tokens[at++])
const world = new CircleMath(n())
for (const key of ['width', 'height', 'gx', 'gy', 'restitution', 'damping'])
  world[key] = n()
for (const body of world.bodies)
  for (const key of ['x', 'y', 'vx', 'vy', 'r', 'm']) body[key] = n()
while (at < tokens.length) {
  switch (tokens[at++]) {
    case 'l': {
      const s = world.springs[n()]
      s.enabled = !!n()
      for (const k of ['a', 'b', 'length', 'stiffness', 'damping']) s[k] = n()
      world.wake()
      break
    }
    case 'g': {
      const d = world.bodies[n()].drag
      d.enabled = true
      for (const k of ['length', 'stiffness', 'damping']) d[k] = n()
      break
    }
    case 's': {
      const count = n()
      for (let i = 0; i < count; i++) world.step()
      break
    }
    case 'd':
      world.drag(n(), n(), n())
      break
    case 'r':
      world.release(n(), n(), n())
      break
    case 'a':
      world.attach(n(), !!n(), n(), n(), n(), n(), n())
      break
    case 'p': {
      const s = world.bodies[n()].snap
      s.count = n()
      s.stiffness = n()
      s.damping = n()
      s.projection = n()
      for (let j = 0; j < s.count; j++) {
        s.u[j] = n() / world.width
        s.v[j] = n() / world.height
      }
      break
    }
    case 't':
      world.snapTo(n(), n())
      break
    case 'c':
      world.cancel(n())
      break
    case 'z':
      world.resize(n(), n())
      break
    default:
      throw new Error('Unknown kernel probe operation')
  }
}
console.log(world.steps, world.contacts, Number(world.sleeping))
for (const b of world.bodies) console.log(b.x, b.y, b.vx, b.vy, Number(b.held))
