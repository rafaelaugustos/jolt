import React, { StrictMode, useRef, useState } from 'react'
import {
  useAnimate,
  usePress,
  usePresence,
  useMotion,
} from '@rafaelaugusto/jolt/web/react'
import { resourceSetup } from './resources.js'
export function App({ runtime, initialPresence = true }) {
  const [x, setX] = useState(0),
    [visible, show] = useState(initialPresence),
    [generation, replace] = useState(0)
  const [renders, rerender] = useState(0),
    [taps, tap] = useState(0)
  const ref = useRef(null),
    resources = useRef(null)
  const retained = usePresence(ref, visible, {
    runtime,
    leave: ['fadeOut', { duration: 400 }],
  })
  useMotion(resources, resourceSetup, { runtime })
  useAnimate(ref, [{ x }, { duration: 650, ease: 'linear' }], { runtime })
  usePress(ref, { scale: 0.92 }, { runtime })
  return (
    <main>
      <div className="badge">JOLT · REACT DOM</div>
      <h1>Motion follows your component</h1>
      <p>Interrupt, replace or remove the card. Each component owns its motion.</p>
      <div className="controls">
        <button onClick={() => setX(160)}>Move</button>
        <button onClick={() => setX(-60)}>Interrupt</button>
        <button onClick={() => rerender((n) => n + 1)}>Rerender</button>
        <button onClick={() => replace((n) => n + 1)}>Replace</button>
        <button onClick={() => show((v) => !v)}>Toggle</button>
        <button onClick={() => runtime.configure({ reducedMotion: 'always' })}>
          Reduce motion
        </button>
      </div>
      <div className="stage">
        {retained && (
          <button
            key={generation}
            ref={ref}
            className="card"
            data-card
            onClick={() => tap((n) => n + 1)}
          >
            Press me
          </button>
        )}
      </div>
      <div className="status">
        <span>
          Actions <output data-taps>{taps}</output>
        </span>
        <span>
          Renders <output data-renders>{renders}</output>
        </span>
        <span>
          Identity <output>{generation}</output>
        </span>
      </div>
      <section ref={resources} data-resources />
    </main>
  )
}
export const Tree = (props) => (
  <StrictMode>
    <App {...props} />
  </StrictMode>
)
