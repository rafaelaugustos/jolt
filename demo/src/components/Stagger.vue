<script lang="ts" setup>
import { ref } from 'nativescript-vue'
import { animate, type Stagger } from '@rafaelaugusto/jolt'

const rows = ref([])
const items = ['Inbox', 'Starred', 'Snoozed', 'Sent', 'Drafts']

function replay(stagger: Stagger) {
  animate(rows.value, 'fadeInLeft', { stagger })
}
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout class="ex-stage"
      ><Label
        text="YOUR DAILY ROTATION"
        class="ex-kicker"
        verticalAlignment="top" /><StackLayout marginTop="26"
        ><GridLayout
          v-for="(item, i) in items"
          :key="item"
          ref="rows"
          columns="40,*,auto"
          height="49"
          marginBottom="5"
          borderRadius="13"
          backgroundColor="#314339"
          padding="8 12"
          ><Label
            :text="['01', '02', '03', '04', '05'][i]"
            color="#94A681"
            fontSize="11"
            verticalAlignment="middle" /><Label
            col="1"
            :text="
              [
                'First light',
                'Slow mornings',
                'Golden hour',
                'After the rain',
                'Night drive',
              ][i]
            "
            color="#ECF0E2"
            fontSize="16"
            verticalAlignment="middle" /><Label
            col="2"
            :text="['3:42', '4:18', '2:56', '5:01', '3:20'][i]"
            fontSize="10"
            color="#9EAF9B"
            verticalAlignment="middle" /></GridLayout></StackLayout></GridLayout
    ><StackLayout class="ex-controls"
      ><GridLayout columns="*,*"
        ><Button
          col="0"
          text="From the top"
          @tap="replay({ each: 100 })"
          class="ex-primary" /><Button
          col="1"
          text="From the center"
          @tap="replay({ each: 100, from: 'center' })" /></GridLayout></StackLayout
    ><Label
      text="Five arrivals. One effortless rhythm."
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" text="Stagger" />
      <Label
        class="muted"
        textWrap="true"
        text="animate(rows, 'fadeInLeft', { stagger: 50 })"
      />

      <StackLayout class="list">
        <Label v-for="item in items" :key="item" ref="rows" class="row" :text="item" />
      </StackLayout>

      <GridLayout columns="*, *">
        <Button class="button" text="From the top" @tap="replay({ each: 50 })" />
        <Button
          col="1"
          class="button"
          text="From the center"
          @tap="replay({ each: 50, from: 'center' })"
        />
      </GridLayout>
    </StackLayout>
  </template>
</template>
