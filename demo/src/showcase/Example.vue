<script setup lang="ts">
import { useThemeReveal } from './theme-reveal'
import { palette, themeClass, statusBarStyle, useThemedInput } from './theme'
import { usePreviewI18n } from './i18n'
import { ref, onUnmounted } from 'nativescript-vue'
import { isIOS, type EventData, type View } from '@nativescript/core'
import { followKeyboard, configure } from '@rafaelaugusto/jolt'
import { useRoute, useRouter } from 'vue-router-ns'
import { examples } from './catalog'
const { t, locale } = usePreviewI18n()
const inputTheme = useThemedInput()
const route = useRoute(),
  router = useRouter()
const example = examples.find((e) => e.id === route.params.id)
const atelier = example?.category === 'SceneKit' && !!example?.ios && isIOS
const mounted = ref(true),
  composer = ref(false),
  message = ref('')
let unfollow: (() => void) | undefined
function keyboardLoaded(event: EventData) {
  unfollow?.()
  unfollow = followKeyboard(event.object as View)
}
function clean() {
  unfollow?.()
  unfollow = undefined
  configure({ reducedMotion: 'user', timeScale: 1 })
}
function leave() {
  // An interactive pop previews the retained page before navigatedTo commits.
  if (example?.id === 'interactive-navigation') return
  mounted.value = false
  clean()
}
onUnmounted(clean)
const themeReveal = useThemeReveal()
function enter() {
  mounted.value = true
  themeReveal.enter()
}
</script>
<template>
  <Page
    :id="example?.id"
    actionBarHidden="true"
    :backgroundColor="palette.background"
    :color="palette.text"
    :androidStatusBarBackground="palette.background"
    :statusBarStyle="statusBarStyle"
    :class="[themeClass, 'studio-example-page']"
    @navigatedTo="enter"
    @navigatingFrom="themeReveal.leave"
    @navigatedFrom="leave"
  >
    <GridLayout
      rows="60,auto,*,auto"
      :backgroundColor="palette.background"
      @loaded="themeReveal.loaded"
      @unloaded="themeReveal.unloaded"
    >
      <GridLayout columns="auto,*,auto" padding="8 24">
        <Label
          text="←"
          width="38"
          height="38"
          borderRadius="19"
          :backgroundColor="palette.surface"
          :color="palette.text"
          fontSize="24"
          textAlignment="center"
          verticalAlignment="middle"
          @tap="router.back()"
          accessibilityRole="button"
          :accessibilityLabel="t('Back to collection')"
        />
        <Label
          col="1"
          :text="t(example?.category || 'Collection').toUpperCase()"
          class="studio-eyebrow"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Image
          col="2"
          src="~/assets/jolt-mark.png"
          width="23"
          height="27"
          stretch="aspectFit"
          :tintColor="palette.text"
        />
      </GridLayout>
      <StackLayout row="1" padding="12 24 20"
        ><Label
          :text="t(example?.title || 'Not found')"
          fontSize="32"
          fontWeight="bold"
          :color="palette.text"
          textWrap="true" /><Label
          :text="t(example?.description || 'Go back to choose an experiment.')"
          fontSize="14"
          :color="palette.muted"
          textWrap="true"
          marginTop="7"
      /></StackLayout>
      <StackLayout v-if="example?.ios && !isIOS" row="2" padding="24"
        ><Label
          :text="
            t(example.category === 'SceneKit' ? 'Made for SceneKit' : 'Available on iOS')
          "
          fontSize="24"
          fontWeight="bold" /><Label
          :text="
            t(
              'Open this experiment on iOS. There is plenty more to explore in the collection.',
            )
          "
          textWrap="true"
          marginTop="12"
      /></StackLayout>
      <GridLayout
        v-else-if="example?.full"
        row="2"
        borderRadius="24"
        :margin="atelier ? '0' : '0 12 12'"
        clipToBounds="true"
        ><component
          v-if="mounted"
          :is="example.component"
          :key="locale"
          :mode="example.id"
          :embedded="true"
          @back="router.back()"
      /></GridLayout>
      <ScrollView v-else-if="example" row="2" scrollBarIndicatorVisible="false"
        ><StackLayout padding="0 12 28"
          ><component
            v-if="mounted"
            :is="example.component"
            :key="locale"
            :mode="example.id"
            :embedded="true"
            :shown="composer"
            @toggle="composer = !composer"
            @back="router.back()" /><Label
            :text="t('Yours to play with.')"
            class="studio-eyebrow"
            textAlignment="center"
            margin="28 0" /></StackLayout
      ></ScrollView>
      <GridLayout
        v-if="composer"
        row="3"
        columns="*,auto"
        class="composer"
        @loaded="keyboardLoaded"
        ><TextField
          v-model="message"
          @loaded="inputTheme.loaded"
          @unloaded="inputTheme.unloaded"
          :hint="t('Try the keyboard…')"
          class="composer-input" /><Button
          col="1"
          :text="t('Done')"
          class="button"
          @tap="composer = false"
      /></GridLayout>
    </GridLayout>
  </Page>
</template>
