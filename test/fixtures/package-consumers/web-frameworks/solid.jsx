import { createSignal, Show, For } from 'solid-js'
import { createDirectives } from '@rafaelaugusto/jolt/web/solid'
export function App(props) {
  const [x, setX] = createSignal(0),
    [visible, show] = createSignal(true),
    [generation, replace] = createSignal(0)
  const [renders, rerender] = createSignal(0),
    [taps, tap] = createSignal(0)
  const { animate, press } = createDirectives({ runtime: props.runtime })
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
        <Show when={visible()}>
          <For each={[generation()]}>
            {() => (
              <button
                class="card"
                data-card
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
    </main>
  )
}
