import type { RigDefinition } from '../../src/core/rig.js'

/** The same articulated character definition is consumed by native and browser demos. */
export const companionRig = {
  parts: {
    body: { rest: { rotate: 0 } },
    head: { parent: 'body', pivot: { x: 0.5, y: 1 }, rest: { rotate: 0 } },
    hand: {
      parent: 'body',
      pivot: { x: 0.5, y: 0.1 },
      rest: { rotate: 0 },
      rotation: [-70, 70],
    },
  },
  poses: {
    rest: {},
    wave: { head: { rotate: -15 }, hand: { rotate: -55 } },
    reach: { body: { rotate: 12 }, head: { rotate: 15 }, hand: { rotate: 110 } },
  },
  sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
} satisfies RigDefinition
