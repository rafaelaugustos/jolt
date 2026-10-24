<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { isIOS } from '@nativescript/core'
import { useRoute, useRouter } from 'vue-router-ns'
import { categories, examples } from './catalog'
const route = useRoute(),
  router = useRouter()
const selected = ref(String(route.query.category || 'All')),
  search = ref('')
const filtered = computed(() =>
  examples.filter(
    (e) =>
      (selected.value === 'All' || e.category === selected.value) &&
      `${e.title} ${e.description} ${e.category}`
        .toLowerCase()
        .includes(search.value.toLowerCase().trim()),
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
</script>
<template>
  <Page actionBarHidden="true" backgroundColor="#F6F5F0" statusBarStyle="dark">
    <GridLayout rows="auto,auto,auto,*,72">
      <StackLayout padding="18 24 0">
        <Label text="THE MOTION COLLECTION" class="studio-eyebrow" />
        <GridLayout columns="*,auto" margin="7 0 16"
          ><Label
            text="Find your flow."
            fontSize="34"
            fontWeight="bold"
            color="#20242D" /><Label
            col="1"
            :text="String(examples.length).padStart(2, '0')"
            fontSize="18"
            color="#818778"
            verticalAlignment="middle"
        /></GridLayout>
      </StackLayout>
      <GridLayout
        row="1"
        columns="30,*"
        margin="0 24 16"
        padding="8 14"
        backgroundColor="#EAEAE3"
        borderRadius="15"
      >
        <Label text="⌕" fontSize="24" color="#666C5D" verticalAlignment="middle" />
        <TextField
          col="1"
          v-model="search"
          hint="Search something that moves…"
          accessibilityLabel="Search examples"
          returnKeyType="done"
          @returnPress="$event.object.dismissSoftInput()"
          fontSize="14"
          color="#20242D"
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
            :text="category"
            :class="selected === category ? 'studio-filter selected' : 'studio-filter'"
            @tap="selected = category"
            accessibilityRole="button"
            :accessibilityLabel="`Filter ${category}`"
          />
        </StackLayout>
      </ScrollView>
      <ScrollView row="3" scrollBarIndicatorVisible="false">
        <StackLayout padding="8 24 28">
          <Label
            :text="`${filtered.length} EXPERIMENTS TO EXPLORE`"
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
            :accessibilityLabel="`Open ${example.title}`"
          >
            <Label
              :text="glyphs[example.category]"
              :backgroundColor="colors[example.category]"
              width="44"
              height="48"
              borderRadius="13"
              fontSize="23"
              fontWeight="bold"
              textAlignment="center"
              verticalAlignment="middle"
              color="#343C36"
            />
            <StackLayout col="1" padding="2 8"
              ><Label
                :text="example.title"
                fontSize="17"
                fontWeight="bold"
                color="#20242D" /><Label
                :text="example.description"
                fontSize="12"
                color="#7C8076"
                textWrap="true"
                marginTop="5" /><Label
                v-if="example.ios && !isIOS"
                text="Available on iOS"
                fontSize="10"
                color="#7C8076"
                marginTop="4"
            /></StackLayout>
            <Label
              col="2"
              text="↗"
              fontSize="20"
              color="#858B78"
              verticalAlignment="middle"
            />
          </GridLayout>
          <StackLayout v-if="!filtered.length" padding="40 12"
            ><Label
              text="A little less specific?"
              fontSize="22"
              fontWeight="bold"
              textAlignment="center" /><Label
              text="Try a different word or category."
              textAlignment="center"
              marginTop="10"
              color="#7C8076"
          /></StackLayout>
        </StackLayout>
      </ScrollView>
      <GridLayout row="4" columns="*,*" class="studio-bottom"
        ><Label
          text="◉  Studio"
          class="studio-tab"
          verticalAlignment="middle"
          textAlignment="center"
          @tap="router.back()"
          accessibilityRole="button"
          accessibilityLabel="Studio" /><Label
          col="1"
          text="▦  Collection"
          class="studio-tab-active"
          verticalAlignment="middle"
          textAlignment="center"
      /></GridLayout>
    </GridLayout>
  </Page>
</template>
