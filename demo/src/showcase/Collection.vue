<script setup lang="ts">
import { useThemeReveal } from './theme-reveal'
import { colorMode, palette, themeClass, statusBarStyle, useThemedInput } from './theme'
import { usePreviewI18n } from './i18n'
import { computed, ref } from 'nativescript-vue'
import { isIOS } from '@nativescript/core'
import { useRoute, useRouter } from 'vue-router-ns'
import { categories, examples } from './catalog'
import { searchText } from './locale'
const { t } = usePreviewI18n()
const inputTheme = useThemedInput()
const route = useRoute(),
  router = useRouter()
const selected = ref(String(route.query.category || 'All')),
  search = ref('')
const filtered = computed(() =>
  examples.filter(
    (e) =>
      (selected.value === 'All' || e.category === selected.value) &&
      searchText(
        `${e.title} ${e.description} ${e.category} ${t(e.title)} ${t(e.description)} ${t(e.category)}`,
      ).includes(searchText(search.value)),
  ),
)
const colors: Record<string, string> = {
  Motion: '#E9E7F2',
  Touch: '#E7EDD8',
  Visual: '#F5DFCF',
  Type: '#E0E9F1',
  Layout: '#EEE4D8',
  State: '#E4E8DC',
  SceneKit: '#DFE8E8',
}
const darkColors: Record<string, string> = {
  Motion: '#373242',
  Touch: '#303D2C',
  Visual: '#453329',
  Type: '#293B46',
  Layout: '#3C362B',
  State: '#303C30',
  SceneKit: '#293D3D',
}
const glyphs: Record<string, string> = {
  Motion: '↝',
  Touch: '↗',
  Visual: '◈',
  Type: 'Aa',
  Layout: '▤',
  State: '⇄',
  SceneKit: '◇',
}
function open(id: string) {
  void router.push(`/example/${id}`)
}
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
      rows="auto,auto,auto,*,72"
      :backgroundColor="palette.background"
      @loaded="themeReveal.loaded"
      @unloaded="themeReveal.unloaded"
    >
      <StackLayout padding="18 24 0">
        <Label :text="t('THE MOTION COLLECTION')" class="studio-eyebrow" />
        <GridLayout columns="*,auto" margin="7 0 16"
          ><Label
            :text="t('Find your flow.')"
            fontSize="34"
            fontWeight="bold"
            :color="palette.text" /><Label
            col="1"
            :text="t(String(examples.length).padStart(2, '0'))"
            fontSize="18"
            :color="palette.subtle"
            verticalAlignment="middle"
        /></GridLayout>
      </StackLayout>
      <GridLayout
        row="1"
        columns="30,*"
        margin="0 24 16"
        padding="8 14"
        :backgroundColor="palette.surface"
        borderRadius="15"
      >
        <Label text="⌕" fontSize="24" :color="palette.muted" verticalAlignment="middle" />
        <TextField
          col="1"
          v-model="search"
          @loaded="inputTheme.loaded"
          @unloaded="inputTheme.unloaded"
          :hint="t('Search something that moves…')"
          :placeholderColor="palette.muted"
          :accessibilityLabel="t('Search examples')"
          returnKeyType="done"
          @returnPress="$event.object.dismissSoftInput()"
          fontSize="14"
          :color="palette.text"
          backgroundColor="transparent"
          borderBottomWidth="0"
          padding="8 0"
          autocorrect="false"
        />
      </GridLayout>
      <ScrollView
        row="2"
        orientation="horizontal"
        scrollBarIndicatorVisible="false"
        height="52"
      >
        <StackLayout orientation="horizontal" padding="0 24">
          <Label
            v-for="category in categories"
            :key="category"
            :text="t(category)"
            :class="selected === category ? 'studio-filter selected' : 'studio-filter'"
            @tap="selected = category"
            accessibilityRole="button"
            :accessibilityLabel="t(`Filter ${category}`)"
          />
        </StackLayout>
      </ScrollView>
      <ScrollView row="3" scrollBarIndicatorVisible="false">
        <StackLayout padding="8 24 28">
          <Label
            :text="
              t(
                filtered.length === 1
                  ? '1 EXPERIMENT TO EXPLORE'
                  : `${filtered.length} EXPERIMENTS TO EXPLORE`,
              )
            "
            class="studio-eyebrow"
            margin="0 0 12"
          />
          <GridLayout
            v-for="example in filtered"
            :key="example.id"
            columns="54,*,20"
            class="studio-example-row"
            @tap="open(example.id)"
            accessibilityRole="button"
            :accessibilityLabel="t(`Open ${example.title}`)"
          >
            <Label
              :text="t(glyphs[example.category])"
              :backgroundColor="
                (colorMode === 'dark' ? darkColors : colors)[example.category]
              "
              width="44"
              height="48"
              borderRadius="13"
              fontSize="23"
              fontWeight="bold"
              textAlignment="center"
              verticalAlignment="middle"
              :color="palette.badgeText"
            />
            <StackLayout col="1" padding="2 8"
              ><Label
                :text="t(example.title)"
                fontSize="17"
                fontWeight="bold"
                :color="palette.text" /><Label
                :text="t(example.description)"
                fontSize="12"
                :color="palette.muted"
                textWrap="true"
                marginTop="5" /><Label
                v-if="example.ios && !isIOS"
                :text="t('Available on iOS')"
                fontSize="10"
                :color="palette.muted"
                marginTop="4"
            /></StackLayout>
            <Label
              col="2"
              text="↗"
              fontSize="20"
              :color="palette.subtle"
              verticalAlignment="middle"
            />
          </GridLayout>
          <StackLayout v-if="!filtered.length" padding="40 12"
            ><Label
              :text="t('A little less specific?')"
              fontSize="22"
              fontWeight="bold"
              textAlignment="center" /><Label
              :text="t('Try a different word or category.')"
              textAlignment="center"
              marginTop="10"
              :color="palette.muted"
          /></StackLayout>
        </StackLayout>
      </ScrollView>
      <GridLayout row="4" columns="*,*" class="studio-bottom"
        ><Label
          :text="t('◉  Studio')"
          class="studio-tab"
          verticalAlignment="middle"
          textAlignment="center"
          @tap="router.back()"
          accessibilityRole="button"
          :accessibilityLabel="t('Studio')" /><Label
          col="1"
          :text="t('▦  Collection')"
          class="studio-tab-active"
          verticalAlignment="middle"
          textAlignment="center"
      /></GridLayout>
    </GridLayout>
  </Page>
</template>
