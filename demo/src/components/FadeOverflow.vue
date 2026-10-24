<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { isAndroid, type EventData, type View } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'
const { t } = usePreviewI18n()

const glow = ref()
const faded = ref(false)

// Let the halo draw past its container, as an app does for glows and shadows.
function unclip(event: EventData) {
  if (!isAndroid) return
  let view: View | undefined = event.object as View
  for (
    let depth = 0;
    view && depth < 3;
    depth++, view = view.parent as View | undefined
  ) {
    const native = view.nativeViewProtected as android.view.ViewGroup | undefined
    native?.setClipChildren?.(false)
  }
}

function toggle() {
  faded.value = !faded.value
  animate(glow.value, { opacity: faded.value ? 0.15 : 1 }, { duration: 900 })
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('LIGHT WITHOUT LIMITS')"
        class="ex-kicker"
        verticalAlignment="top" /><AbsoluteLayout
        ref="glow"
        width="64"
        height="64"
        clipToBounds="false"
        @loaded="unclip"
        ><Label
          left="-68"
          top="-68"
          width="200"
          height="200"
          borderRadius="100"
          backgroundColor="#334C40" /><Label
          left="-42"
          top="-42"
          width="148"
          height="148"
          borderRadius="74"
          backgroundColor="#4C6D4C" /><Label
          left="-20"
          top="-20"
          width="104"
          height="104"
          borderRadius="52"
          backgroundColor="#A5BD73" /><Label
          width="64"
          height="64"
          borderRadius="32"
          backgroundColor="#E3FC62" /></AbsoluteLayout
      ><Label
        :text="t('Let your light spill over.')"
        class="ex-copy"
        verticalAlignment="bottom" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t(faded ? 'Fade in' : 'Fade out')"
          @tap="toggle"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      :text="t('The halo reaches beyond its frame. The whole glow fades as one.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Fade overflow')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t('animate(glow, { opacity: 0.15 })')"
      />

      <GridLayout class="stage" height="200">
        <AbsoluteLayout
          ref="glow"
          width="64"
          height="64"
          clipToBounds="false"
          @loaded="unclip"
        >
          <Label class="glow-halo" left="-52" top="-52" width="168" height="168" />
          <Label class="glow-dot" width="64" height="64" />
        </AbsoluteLayout>
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'The halo is larger than the container that fades. It stays round for the whole fade.',
          )
        "
      />
      <Button class="button" :text="t(faded ? 'Fade in' : 'Fade out')" @tap="toggle" />
    </StackLayout>
  </template>
</template>
