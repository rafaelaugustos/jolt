<script setup lang="ts">
import { usePreviewI18n } from '../showcase/i18n'
import { useBinding, useScrollValue } from '@rafaelaugusto/jolt/vue'
const { t } = usePreviewI18n()

const offset = useScrollValue()
const header = useBinding({ y: offset.to([0, 90], [0, -64]) })
const title = useBinding({
  scale: offset.to([0, 90], [1, 0.72]),
  y: offset.to([0, 90], [0, 30]),
})
const subtitle = useBinding({ opacity: offset.to([0, 50], [1, 0]) })
const bar = useBinding({ scaleX: offset.to([0, 700], [0, 1]) })
const rows = Array.from({ length: 24 }, (_, i) => `Track ${i + 1}`)
defineProps<{ embedded?: boolean }>()
</script>

<template>
  <StackLayout v-if="embedded" class="exhibit">
    <GridLayout
      height="440"
      borderRadius="28"
      clipToBounds="true"
      backgroundColor="#202C28"
      ><ScrollView :ref="offset.ref" :accessibilityLabel="t('Scroll album tracks')"
        ><StackLayout padding="156 22 22"
          ><GridLayout v-for="(row, i) in rows" :key="row" columns="30,*,auto" height="66"
            ><Label
              :text="t(String(i + 1).padStart(2, '0'))"
              color="#7F9474"
              fontSize="11"
              verticalAlignment="middle" /><StackLayout col="1" verticalAlignment="middle"
              ><Label
                :text="
                  t(
                    [
                      'First light',
                      'Slow mornings',
                      'Golden hour',
                      'After the rain',
                      'Night drive',
                      'Daydreaming',
                    ][i % 6],
                  )
                "
                color="#E4EBDD"
                fontSize="16" /><Label
                :text="t('Jolt Sessions')"
                color="#819476"
                fontSize="10"
                marginTop="4" /></StackLayout
            ><Label
              col="2"
              text="↗"
              color="#A4B88B"
              fontSize="20"
              verticalAlignment="middle" /></GridLayout></StackLayout></ScrollView
      ><GridLayout
        :ref="header"
        height="140"
        verticalAlignment="top"
        backgroundColor="#C4D59F"
        padding="22"
        ><StackLayout verticalAlignment="bottom"
          ><Label
            :ref="title"
            :text="t('Slow days.')"
            fontSize="36"
            fontWeight="bold"
            color="#30412B"
            originX="0"
            originY="1" /><Label
            :ref="subtitle"
            :text="t('24 TRACKS FOR TAKING YOUR TIME')"
            color="#708257"
            fontSize="9"
            letterSpacing=".07"
            marginTop="9" /></StackLayout
        ><Label
          :ref="bar"
          height="3"
          backgroundColor="#30412B"
          verticalAlignment="bottom"
          originX="0"
          scaleX="0"
          marginBottom="-22" /></GridLayout></GridLayout
    ><Label
      :text="t('Scroll the album. The title settles into a smaller space.')"
      class="ex-note"
      textWrap="true"
    />
  </StackLayout>
  <template v-else>
    <StackLayout class="section">
      <Label class="heading" :text="t('Scroll values')" />
      <Label
        class="muted"
        textWrap="true"
        :text="t('bind(header, { y: offset.to([0, 90], [0, -64]) })')"
      />

      <GridLayout class="stage scroll-stage" height="320">
        <ScrollView :ref="offset.ref">
          <StackLayout class="scroll-list">
            <Label v-for="row in rows" :key="row" class="row" :text="t(row)" />
          </StackLayout>
        </ScrollView>
        <GridLayout
          :ref="header"
          class="scroll-header"
          height="140"
          verticalAlignment="top"
        >
          <StackLayout verticalAlignment="bottom" class="scroll-titles">
            <Label
              :ref="title"
              class="scroll-title"
              :text="t('Album')"
              originX="0"
              originY="1"
            />
            <Label
              :ref="subtitle"
              class="scroll-subtitle"
              :text="t('24 tracks · scroll the list')"
            />
          </StackLayout>
          <Label
            :ref="bar"
            class="scroll-bar"
            height="3"
            verticalAlignment="bottom"
            originX="0"
            scaleX="0"
          />
        </GridLayout>
      </GridLayout>

      <Label
        class="note"
        textWrap="true"
        :text="
          t(
            'The header, title, subtitle and progress bar follow the list\'s offset, with one write per scroll event.',
          )
        "
      />
    </StackLayout>
  </template>
</template>
