<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { JoltTransition, vAnimate, vPress } from '@rafaelaugusto/jolt/vue'

const entrance = ref<'fadeInUp' | 'popIn'>('fadeInUp')
const banner = ref(true)
const tilt = { scale: 0.9, rotate: -4 }
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Vue" />
    <Label
      class="muted"
      textWrap="true"
      text="v-animate, v-press and <JoltTransition> from @rafaelaugusto/jolt/vue"
    />

    <Label
      v-animate="[entrance, { delay: 100 }]"
      class="tile"
      :text="`v-animate=&quot;${entrance}&quot;`"
    />
    <GridLayout columns="*, *" class="tiles">
      <Label v-press class="tile" text="v-press" />
      <Label v-press="[tilt, 'bouncy']" col="1" class="tile" text="v-press + options" />
    </GridLayout>

    <JoltTransition enter="popIn" leave="fadeOut">
      <Label
        v-if="banner"
        class="row"
        text="Vue keeps this row until fadeOut settles"
        textWrap="true"
      />
    </JoltTransition>

    <GridLayout columns="*, *">
      <Button
        class="button"
        :text="banner ? 'Hide row' : 'Show row'"
        @tap="banner = !banner"
      />
      <Button
        col="1"
        class="button"
        text="Change entrance"
        @tap="entrance = entrance === 'fadeInUp' ? 'popIn' : 'fadeInUp'"
      />
    </GridLayout>
  </StackLayout>
</template>
