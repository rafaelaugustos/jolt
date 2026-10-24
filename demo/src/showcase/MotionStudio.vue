<script setup lang="ts">
import { computed, onUnmounted, ref } from 'nativescript-vue'
import { isIOS } from '@nativescript/core'
import {
  animate,
  motionScope,
  presets,
  type PresetName,
  type SpringName,
  type Animation,
} from '@rafaelaugusto/jolt'
const props = defineProps<{ mode: string }>()
const springNames: SpringName[] = ['smooth', 'snappy', 'bouncy']
const spring = computed(() => props.mode === 'springs')
const preset = computed(() => props.mode === 'presets')
const colors = computed(() => props.mode === 'colors')
const scope = motionScope()
const card = ref(),
  lane = ref(),
  orb = ref()
const selected = ref(props.mode === 'presets' ? 'popIn' : 'smooth'),
  expanded = ref(false),
  shaped = ref(false)
const status = ref('Go on. Give it a little nudge.')
const paletteName = ref('Moss')
const palettes = [
  { name: 'Moss', backgroundColor: '#244F40', color: '#D8F4AC', borderColor: '#83B68B' },
  {
    name: 'Orchid',
    backgroundColor: '#513D62',
    color: '#F2D6F5',
    borderColor: '#AE86C1',
  },
  { name: 'Sky', backgroundColor: '#264E66', color: '#D3F0FF', borderColor: '#80B9D5' },
]
const essentials: PresetName[] = [
  'popIn',
  'fadeInUp',
  'zoomIn',
  'bounce',
  'shake',
  'pulse',
].filter((n) => n in presets) as PresetName[]
const names = computed(() =>
  expanded.value ? (Object.keys(presets) as PresetName[]) : essentials,
)
let right = false,
  current: Animation | undefined,
  alive = true
onUnmounted(() => {
  alive = false
  scope.dispose()
})
function toss(name: SpringName) {
  selected.value = name
  right = !right
  const width = lane.value.nativeView.getActualSize().width
  current = scope.add(
    animate(
      orb.value,
      { x: right ? Math.max(0, width - 72) : 0, rotate: right ? 180 : 0 },
      name,
    ),
  )
  status.value = 'Tap another spring while it moves. Feel the handoff.'
}
async function play(name: PresetName) {
  selected.value = name
  current = scope.add(animate(card.value, name))
  const completed = await current.finished
  if (alive && completed && name.includes('Out')) scope.add(animate(card.value, 'popIn'))
}
function palette(index: number) {
  const { name, ...values } = palettes[index]!
  paletteName.value = name
  current = scope.add(animate(card.value, values, { duration: 1500, ease: 'sineInOut' }))
  status.value = 'One change. A completely different mood.'
}
function morph() {
  shaped.value = !shaped.value
  current = scope.add(
    animate(
      card.value,
      {
        borderRadius: shaped.value ? 76 : 24,
        borderWidth: shaped.value ? 7 : 2,
        borderColor: shaped.value ? '#C0A3E0' : '#ACC787',
        rotate: shaped.value ? -9 : 0,
        ...(isIOS
          ? {
              shadowOpacity: shaped.value ? 0.36 : 0.12,
              shadowRadius: shaped.value ? 24 : 8,
              shadowOffsetY: shaped.value ? 18 : 5,
            }
          : { elevation: shaped.value ? 24 : 4 }),
      },
      { duration: 1600, ease: 'sineInOut' },
    ),
  )
  status.value = 'Soft edges. A little depth. A different character.'
}
function freeze() {
  current?.stop()
  status.value = 'A moment, held.'
}
</script>
<template>
  <StackLayout padding="0 12">
    <GridLayout
      v-if="spring"
      rows="auto,*,auto"
      height="340"
      backgroundColor="#202B29"
      borderRadius="28"
      padding="24"
    >
      <GridLayout columns="*,auto"
        ><Label text="THE FEELING OF PHYSICS" class="motion-kicker" /><Label
          col="1"
          text="↔"
          color="#CBE991"
          fontSize="24"
      /></GridLayout>
      <GridLayout row="1" ref="lane" height="120" verticalAlignment="middle">
        <GridLayout columns="*,*,*,*,*,*,*" height="86"
          ><Label
            v-for="i in 7"
            :key="i"
            :col="i - 1"
            width="1"
            height="86"
            backgroundColor="#39443D"
        /></GridLayout>
        <Label height="2" backgroundColor="#56604C" verticalAlignment="middle" />
        <GridLayout
          ref="orb"
          width="72"
          height="72"
          borderRadius="36"
          backgroundColor="#DEF596"
          horizontalAlignment="left"
          verticalAlignment="middle"
          ><Image src="~/assets/jolt-mark.png" width="41" height="41"
        /></GridLayout>
      </GridLayout>
      <GridLayout row="2" columns="*,auto"
        ><Label
          :text="selected.toUpperCase()"
          color="#E5F0DC"
          fontSize="24"
          fontWeight="bold" /><Label
          col="1"
          text="NO TWO MOVES ALIKE"
          class="motion-kicker"
          verticalAlignment="middle"
      /></GridLayout>
    </GridLayout>
    <GridLayout
      v-else-if="preset"
      height="340"
      borderRadius="28"
      backgroundColor="#E9E5EF"
      padding="25"
    >
      <Label
        text="A SMALL ENTRANCE. A BIG PERSONALITY."
        class="motion-kicker light"
        verticalAlignment="top"
      />
      <GridLayout
        ref="card"
        rows="auto,*,auto"
        width="208"
        height="248"
        borderRadius="22"
        backgroundColor="#292333"
        padding="20"
        marginTop="26"
      >
        <Image
          src="~/assets/jolt-mark.png"
          width="26"
          height="26"
          horizontalAlignment="left"
        />
        <Label
          row="1"
          text="Good&#10;things&#10;move."
          fontSize="38"
          fontWeight="bold"
          textWrap="true"
          color="#E8E0F0"
          verticalAlignment="middle"
        />
        <GridLayout row="2" columns="*,auto"
          ><Label :text="selected" color="#BCB0CC" fontSize="10" /><Label
            col="1"
            text="↗"
            color="#E3FC62"
            fontSize="18"
        /></GridLayout>
      </GridLayout>
    </GridLayout>
    <GridLayout v-else-if="colors" height="340">
      <Label
        ref="card"
        text="Make&#10;room for&#10;color."
        textWrap="true"
        fontSize="48"
        fontWeight="bold"
        padding="40 28"
        backgroundColor="#244F40"
        color="#D8F4AC"
        borderColor="#83B68B"
        borderWidth="2"
        borderRadius="28"
      />
      <Label
        :text="`PALETTE / ${paletteName.toUpperCase()}`"
        fontSize="10"
        letterSpacing=".12"
        margin="28"
        color="#F4F6EA"
        verticalAlignment="bottom"
      />
    </GridLayout>
    <GridLayout v-else height="340" backgroundColor="#EDE6DC" borderRadius="28">
      <Label
        text="FORM FOLLOWS FEELING"
        class="motion-kicker light"
        verticalAlignment="top"
        margin="24"
      />
      <GridLayout
        ref="card"
        width="216"
        height="216"
        borderRadius="24"
        backgroundColor="#354A3F"
        borderWidth="2"
        borderColor="#ACC787"
        :boxShadow="isIOS ? '0 5 8 rgba(32, 40, 30, 0.12)' : undefined"
        androidElevation="4"
        marginTop="22"
      >
        <Label
          text="Stay&#10;in shape."
          textWrap="true"
          fontSize="31"
          color="#E0EDCE"
          fontWeight="bold"
          textAlignment="center"
          verticalAlignment="middle"
        />
      </GridLayout>
    </GridLayout>
    <StackLayout marginTop="24">
      <GridLayout columns="*,auto" marginBottom="13"
        ><Label
          :text="
            spring
              ? 'Pick a personality'
              : preset
                ? 'Make an entrance'
                : colors
                  ? 'Change the mood'
                  : 'Play with the shape'
          "
          fontSize="19"
          color="#30372F"
          fontWeight="bold" /><Label
          col="1"
          text="TRY IT"
          fontSize="9"
          color="#8D9485"
          verticalAlignment="middle"
          letterSpacing=".1"
      /></GridLayout>
      <GridLayout v-if="spring" columns="*,8,*,8,*"
        ><Button
          v-for="(name, i) in springNames"
          :key="name"
          :col="i * 2"
          :text="name"
          :class="selected === name ? 'motion-choice selected' : 'motion-choice'"
          @tap="toss(name)"
      /></GridLayout>
      <StackLayout v-else-if="preset"
        ><WrapLayout
          ><Label
            v-for="name in names"
            :key="name"
            :text="name"
            :class="selected === name ? 'motion-preset selected' : 'motion-preset'"
            @tap="play(name)"
            accessibilityRole="button"
            :accessibilityLabel="`Play ${name}`" /></WrapLayout
        ><Label
          :text="expanded ? 'Show essentials ↑' : 'Explore every preset ↓'"
          class="motion-link"
          @tap="expanded = !expanded"
          accessibilityRole="button"
      /></StackLayout>
      <GridLayout v-else-if="colors" columns="*,8,*,8,*"
        ><Button
          v-for="(p, i) in palettes"
          :key="p.name"
          :col="i * 2"
          :text="p.name"
          :class="paletteName === p.name ? 'motion-choice selected' : 'motion-choice'"
          @tap="palette(i)"
      /></GridLayout>
      <GridLayout v-else columns="*,12,*"
        ><Button text="Morph" class="motion-choice selected" @tap="morph" /><Button
          col="2"
          text="Stop here"
          class="motion-choice"
          @tap="freeze"
      /></GridLayout>
      <Label
        v-if="!preset"
        :text="status"
        textWrap="true"
        fontSize="13"
        color="#818878"
        margin="18 2 0"
      />
    </StackLayout>
  </StackLayout>
</template>
<style scoped>
.motion-kicker {
  color: #93a08b;
  font-size: 9;
  letter-spacing: 0.12;
}
.motion-kicker.light {
  color: #8a8191;
}
.motion-choice {
  background-color: #e4e8dd;
  color: #69725f;
  border-radius: 15;
  padding: 13 0;
  margin: 0;
  font-size: 13;
  text-transform: none;
}
.motion-choice.selected {
  background-color: #303a2d;
  color: #e3fc62;
}
.motion-preset {
  margin: 0 8 9 0;
  padding: 12 15;
  border-radius: 15;
  background-color: #e8e4ec;
  color: #71647e;
  font-size: 13;
}
.motion-preset.selected {
  background-color: #40384b;
  color: #ede0ff;
}
.motion-link {
  color: #817889;
  font-size: 12;
  padding: 10 0;
}
</style>
