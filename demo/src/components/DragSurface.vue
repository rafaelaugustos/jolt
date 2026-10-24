<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { onMounted, ref } from 'nativescript-vue'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
import { interactionSurface } from '@rafaelaugusto/jolt'
import type { DragEvent, DragRelease } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()
const scope = useMotionScope()
const surface = ref()
const card = ref(),
  panel = ref()
const status = ref('Drag the card or panel')
const paused = ref(false)
const track = (name: string, event: DragEvent) => {
  status.value = `${t(name)} · ${Math.round(event.x)}, ${Math.round(event.y)}`
}
const released = (name: string, event: DragRelease) => {
  status.value = `${t(name)} → ${Math.round(event.target.x)}, ${Math.round(event.target.y)}`
}
function toggle() {
  paused.value = !paused.value
  if (paused.value) scope.suspend()
  else scope.resume()
  status.value = paused.value ? 'Paused' : 'Drag the card or panel'
}
onMounted(() => {
  scope.use(() => interactionSurface(surface.value))
  scope.drag(card.value, {
    axis: 'x',
    bounds: { left: -90, right: 90 },
    rubberband: true,
    onMove: (event) => track('Card', event),
    onRelease: (event) => released('Card', event),
    onSettle: (point) => (status.value = `Card settled · ${Math.round(point.x)}`),
  })
  scope.drag(panel.value, {
    axis: 'y',
    bounds: { top: 0, bottom: 140 },
    snap: [0, 70, 140],
    rubberband: true,
    onMove: (event) => track('Panel', event),
    onRelease: (event) => released('Panel', event),
    onSettle: (point) => (status.value = `Panel settled · ${Math.round(point.y)}`),
  })
})
defineProps<{ embedded?: boolean }>()
</script>
<template>
  <StackLayout v-if="embedded" class="exhibit">
    <StackLayout ref="surface"
      ><GridLayout height="196" backgroundColor="#E2E8D7" borderRadius="28" padding="20"
        ><Label
          :text="t('A LITTLE ROOM TO ROAM')"
          color="#7A886B"
          fontSize="9"
          letterSpacing=".1"
          verticalAlignment="top" /><GridLayout
          ref="card"
          width="116"
          height="104"
          borderRadius="22"
          backgroundColor="#344E38"
          :accessibilityLabel="t('Drag card')"
          marginTop="20"
          ><StackLayout verticalAlignment="middle"
            ><Label text="↔" fontSize="38" color="#E3FC62" textAlignment="center" /><Label
              :text="t('LET IT SLIDE')"
              fontSize="8"
              color="#D4E2C1"
              textAlignment="center"
              marginTop="6" /></StackLayout></GridLayout></GridLayout
      ><GridLayout
        height="250"
        backgroundColor="#E6E1EE"
        borderRadius="28"
        marginTop="16"
        padding="12"
        ><Label
          v-for="i in 3"
          :key="i"
          text="· · · · · · · · · · · · · · · · ·"
          color="#B8ABCD"
          fontSize="18"
          verticalAlignment="top"
          :marginTop="i * 70 - 20"
          textAlignment="center" /><StackLayout
          ref="panel"
          width="248"
          height="88"
          verticalAlignment="top"
          borderRadius="22"
          backgroundColor="#635274"
          :accessibilityLabel="t('Drag panel')"
          padding="14"
          ><Label
            width="36"
            height="4"
            borderRadius="2"
            backgroundColor="#B8A4D1" /><Label
            :text="t('Find your place.')"
            color="#F2EAF8"
            fontSize="20"
            fontWeight="bold"
            textAlignment="center"
            marginTop="16" /></StackLayout></GridLayout
      ><Label :text="t(status)" class="ex-note" textWrap="true" /><StackLayout
        class="ex-controls"
        ><GridLayout columns="*"
          ><Button
            col="0"
            :text="t(paused ? 'Resume drag' : 'Pause drag')"
            @tap="toggle" /></GridLayout></StackLayout
    ></StackLayout>
  </StackLayout>
  <template v-else>
    <StackLayout ref="surface">
      <Label :text="t('Fling the card · bounded decay')" class="muted" />
      <GridLayout height="130" backgroundColor="#edf1e8" borderRadius="18" marginTop="8">
        <GridLayout
          ref="card"
          width="116"
          height="82"
          borderRadius="18"
          backgroundColor="#334b29"
          :accessibilityLabel="t('Drag card')"
        >
          <Label
            text="↔"
            fontSize="32"
            color="#c4f58b"
            horizontalAlignment="center"
            verticalAlignment="middle"
          />
        </GridLayout>
      </GridLayout>
      <Label
        :text="t('Slide the panel · three snap points')"
        class="muted"
        marginTop="14"
      />
      <GridLayout height="248" marginTop="8" backgroundColor="#e9edf4" borderRadius="18">
        <StackLayout
          ref="panel"
          width="248"
          height="88"
          verticalAlignment="top"
          borderRadius="18"
          backgroundColor="#243e61"
          :accessibilityLabel="t('Drag panel')"
          padding="16"
        >
          <GridLayout width="40" height="5" backgroundColor="#bdd6ff" borderRadius="3" />
          <Label
            :text="t('Pull me up or down')"
            color="white"
            horizontalAlignment="center"
            marginTop="14"
          />
        </StackLayout>
      </GridLayout>
      <Label :text="t(status)" textWrap="true" marginTop="12" />
      <Button :text="t(paused ? 'Resume drag' : 'Pause drag')" @tap="toggle" />
    </StackLayout>
  </template>
</template>
