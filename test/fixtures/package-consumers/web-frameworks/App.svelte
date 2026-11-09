<script>
  import { createActions } from '@rafaelaugusto/jolt/web/svelte'
  export let runtime
  const { animate, press } = createActions({ runtime })
  let x = 0, visible = true, generation = 0, renders = 0, taps = 0
  $: motion = [{ x }, { duration: 650, ease: 'linear' }]
</script>
<main><div class="badge">JOLT · SVELTE DOM</div><h1>Motion follows your component</h1>
  <p>Interrupt, replace or remove the card. Each component owns its motion.</p>
  <div class="controls">
    <button onclick={() => x = 160}>Move</button><button onclick={() => x = -60}>Interrupt</button>
    <button onclick={() => renders++}>Rerender</button><button onclick={() => generation++}>Replace</button>
    <button onclick={() => visible = !visible}>Toggle</button><button onclick={() => runtime.configure({ reducedMotion: 'always' })}>Reduce motion</button>
  </div>
  <div class="stage">{#if visible}{#key generation}<button class="card" data-card use:animate={motion} use:press={{scale:.92}} onclick={() => taps++}>Press me</button>{/key}{/if}</div>
  <div class="status"><span>Actions <output data-taps>{taps}</output></span><span>Renders <output data-renders>{renders}</output></span><span>Identity <output>{generation}</output></span></div>
</main>
