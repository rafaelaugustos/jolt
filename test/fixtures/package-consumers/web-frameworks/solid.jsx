import { createSignal, Show, For } from 'solid-js'
import { createDirectives, createPresence } from '@rafaelaugusto/jolt/web/solid'
import { resourceSetup } from './resources.js'
export function App(props) {
  const [x, setX] = createSignal(0),
    [visible, show] = createSignal(props.initialPresence ?? true),
    [generation, replace] = createSignal(0)
  const [renders, rerender] = createSignal(0),
    [taps, tap] = createSignal(0)
  const { animate, press, motion } = createDirectives({ runtime: props.runtime })
  const { show: retained, presence } = createPresence(visible, {
    runtime: props.runtime,
    leave: ['fadeOut', { duration: 400 }],
  })
  return (
    <main>
      <div class="badge">JOLT · SOLID DOM</div>
      <h1>Motion follows your component</h1>
      <p>Interrupt, replace or remove the card. Each component owns its motion.</p>
      <div class="controls">
        <button onClick={() => setX(160)}>Move</button>
        <button onClick={() => setX(-60)}>Interrupt</button>
        <button onClick={() => rerender((n) => n + 1)}>Rerender</button>
        <button onClick={() => replace((n) => n + 1)}>Replace</button>
        <button onClick={() => show((v) => !v)}>Toggle</button>
        <button onClick={() => props.runtime.configure({ reducedMotion: 'always' })}>
          Reduce motion
        </button>
      </div>
      <div class="stage">
        <Show when={retained()}>
          <For each={[generation()]}>
            {() => (
              <button
                class="card"
                data-card
                use:presence
                use:animate={[{ x: x() }, { duration: 650, ease: 'linear' }]}
                use:press={{ scale: 0.92 }}
                onClick={() => tap((n) => n + 1)}
              >
                Press me
              </button>
            )}
          </For>
        </Show>
      </div>
      <div class="status">
        <span>
          Actions <output data-taps>{taps()}</output>
        </span>
        <span>
          Renders <output data-renders>{renders()}</output>
        </span>
        <span>
          Identity <output>{generation()}</output>
        </span>
      </div>
      <section data-resources use:motion={resourceSetup} />
    </main>
  )
}
