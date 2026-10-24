<script setup lang="ts">
import { useThemeReveal } from './theme-reveal'
import { palette, themeClass, statusBarStyle } from './theme'
import { usePreviewI18n } from './i18n'
import { ref, onUnmounted } from 'nativescript-vue'
import { animate, motionScope, reducedMotion } from '@rafaelaugusto/jolt'
import { useRouter } from 'vue-router-ns'
import { examples } from './catalog'
const { t, locale } = usePreviewI18n()
const router = useRouter()
const left = ref(),
  right = ref(),
  middle = ref()
let scope = motionScope()
function stop() {
  scope.dispose()
}
function start() {
  themeReveal.enter()
  stop()
  scope = motionScope()
  if (reducedMotion()) return
  scope.add(
    animate(
      left.value,
      { y: [0, -12, 0], rotate: [-12, -7, -12] },
      { duration: 4200, repeat: Infinity, ease: 'sineInOut' },
    ),
  )
  scope.add(
    animate(
      right.value,
      { y: [0, 14, 0], rotate: [12, 6, 12] },
      { duration: 3600, repeat: Infinity, ease: 'sineInOut' },
    ),
  )
  scope.add(
    animate(
      middle.value,
      { y: [0, -7, 0] },
      { duration: 2800, repeat: Infinity, ease: 'sineInOut' },
    ),
  )
}
onUnmounted(stop)
function open(id: string) {
  void router.push(`/example/${id}`, { transition: { name: 'slideLeft', duration: 280 } })
}
function collection(category = 'All') {
  void router.push({ name: 'collection', query: { category } })
}
const themeReveal = useThemeReveal()
function leave() {
  stop()
  themeReveal.leave()
}
</script>
<template>
  <Page
    actionBarHidden="true"
    :backgroundColor="palette.background"
    :color="palette.text"
    :class="themeClass"
    :statusBarStyle="statusBarStyle"
    :androidStatusBarBackground="palette.background"
    @navigatedTo="start"
    @navigatingFrom="leave"
  >
    <GridLayout
      rows="*,72"
      :backgroundColor="palette.background"
      @loaded="themeReveal.loaded"
      @unloaded="themeReveal.unloaded"
    >
      <ScrollView row="0" scrollBarIndicatorVisible="false">
        <StackLayout padding="12 24 28">
          <GridLayout columns="36,*,auto,auto" height="44" marginBottom="26">
            <Image
              src="~/assets/jolt-mark.png"
              width="27"
              height="31"
              stretch="aspectFit"
              :tintColor="palette.text"
              horizontalAlignment="left"
            />
            <Label col="1" :text="t('jolt.')" class="studio-wordmark" />
            <Label
              col="2"
              :text="'◎  ' + t('Language')"
              fontSize="12"
              :color="palette.controlText"
              :backgroundColor="palette.surface"
              padding="12 14"
              borderRadius="18"
              verticalAlignment="middle"
              @tap="router.push('/language')"
              accessibilityRole="button"
              :accessibilityLabel="t('Language settings')"
              automationText="language-settings"
            />
            <Label
              col="3"
              text="◐"
              fontSize="23"
              width="44"
              height="44"
              marginLeft="8"
              borderRadius="22"
              :backgroundColor="palette.surface"
              :color="palette.controlText"
              textAlignment="center"
              verticalAlignment="middle"
              @tap="router.push('/appearance')"
              accessibilityRole="button"
              :accessibilityLabel="t('Appearance settings')"
              automationText="appearance-settings"
            />
          </GridLayout>
          <Label
            :text="t('Small details.\nBig feelings.')"
            class="studio-display"
            :fontSize="locale === 'pt-BR' ? 36 : 42"
            textWrap="true"
          />
          <Label
            :text="t('A collection of things that move you.')"
            class="studio-subtitle"
            margin="12 0 24"
            textWrap="true"
          />
          <GridLayout
            height="224"
            borderRadius="28"
            backgroundColor="#20242D"
            clipToBounds="true"
            @tap="open('springs')"
            accessibilityRole="button"
            :accessibilityLabel="t('Play with springs')"
          >
            <Label
              :text="t('01 / THE ART OF FEELING')"
              color="#B5BBC2"
              fontSize="9"
              letterSpacing=".14"
              verticalAlignment="top"
              horizontalAlignment="left"
              margin="22"
            />
            <GridLayout
              ref="left"
              width="92"
              height="110"
              borderRadius="23"
              backgroundColor="#B7ACE5"
              rotate="-12"
              translateX="-65"
              translateY="0"
              verticalAlignment="middle"
              horizontalAlignment="center"
              marginTop="14"
            >
              <GridLayout width="58" height="58">
                <Label
                  v-for="angle in [0, 45, 90, 135]"
                  :key="angle"
                  width="58"
                  height="8"
                  borderRadius="4"
                  :rotate="angle"
                  backgroundColor="#343040"
                  verticalAlignment="middle"
                />
              </GridLayout>
            </GridLayout>
            <GridLayout
              ref="right"
              width="92"
              height="110"
              borderRadius="23"
              backgroundColor="#F4A98E"
              rotate="12"
              translateX="65"
              verticalAlignment="middle"
              horizontalAlignment="center"
              marginTop="14"
            >
              <GridLayout
                width="45"
                height="45"
                borderRadius="23"
                borderWidth="9"
                borderColor="#643E34"
              />
            </GridLayout>
            <GridLayout
              ref="middle"
              width="100"
              height="118"
              borderRadius="25"
              backgroundColor="#E3FC62"
              verticalAlignment="middle"
              horizontalAlignment="center"
              marginTop="14"
            >
              <Image
                src="~/assets/jolt-mark.png"
                width="69"
                height="69"
                stretch="aspectFit"
              />
            </GridLayout>
            <GridLayout columns="*,auto" verticalAlignment="bottom" margin="0 22 19">
              <Label :text="t('Touch. Feel. Repeat.')" color="#FCFCF7" fontSize="13" />
              <Label col="1" text="↗" color="#E3FC62" fontSize="20" />
            </GridLayout>
          </GridLayout>
          <GridLayout columns="*,auto" margin="28 0 15">
            <Label :text="t('Start with a feeling')" class="studio-section-title" />
            <Label
              col="1"
              text="01 — 02"
              class="studio-eyebrow"
              verticalAlignment="middle"
            />
          </GridLayout>
          <GridLayout columns="*,12,*">
            <StackLayout
              col="0"
              class="studio-feature"
              :backgroundColor="palette.lavender"
              @tap="open('springs')"
              accessibilityRole="button"
              :accessibilityLabel="t('Open Springs')"
            >
              <GridLayout height="52" marginBottom="18">
                <Label
                  width="74"
                  height="3"
                  backgroundColor="#CCC6E0"
                  verticalAlignment="middle"
                  horizontalAlignment="left"
                />
                <Label
                  width="37"
                  height="37"
                  borderRadius="19"
                  backgroundColor="#7D6BBA"
                  horizontalAlignment="left"
                  marginLeft="38"
                />
              </GridLayout>
              <Label :text="t('Springs')" class="studio-card-title" />
              <Label
                :text="t('A little bounce. A lot of life.')"
                textWrap="true"
                class="studio-card-copy"
              />
              <Label
                :text="t('PLAY WITH IT  ↗')"
                class="studio-small-action"
                marginTop="18"
              />
            </StackLayout>
            <StackLayout
              col="2"
              class="studio-feature"
              :backgroundColor="palette.sage"
              @tap="open('gesture-lab')"
              accessibilityRole="button"
              :accessibilityLabel="t('Open Native gestures')"
            >
              <GridLayout height="52" marginBottom="18">
                <Label
                  width="39"
                  height="45"
                  borderRadius="11"
                  backgroundColor="#9CA880"
                  rotate="-15"
                  horizontalAlignment="left"
                  marginLeft="12"
                />
                <Label
                  width="39"
                  height="45"
                  borderRadius="11"
                  backgroundColor="#303B2F"
                  rotate="10"
                  horizontalAlignment="left"
                  marginLeft="35"
                />
              </GridLayout>
              <Label :text="t('Gestures')" class="studio-card-title" />
              <Label
                :text="t('Go on. Make the first move.')"
                textWrap="true"
                class="studio-card-copy"
              />
              <Label
                :text="t('GET HANDS ON  ↗')"
                class="studio-small-action"
                marginTop="18"
              />
            </StackLayout>
          </GridLayout>
          <GridLayout
            columns="*,auto"
            class="studio-explore"
            @tap="collection()"
            accessibilityRole="button"
            :accessibilityLabel="t('Explore all examples')"
          >
            <StackLayout
              ><Label
                :text="t('The whole collection')"
                fontSize="19"
                fontWeight="bold"
                color="#20242D" /><Label
                :text="t(`${examples.length} experiments. Endless possibilities.`)"
                fontSize="12"
                color="#575D4A"
                marginTop="6"
            /></StackLayout>
            <Label
              col="1"
              text="↗"
              fontSize="30"
              verticalAlignment="middle"
              color="#20242D"
            />
          </GridLayout>
          <GridLayout columns="*,auto" marginTop="28"
            ><Label :text="t('BUILT WITH JOLT')" class="studio-eyebrow" /><Label
              col="1"
              :text="t('Native by nature.')"
              class="studio-eyebrow"
          /></GridLayout>
        </StackLayout>
      </ScrollView>
      <GridLayout row="1" columns="*,*" class="studio-bottom">
        <Label
          :text="t('◉  Studio')"
          class="studio-tab-active"
          verticalAlignment="middle"
          textAlignment="center"
        />
        <Label
          col="1"
          :text="t('▦  Collection')"
          class="studio-tab"
          verticalAlignment="middle"
          textAlignment="center"
          @tap="collection()"
          accessibilityRole="button"
          :accessibilityLabel="t('Collection')"
        />
      </GridLayout>
    </GridLayout>
  </Page>
</template>
