<script lang="ts" setup>
import { usePreviewI18n } from '../showcase/i18n'
import { ref, watch } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'
import { useKeyboard } from '@rafaelaugusto/jolt/vue'
const { t } = usePreviewI18n()

defineProps<{ shown: boolean; embedded?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const keyboard = useKeyboard()
const badge = ref()

watch(keyboard, ({ visible, transition }) => {
  animate(
    badge.value,
    { scale: visible ? 0.86 : 1, opacity: visible ? 0.7 : 1 },
    transition,
  )
})
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('A SPACE FOR YOUR NEXT THOUGHT')"
        class="ex-kicker"
        verticalAlignment="top" /><GridLayout
        ref="badge"
        width="96"
        height="96"
        borderRadius="32"
        backgroundColor="#E3FC62"
        verticalAlignment="top"
        marginTop="56"
        horizontalAlignment="left"
        ><Label
          text="↗"
          fontSize="50"
          color="#2A402B"
          textAlignment="center"
          verticalAlignment="middle" /></GridLayout
      ><StackLayout verticalAlignment="bottom"
        ><Label
          :text="t('Say something\ngood.')"
          class="ex-title"
          textWrap="true" /><Label
          :text="
            t(keyboard.visible ? 'Listening. Keep going.' : 'Your words belong here.')
          "
          class="ex-copy"
          marginTop="14" /></StackLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*"
        ><Button
          col="0"
          :text="t(shown ? 'Hide composer' : 'Show composer')"
          @tap="emit('toggle')"
          class="ex-primary" /></GridLayout></StackLayout
    ><Label
      :text="t('The composer follows the keyboard, at its own pace.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Keyboard')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t('followKeyboard(composer) · onKeyboard(state)')"
      />
      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'A composer pinned to the bottom of the page rises with the keyboard, at its speed and curve, and settles back when it hides.',
          )
        "
      />
      <Label
        ref="badge"
        class="keyboard-badge"
        :text="
          t(
            keyboard.visible
              ? `Keyboard · ${Math.round(keyboard.height)} DIP · ${keyboard.duration} ms`
              : 'Keyboard hidden',
          )
        "
      />
      <Button
        class="button"
        :text="t(shown ? 'Hide composer' : 'Show composer')"
        @tap="emit('toggle')"
      />
    </StackLayout>
  </template>
</template>
