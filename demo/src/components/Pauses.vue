<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { ref } from 'nativescript-vue'
import { animate, set, type Animation } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()

const sleep = [ref(), ref(), ref()]
const pill = ref()
const running = ref(false)
let playing: Animation[] = []

function toggle() {
  if (running.value) {
    playing.forEach((animation) => animation.stop())
    playing = []
    sleep.forEach((z) => set(z.value, { y: 0, opacity: 0 }))
    set(pill.value, { x: 0 })
  } else {
    playing = [
      ...sleep.map((z, i) =>
        animate(
          z.value,
          { y: [0, -56], opacity: [0, 1, 0] },
          { duration: 1200, delay: i * 260, repeat: Infinity, repeatDelay: 900 },
        ),
      ),
      animate(
        pill.value,
        { x: [0, 84] },
        {
          duration: 450,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'reverse',
          repeatDelay: 700,
        },
      ),
    ]
  }
  running.value = !running.value
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('ROOM TO BREATHE')"
        class="ex-kicker"
        verticalAlignment="top" /><Label
        :text="t('Rest is part\nof the rhythm.')"
        class="ex-title"
        textWrap="true"
        verticalAlignment="top"
        marginTop="38" /><GridLayout columns="*,*" height="100" verticalAlignment="bottom"
        ><GridLayout
          ><Label
            v-for="(z, i) in sleep"
            :key="i"
            :ref="z"
            :text="t('z')"
            fontSize="32"
            fontWeight="bold"
            color="#C6B0F0"
            opacity="0"
            :marginLeft="i * 22"
            verticalAlignment="bottom" /><Label
            text="☾"
            fontSize="50"
            color="#C6B0F0"
            horizontalAlignment="left"
            verticalAlignment="bottom" /></GridLayout
        ><GridLayout
          col="1"
          width="128"
          height="48"
          backgroundColor="#34493C"
          borderRadius="24"
          verticalAlignment="bottom"
          ><Label
            ref="pill"
            width="40"
            height="40"
            borderRadius="20"
            backgroundColor="#E3FC62"
            horizontalAlignment="left"
            marginLeft="2" /></GridLayout></GridLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t(running ? 'Stop pauses' : 'Play pauses')"
          @tap="toggle"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      :text="t('Float. Pause. Come back for more.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Pauses')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t('{ repeat: Infinity, repeatDelay: 900 }')"
      />

      <GridLayout columns="*, *" class="stage" height="140">
        <GridLayout paddingLeft="28">
          <Label
            v-for="(z, i) in sleep"
            :key="i"
            :ref="z"
            class="sleep"
            :text="t('z')"
            opacity="0"
            :marginLeft="i * 18"
          />
        </GridLayout>
        <GridLayout col="1" class="lane pause-lane" height="48">
          <Label
            ref="pill"
            class="ball"
            width="40"
            height="40"
            horizontalAlignment="left"
          />
        </GridLayout>
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t('Each z rests 900 ms between floats. The pill waits 700 ms at both ends.')
        "
      />
      <Button
        class="button"
        :text="t(running ? 'Stop pauses' : 'Play pauses')"
        @tap="toggle"
      />
    </StackLayout>
  </template>
</template>
