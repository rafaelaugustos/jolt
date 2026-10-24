<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { onMounted, ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'
import { useMotionScope } from '@rafaelaugusto/jolt/vue'
const { t } = usePreviewI18n()

const scope = useMotionScope()
const stage = scope.states(
  { logo: null },
  {
    hidden: { logo: { opacity: 0, scale: 0.6 } },
    shown: { logo: { opacity: 1, scale: 1 } },
  },
)
const logo = stage.ref('logo')
const plain = ref()
const compact = ref(false)
const shown = ref(true)

onMounted(() => {
  stage.to('shown', 'bouncy')
  scope.animate(plain.value, { opacity: 1, scale: 1 }, 'bouncy')
})

function toggle() {
  shown.value = !shown.value
  stage.to(shown.value ? 'shown' : 'hidden')
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        :text="t('SOME THINGS STAY WITH YOU')"
        class="ex-kicker"
        verticalAlignment="top" /><GridLayout
        :key="compact ? 'compact' : 'roomy'"
        columns="*,*"
        rows="*,auto"
        verticalAlignment="middle"
        height="200"
        ><GridLayout
          :ref="logo"
          :width="compact ? 66 : 100"
          :height="compact ? 82 : 120"
          backgroundColor="#E3FC62"
          borderRadius="22"
          opacity="0"
          ><Image src="~/assets/jolt-mark.png" width="50" height="60" /></GridLayout
        ><GridLayout
          ref="plain"
          col="1"
          :width="compact ? 66 : 100"
          :height="compact ? 82 : 120"
          backgroundColor="#C1B0E3"
          borderRadius="22"
          opacity="0"
          ><Image src="~/assets/jolt-mark.png" width="50" height="60" /></GridLayout
        ><Label
          row="1"
          :text="t('REMEMBERS')"
          class="ex-kicker"
          textAlignment="center" /><Label
          row="1"
          col="1"
          :text="t('STARTS OVER')"
          class="ex-kicker"
          textAlignment="center" /></GridLayout
      ><Label
        :text="t('New view. Same feeling.')"
        class="ex-copy"
        verticalAlignment="bottom" /></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="t('Switch layout')"
          @tap="compact = !compact"
          class="ex-primary" /><Button
          col="1"
          :text="t(shown ? 'Hide logo' : 'Show logo')"
          @tap="toggle" /></GridLayout></StackLayout
    ><Label
      :text="t('Recreate the cards. The state-bound one remembers where it belongs.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Recreated views')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t(':ref=&quot;stage.ref(\'logo\')&quot;')"
      />

      <GridLayout v-if="compact" columns="*, *" class="stage" height="150">
        <Label :ref="logo" class="remount-logo small" :text="t('J')" opacity="0" />
        <Label
          ref="plain"
          col="1"
          class="remount-logo small"
          :text="t('J')"
          opacity="0"
        />
      </GridLayout>
      <GridLayout v-else columns="*, *" class="stage" height="150">
        <Label :ref="logo" class="remount-logo" :text="t('J')" opacity="0" />
        <Label ref="plain" col="1" class="remount-logo" :text="t('J')" opacity="0" />
      </GridLayout>
      <GridLayout columns="*, *">
        <Label class="caption" :text="t('States')" />
        <Label col="1" class="caption" :text="t('Entrance only')" />
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'Switching the layout creates new views. The one attached to the states comes back as it was; the other comes back with its template opacity.',
          )
        "
      />
      <GridLayout columns="*, *">
        <Button class="button" :text="t('Switch layout')" @tap="compact = !compact" />
        <Button
          col="1"
          class="button"
          :text="t(shown ? 'Hide logo' : 'Show logo')"
          @tap="toggle"
        />
      </GridLayout>
    </StackLayout>
  </template>
</template>
