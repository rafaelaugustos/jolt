<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { JoltTransition, vAnimate, vPress } from '@rafaelaugusto/jolt/vue'

const entrance = ref<'fadeInUp' | 'popIn'>('fadeInUp')
const banner = ref(true)
const tilt = { scale: 0.9, rotate: -4 }
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="A LITTLE REACTIVITY GOES A LONG WAY"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout verticalAlignment="middle"
        ><Label
          v-animate="[entrance, { delay: 100 }]"
          text="Hello,&#10;possibility."
          class="ex-title"
          textWrap="true" /><GridLayout columns="*,12,*" height="54" marginTop="24"
          ><Label
            v-press
            text="HOLD ME"
            color="#33482D"
            backgroundColor="#E3FC62"
            borderRadius="16"
            padding="20 0"
            textAlignment="center"
            fontSize="11"
            accessibilityLabel="Press with Vue" /><Label
            v-press="[tilt, 'bouncy']"
            col="2"
            text="TWIST ME"
            color="#443854"
            backgroundColor="#C7B5E9"
            borderRadius="16"
            padding="20 0"
            textAlignment="center"
            fontSize="11"
            accessibilityLabel="Tilt with Vue" /></GridLayout
        ><JoltTransition enter="popIn" leave="fadeOut"
          ><Label
            v-if="banner"
            text="A new idea just arrived.  ↗"
            color="#C4D4AE"
            fontSize="14"
            marginTop="22" /></JoltTransition></StackLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="banner ? 'Hide row' : 'Show row'"
          @tap="banner = !banner"
          class="ex-primary" /><Button
          col="1"
          text="Change entrance"
          @tap="
            entrance = entrance === 'fadeInUp' ? 'popIn' : 'fadeInUp'
          " /></GridLayout></StackLayout
    ><Label
      text="Press, appear and disappear. Connected to Vue."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
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
</template>
