<script lang="ts" setup>
import { isAndroid, type EventData, type ListView } from '@nativescript/core'
import { onUnmounted, ref } from 'nativescript-vue'
import { animateItems } from '@rafaelaugusto/jolt'

const once = ref(false)
const items = ref(rows())
let list: ListView | undefined
let unlink: (() => void) | undefined

function rows() {
  return Array.from({ length: 60 }, (_, index) => ({
    title: `Row ${index + 1}`,
    index,
    track: [
      'First light',
      'Slow mornings',
      'Golden hour',
      'After the rain',
      'Night drive',
      'Daydreaming',
    ][index % 6],
  }))
}
function arm() {
  unlink?.()
  unlink = list && animateItems(list, 'fadeInUp', { duration: 350, once: once.value })
}
function loaded(event: EventData) {
  list = event.object as ListView
  if (isAndroid) list.android.setNestedScrollingEnabled(true)
  arm()
}
function toggleOnce() {
  once.value = !once.value
  arm()
}
function reset() {
  items.value = rows()
  arm()
}
onUnmounted(() => unlink?.())
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout rows="auto,*" class="ex-stage" height="420" padding="18"
      ><GridLayout columns="*,auto" marginBottom="18"
        ><Label text="ON REPEAT" class="ex-kicker" /><Label
          col="1"
          text="60 TRACKS"
          class="ex-kicker" /></GridLayout
      ><ListView
        row="1"
        :items="items"
        separatorColor="transparent"
        backgroundColor="#202C28"
        @loaded="loaded"
        accessibilityLabel="Animated playlist"
        ><template #default="{ item }"
          ><GridLayout columns="50,*,auto" height="74" padding="8 0"
            ><GridLayout
              width="44"
              height="50"
              borderRadius="12"
              :backgroundColor="['#D3DC9E', '#C6B2DC', '#DCA78B'][item.index % 3]"
              ><Label
                :text="['✦', '◉', '↗'][item.index % 3]"
                fontSize="26"
                color="#394833"
                textAlignment="center"
                verticalAlignment="middle" /></GridLayout
            ><StackLayout col="1" verticalAlignment="middle" marginLeft="12"
              ><Label :text="item.track" color="#E3EADA" fontSize="16" /><Label
                :text="`Jolt Sessions / ${String(item.index + 1).padStart(2, '0')}`"
                color="#7F9476"
                fontSize="10"
                marginTop="4" /></StackLayout
            ><Label
              col="2"
              text="↗"
              fontSize="20"
              color="#91A37A"
              verticalAlignment="middle" /></GridLayout></template></ListView></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          :text="once ? 'Once: on' : 'Once: off'"
          @tap="toggleOnce"
          class="ex-primary" /><Button
          col="1"
          text="New items"
          @tap="reset" /></GridLayout></StackLayout
    ><Label
      text="Scroll to discover the next track. Each one gets its own entrance."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="List rows" />
      <Label
        class="muted"
        textWrap="true"
        :text="`animateItems(list, 'fadeInUp', { once: ${once} })`"
      />

      <ListView
        :items="items"
        height="320"
        marginTop="12"
        separatorColor="transparent"
        @loaded="loaded"
      >
        <template #default="{ item }">
          <Label class="row" :text="item.title" />
        </template>
      </ListView>

      <GridLayout columns="*, *">
        <Button
          class="button"
          :text="once ? 'Once: on' : 'Once: off'"
          @tap="toggleOnce"
        />
        <Button col="1" class="button" text="New items" @tap="reset" />
      </GridLayout>
    </StackLayout>
  </template>
</template>
