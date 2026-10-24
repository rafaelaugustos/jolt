<script setup lang="ts">
import { usePreviewI18n } from './i18n'
import { ref, onUnmounted } from 'nativescript-vue'
import { isIOS, type EventData, type View } from '@nativescript/core'
import { followKeyboard, configure } from '@rafaelaugusto/jolt'
import { useRoute, useRouter } from 'vue-router-ns'
import { examples } from './catalog'
const { t, locale } = usePreviewI18n()
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
  mounted.value = false
  clean()
}
onUnmounted(clean)
</script>
<template>
  <Page
    actionBarHidden="true"
    :backgroundColor="atelier ? '#0B1016' : '#F6F5F0'"
    :statusBarStyle="atelier ? 'light' : 'dark'"
    class="studio-example-page"
    @navigatedTo="mounted = true"
    @navigatedFrom="leave"
  >
    <GridLayout rows="60,auto,*,auto">
      <GridLayout columns="auto,*,auto" padding="8 24">
        <Label
          text="←"
          width="38"
          height="38"
          borderRadius="19"
          :backgroundColor="atelier ? '#1B2831' : '#E9EAE2'"
          :color="atelier ? '#D9E5E9' : '#20242D'"
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
        />
      </GridLayout>
      <StackLayout row="1" padding="12 24 20"
        ><Label
          :text="t(example?.title || 'Not found')"
          fontSize="32"
          fontWeight="bold"
          :color="atelier ? '#E7EEF1' : '#20242D'"
          textWrap="true" /><Label
          :text="t(example?.description || 'Go back to choose an experiment.')"
          fontSize="14"
          color="#7C8076"
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
