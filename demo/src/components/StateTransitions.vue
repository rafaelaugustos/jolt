<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { onMounted, ref } from 'nativescript-vue'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
const { t } = usePreviewI18n()

const scope = useMotionScope()
const splash = scope.states(
  { logo: null, stroke: null, title: null },
  {
    hidden: {
      logo: { opacity: 0, scale: 0.5 },
      stroke: { scaleX: 0 },
      title: { opacity: 0, y: 12 },
    },
    shown: {
      logo: { opacity: 1, scale: 1 },
      stroke: { scaleX: 1 },
      title: { opacity: 1, y: 0 },
    },
  },
)
const shown = ref(false)

function toggle() {
  shown.value = !shown.value
  if (shown.value)
    splash.to('shown', {
      type: 'spring',
      bounce: 0.4,
      duration: 600,
      stroke: { duration: 650, ease: 'cubicOut', delay: 250 },
      title: { duration: 400, ease: 'easeOut', delay: 500 },
    })
  else splash.to('hidden', { duration: 250, ease: 'easeIn' })
}

onMounted(toggle)
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage" height="390"
      ><Label
        :text="t('AN ENTRANCE IN THREE ACTS')"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout verticalAlignment="middle"
        ><GridLayout
          :ref="splash.ref('logo')"
          width="84"
          height="94"
          backgroundColor="#E3FC62"
          borderRadius="24"
          opacity="0"
          rotate="-8"
          ><Image src="~/assets/jolt-mark.png" width="62" height="70" /></GridLayout
        ><Label
          :ref="splash.ref('stroke')"
          width="150"
          height="2"
          backgroundColor="#C4B3EC"
          margin="24 0"
          originX="0"
          scaleX="0" /><Label
          :ref="splash.ref('title')"
          :text="t('Good things\nare in motion.')"
          fontSize="35"
          fontWeight="bold"
          color="#EAF0E0"
          textWrap="true"
          textAlignment="center"
          opacity="0" /></StackLayout
      ><Label
        :text="t('01  SPRING     02  DRAW     03  ARRIVE')"
        class="ex-kicker"
        textAlignment="center"
        verticalAlignment="bottom" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t(shown ? 'Hide splash' : 'Show splash')"
          @tap="toggle"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      :text="t('One state change. Three carefully timed arrivals.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Per-target transitions')" />
      <Label
        class="muted"
        textWrap="true"
        :text="
          t(
            'splash.to(\'shown\', { bounce: 0.4, stroke: { duration: 650, delay: 250 } })',
          )
        "
      />

      <StackLayout class="stage" height="190" padding="24 0">
        <Label :ref="splash.ref('logo')" class="logo" :text="t('J')" opacity="0" />
        <Label :ref="splash.ref('stroke')" class="splash-stroke" originX="0" scaleX="0" />
        <Label
          :ref="splash.ref('title')"
          class="splash-title"
          :text="t('Jolt')"
          opacity="0"
        />
      </StackLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'One controller: the logo springs in, the stroke draws with a tween 250 ms later and the title fades in last.',
          )
        "
      />
      <Button
        class="button"
        :text="t(shown ? 'Hide splash' : 'Show splash')"
        @tap="toggle"
      />
    </StackLayout>
  </template>
</template>
