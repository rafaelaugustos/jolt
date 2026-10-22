<script setup lang="ts">
import {
  Device,
  Utils,
  isIOS,
  knownFolders,
  type Label,
  type View,
} from '@nativescript/core'
import { nextTick, onUnmounted, ref } from 'nativescript-vue'
import { rollTo, type Animation } from '@rafaelaugusto/jolt'

const rolling = ref()
const plain = ref()
const size = ref(40)
const status = ref('Ready to check')
const busy = ref(false)
let current: Animation | undefined
let alive = true
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const label = (ref: { value: { nativeView: View } }) => ref.value.nativeView as Label

async function check() {
  if (busy.value) return
  busy.value = true
  const results: {
    size: number
    text: string
    phase: string
    rolling: number
    plain: number
    overlays: number
  }[] = []
  const measure = (phase: string) => {
    const animated = label(rolling),
      baseline = label(plain)
    const density = Utils.layout.getDisplayDensity()
    let overlays = 0
    if (isIOS) {
      const layers = animated.ios.layer.sublayers as NSArray<CALayer>
      for (let i = 0; i < (layers?.count ?? 0); i++)
        if (layers.objectAtIndex(i).name === 'jolt:roll') overlays++
    }
    const result = {
      size: size.value,
      text: animated.text,
      phase,
      rolling: animated.getMeasuredHeight() / density,
      plain: baseline.getMeasuredHeight() / density,
      overlays,
    }
    results.push(result)
    if (Math.abs(result.rolling - result.plain) > 2 || result.rolling > size.value * 2)
      throw new Error(`Unexpected height: ${JSON.stringify(result)}`)
    if (phase === 'during' && isIOS && overlays !== 1)
      throw new Error(`Rolling overlay missing: ${JSON.stringify(result)}`)
    if (phase === 'after' && overlays !== 0)
      throw new Error(`Rolling overlay retained: ${JSON.stringify(result)}`)
  }
  try {
    status.value = 'Checking auto size…'
    for (const fontSize of [40, 64]) {
      size.value = fontSize
      await nextTick()
      await wait(100)
      for (const value of [312, 999, 1000, 7]) {
        if (!alive) return
        const animated = label(rolling),
          baseline = label(plain)
        baseline.text = String(value)
        current = rollTo(animated, value, { duration: 650, stagger: 40 })
        await wait(120)
        if (!alive) return
        measure('during')
        const finished = await current
        if (!finished) throw new Error('Rolling stopped unexpectedly')
        await wait(60)
        measure('after')
      }
      label(plain).text = '42'
      current = rollTo(label(rolling), 42, { duration: 650 })
      await wait(120)
      current.stop()
      await wait(60)
      measure('after')
    }
    status.value = `Passed ${results.length} layout checks`
  } catch (error) {
    status.value = `Failed: ${String(error)}`
  } finally {
    busy.value = false
    if (alive)
      await knownFolders
        .documents()
        .getFile('jolt-roll-layout-checks.json')
        .writeText(
          JSON.stringify(
            {
              platform: Device.os,
              version: Device.osVersion,
              status: status.value,
              results,
            },
            null,
            2,
          ),
        )
  }
}

onUnmounted(() => {
  alive = false
  current?.stop()
})
</script>

<template>
  <StackLayout class="section">
    <Label class="heading" text="Rolling auto size" />
    <Label
      class="muted"
      text="Both rows size themselves to the text. Digits roll above; plain text below."
      textWrap="true"
    />
    <GridLayout
      columns="auto,auto,*,auto"
      rows="auto"
      marginTop="16"
      backgroundColor="#f0fdfa"
    >
      <StackLayout orientation="horizontal">
        <Label
          ref="rolling"
          text="300"
          :fontSize="size"
          minWidth="180"
          fontWeight="300"
          letterSpacing="-0.04"
        />
      </StackLayout>
      <Label col="1" text="mi" verticalAlignment="middle" marginLeft="8" />
      <Label col="3" text="78% ▰" verticalAlignment="middle" marginRight="8" />
    </GridLayout>
    <GridLayout
      columns="auto,auto,*,auto"
      rows="auto"
      marginTop="12"
      backgroundColor="#f4f4f5"
    >
      <StackLayout orientation="horizontal">
        <Label
          ref="plain"
          text="300"
          :fontSize="size"
          minWidth="180"
          fontWeight="300"
          letterSpacing="-0.04"
        />
      </StackLayout>
      <Label col="1" text="mi" verticalAlignment="middle" marginLeft="8" />
      <Label col="3" text="78% ▰" verticalAlignment="middle" marginRight="8" />
    </GridLayout>
    <Label :text="status" textWrap="true" class="muted" marginTop="12" />
    <Button class="button" text="Check auto height" :isEnabled="!busy" @tap="check" />
  </StackLayout>
</template>
