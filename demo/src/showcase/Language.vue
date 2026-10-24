<script setup lang="ts">
import { useThemeReveal } from './theme-reveal'
import { palette, themeClass, statusBarStyle } from './theme'
import { useRouter } from 'vue-router-ns'
import { locale, preference, setLanguage, t } from './i18n'
import type { LanguagePreference } from './locale'
const router = useRouter()
const options: {
  value: LanguagePreference
  title: string
  subtitle: string
  glyph: string
}[] = [
  {
    value: 'system',
    title: 'Follow device',
    subtitle: 'Use the language of your phone.',
    glyph: '◎',
  },
  { value: 'en', title: 'English', subtitle: 'English', glyph: 'Aa' },
  { value: 'pt-BR', title: 'Português', subtitle: 'Português do Brasil', glyph: 'Ãa' },
]
const themeReveal = useThemeReveal()
</script>
<template>
  <Page
    actionBarHidden="true"
    @navigatedTo="themeReveal.enter"
    @navigatingFrom="themeReveal.leave"
    :backgroundColor="palette.background"
    :color="palette.text"
    :class="themeClass"
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
          width="40"
          height="40"
          borderRadius="20"
          :backgroundColor="palette.surface"
          :color="palette.text"
          fontSize="24"
          textAlignment="center"
          verticalAlignment="middle"
          @tap="router.back()"
          accessibilityRole="button"
          :accessibilityLabel="t('Back to Studio')"
          automationText="language-back"
        />
        <Label
          col="1"
          :text="t('Language').toUpperCase()"
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
            :text="t('Make yourself\nat home.')"
            fontSize="42"
            fontWeight="bold"
            :color="palette.text"
            letterSpacing="-.045"
            textWrap="true"
          />
          <Label
            :text="t('The whole Studio, in your language.')"
            class="studio-subtitle"
            margin="14 0 28"
            textWrap="true"
          />
          <GridLayout
            v-for="option in options"
            :key="option.value"
            columns="52,*,24"
            padding="20 18"
            marginBottom="12"
            borderRadius="24"
            :backgroundColor="
              preference === option.value ? palette.selected : palette.surface
            "
            @tap="setLanguage(option.value)"
            accessibilityRole="button"
            :accessibilityLabel="
              t(option.title) + (preference === option.value ? ', ' + t('Selected') : '')
            "
            :automationText="'language-' + option.value"
          >
            <Label
              :text="option.glyph"
              fontSize="24"
              :color="
                preference === option.value ? palette.selectedText : palette.controlText
              "
              verticalAlignment="middle"
            />
            <StackLayout col="1" paddingRight="8">
              <Label
                :text="t(option.title)"
                fontSize="18"
                fontWeight="bold"
                :color="preference === option.value ? palette.selectedText : palette.text"
                textWrap="true"
              />
              <Label
                v-if="option.value === 'system'"
                :text="t(option.subtitle)"
                fontSize="12"
                :color="
                  preference === option.value ? palette.selectedMuted : palette.muted
                "
                marginTop="6"
                textWrap="true"
              />
              <Label
                v-else-if="option.value === 'pt-BR'"
                text="Brasil"
                fontSize="12"
                :color="
                  preference === option.value ? palette.selectedMuted : palette.muted
                "
                marginTop="6"
              />
            </StackLayout>
            <Label
              col="2"
              :text="preference === option.value ? '✓' : '○'"
              fontSize="21"
              :color="preference === option.value ? palette.selectedText : palette.subtle"
              verticalAlignment="middle"
            />
          </GridLayout>
          <StackLayout
            marginTop="18"
            padding="18 20"
            :backgroundColor="palette.peach"
            borderRadius="20"
          >
            <Label
              :text="t(`Currently using ${locale === 'pt-BR' ? 'Português' : 'English'}`)"
              fontSize="14"
              fontWeight="bold"
              :color="palette.text"
              textWrap="true"
            />
            <Label
              :text="t('Changes apply immediately.')"
              fontSize="13"
              :color="palette.muted"
              marginTop="8"
              textWrap="true"
            />
          </StackLayout>
          <Label
            :text="t('Your choice is saved on this device.')"
            class="ex-note"
            textAlignment="center"
            marginTop="24"
            textWrap="true"
          />
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>
