<script>
  import { animate, press } from '@rafaelaugusto/jolt/svelte'
  let shown = true, side = false, identity = 0
</script>
<page actionBarHidden="true" backgroundColor="#102922">
  <stackLayout padding="24">
    <label text="Svelte · native ownership" color="#eff5da" fontSize="22" marginBottom="35" />
    {#if shown}
      {#key identity}
        <label use:animate={{ x: side ? 75 : -75 }} use:press={{ scale: 0.94 }} text="Svelte Native" automationText="framework-card" width="180" height="90" color="#102922" backgroundColor="#d6e7b5" borderRadius="18" textAlignment="center" />
      {/key}
    {/if}
    <button color="#eff5da" backgroundColor="#244b3b" height="48" marginBottom="8" text="Interrupt" automationText="framework-interrupt" on:tap={() => side = !side} marginTop="30" />
    <button color="#eff5da" backgroundColor="#244b3b" height="48" marginBottom="8" text={shown ? 'Unmount' : 'Remount'} automationText="framework-toggle" on:tap={() => shown = !shown} />
    <button color="#eff5da" backgroundColor="#244b3b" height="48" marginBottom="8" text="Replace action" automationText="framework-replace" on:tap={() => identity += 1} />
  </stackLayout>
</page>
