<script setup lang="ts">
import type { EventData } from '@nativescript/core'
import { useThemeReveal } from './theme-reveal'
import { useRouter } from 'vue-router-ns'
import { usePreviewI18n } from './i18n'
import {
  appearance,
  colorMode,
  palette,
  setAppearance,
  statusBarStyle,
  themeClass,
} from './theme'
import { palettes, type ThemePreference } from './theme-model'
const { t } = usePreviewI18n()
const router = useRouter()
const options: {
  value: ThemePreference
  title: string
  subtitle: string
  glyph: string
}[] = [
  {
    value: 'light',
    title: 'Light',
    subtitle: 'A little light. A fresh perspective.',
    glyph: '☀',
  },
  { value: 'dark', title: 'Dark', subtitle: 'Less glare. The same spark.', glyph: '☾' },
  {
    value: 'system',
    title: 'System',
    subtitle: 'Follow your device’s appearance.',
    glyph: '◐',
  },
]
const themeReveal = useThemeReveal()
function choose(value: ThemePreference, event: EventData) {
  themeReveal.fromTap(event)
  setAppearance(value)
}
</script>
<template>
  <Page
    actionBarHidden="true"
    @navigatedTo="themeReveal.enter"
    @navigatingFrom="themeReveal.leave"
    :class="themeClass"
    :backgroundColor="palette.background"
    :color="palette.text"
    :statusBarStyle="statusBarStyle"
    :androidStatusBarBackground="palette.background"
  >
    <GridLayout
      rows="60,*"
      :backgroundColor="palette.background"
      @loaded="themeReveal.loaded"
      @unloaded="themeReveal.unloaded"
    >
      <GridLayout columns="auto,*,auto" padding="8 24">
        <Label
          text="←"
          class="appearance-back"
          @tap="router.back()"
          accessibilityRole="button"
          :accessibilityLabel="t('Back to Studio')"
          automationText="appearance-back"
        />
        <Label
          col="1"
          :text="t('Appearance').toUpperCase()"
          class="studio-eyebrow"
          horizontalAlignment="center"
          verticalAlignment="middle"
        />
        <Image
          col="2"
          src="~/assets/jolt-mark.png"
          width="25"
          height="29"
          stretch="aspectFit"
          :tintColor="palette.text"
        />
      </GridLayout>
      <ScrollView row="1" scrollBarIndicatorVisible="false">
        <StackLayout padding="22 24 32">
          <Label
            :text="t('A different light.\nStill your Studio.')"
            fontSize="38"
            fontWeight="bold"
            letterSpacing="-.04"
            textWrap="true"
          />
          <Label
            :text="t('Set the mood for your collection.')"
            class="studio-subtitle"
            margin="14 0 24"
            textWrap="true"
          />
          <GridLayout
            columns="*,12,*"
            height="118"
            marginBottom="26"
            accessibilityHidden="true"
            isUserInteractionEnabled="false"
          >
            <StackLayout
              v-for="(mode, i) in ['light', 'dark'] as const"
              :key="mode"
              :col="i * 2"
              :backgroundColor="palettes[mode].background"
              borderRadius="22"
              borderWidth="1"
              :borderColor="palette.border"
              padding="16"
            >
              <Label
                :text="t('jolt.')"
                :color="palettes[mode].text"
                fontSize="20"
                fontWeight="bold"
              />
              <GridLayout columns="*,8,*" marginTop="12" height="38">
                <Label backgroundColor="#B7ACE5" borderRadius="10" />
                <Label col="2" backgroundColor="#E3FC62" borderRadius="10" />
              </GridLayout>
            </StackLayout>
          </GridLayout>
          <GridLayout
            v-for="option in options"
            :key="option.value"
            columns="44,*,24"
            padding="19 18"
            marginBottom="12"
            borderRadius="22"
            :backgroundColor="
              appearance === option.value ? palette.selected : palette.surface
            "
            @tap="choose(option.value, $event)"
            accessibilityRole="button"
            :accessibilityLabel="
              t(option.title) + (appearance === option.value ? ', ' + t('Selected') : '')
            "
            :automationText="'appearance-' + option.value"
          >
            <Label
              :text="option.glyph"
              fontSize="26"
              :color="
                appearance === option.value ? palette.selectedText : palette.controlText
              "
              verticalAlignment="middle"
            />
            <StackLayout col="1" paddingRight="8">
              <Label
                :text="t(option.title)"
                fontSize="18"
                fontWeight="bold"
                :color="appearance === option.value ? palette.selectedText : palette.text"
              />
              <Label
                :text="t(option.subtitle)"
                fontSize="12"
                :color="
                  appearance === option.value ? palette.selectedMuted : palette.muted
                "
                marginTop="6"
                textWrap="true"
              />
            </StackLayout>
            <Label
              col="2"
              :text="appearance === option.value ? '✓' : '○'"
              fontSize="21"
              :color="appearance === option.value ? palette.selectedText : palette.subtle"
              verticalAlignment="middle"
            />
          </GridLayout>
          <Label
            :text="
              t(
                colorMode === 'dark'
                  ? 'Dark appearance is on.'
                  : 'Light appearance is on.',
              )
            "
            class="studio-subtitle"
            textAlignment="center"
            marginTop="18"
            automationText="appearance-current"
          />
          <Label
            :text="t('Your choice is saved on this device.')"
            class="ex-note"
            textAlignment="center"
            marginTop="10"
            textWrap="true"
          />
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>
<style scoped>
.appearance-back {
  width: 44;
  height: 44;
  border-radius: 22;
  background-color: var(--studio-surface);
  color: var(--studio-text);
  font-size: 24;
  text-align: center;
  vertical-align: middle;
}
</style>
