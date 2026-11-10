<script>
  import { createActions, createPresence } from '@rafaelaugusto/jolt/web/svelte'
  import { resourceSetup } from './resources.js'
  export let runtime
  export let initialPresence = true
  const { animate, press, motion: resources } = createActions({ runtime })
  let x = 0, visible = initialPresence, generation = 0, renders = 0, taps = 0
  const retained = createPresence(initialPresence,{runtime,leave:['fadeOut',{duration:400}]})
  const {presence} = retained
  $: retained.set(visible)
  $: motion = [{ x }, { duration: 650, ease: 'linear' }]
</script>
<main><div class="badge">JOLT · SVELTE DOM</div><h1>Motion follows your component</h1>
  <p>Interrupt, replace or remove the card. Each component owns its motion.</p>
  <div class="controls">
    <button onclick={() => x = 160}>Move</button><button onclick={() => x = -60}>Interrupt</button>
    <button onclick={() => renders++}>Rerender</button><button onclick={() => generation++}>Replace</button>
    <button onclick={() => visible = !visible}>Toggle</button><button onclick={() => runtime.configure({ reducedMotion: 'always' })}>Reduce motion</button>
  </div>
  <div class="stage">{#if $retained}{#key generation}<button class="card" data-card use:presence use:animate={motion} use:press={{scale:.92}} onclick={() => taps++}>Press me</button>{/key}{/if}</div>
  <div class="status"><span>Actions <output data-taps>{taps}</output></span><span>Renders <output data-renders>{renders}</output></span><span>Identity <output>{generation}</output></span></div>
  <section data-resources use:resources={resourceSetup}></section>
</main>
