<script setup lang="ts">
import { ref, onUnmounted } from 'nativescript-vue'
import { animate, motionScope, reducedMotion } from '@rafaelaugusto/jolt'
import { useRouter } from 'vue-router-ns'
import { examples } from './catalog'
const router = useRouter()
const left = ref(),
  right = ref(),
  middle = ref()
let scope = motionScope()
function stop() {
  scope.dispose()
}
function start() {
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
</script>
<template>
  <Page
    actionBarHidden="true"
    backgroundColor="#F6F5F0"
    statusBarStyle="dark"
    @navigatedTo="start"
    @navigatingFrom="stop"
  >
    <GridLayout rows="*,72">
      <ScrollView row="0" scrollBarIndicatorVisible="false">
        <StackLayout padding="12 24 28">
          <GridLayout columns="36,*,auto" height="44" marginBottom="26">
            <Image
              src="~/assets/jolt-mark.png"
              width="27"
              height="31"
              stretch="aspectFit"
              horizontalAlignment="left"
            />
            <Label col="1" text="jolt." class="studio-wordmark" />
            <Label
              col="2"
              text="MOTION STUDIO"
              class="studio-eyebrow"
              verticalAlignment="middle"
            />
          </GridLayout>
          <Label
            text="Small details.&#10;Big feelings."
            class="studio-display"
            textWrap="true"
          />
          <Label
            text="A collection of things that move you."
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
            accessibilityLabel="Play with springs"
          >
            <Label
              text="01 / THE ART OF FEELING"
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
              <Label text="Touch. Feel. Repeat." color="#FCFCF7" fontSize="13" />
              <Label col="1" text="↗" color="#E3FC62" fontSize="20" />
            </GridLayout>
          </GridLayout>
          <GridLayout columns="*,auto" margin="28 0 15">
            <Label text="Start with a feeling" class="studio-section-title" />
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
              backgroundColor="#E9E7F2"
              @tap="open('springs')"
              accessibilityRole="button"
              accessibilityLabel="Open Springs"
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
              <Label text="Springs" class="studio-card-title" />
              <Label
                text="A little bounce. A lot of life."
                textWrap="true"
                class="studio-card-copy"
              />
              <Label text="PLAY WITH IT  ↗" class="studio-small-action" marginTop="18" />
            </StackLayout>
            <StackLayout
              col="2"
              class="studio-feature"
              backgroundColor="#E7EDD8"
              @tap="open('gesture-lab')"
              accessibilityRole="button"
              accessibilityLabel="Open Native gestures"
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
              <Label text="Gestures" class="studio-card-title" />
              <Label
                text="Go on. Make the first move."
                textWrap="true"
                class="studio-card-copy"
              />
              <Label text="GET HANDS ON  ↗" class="studio-small-action" marginTop="18" />
            </StackLayout>
          </GridLayout>
          <GridLayout
            columns="*,auto"
            class="studio-explore"
            @tap="collection()"
            accessibilityRole="button"
            accessibilityLabel="Explore all examples"
          >
            <StackLayout
              ><Label
                text="The whole collection"
                fontSize="19"
                fontWeight="bold"
                color="#20242D" /><Label
                :text="`${examples.length} experiments. Endless possibilities.`"
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
            ><Label text="BUILT WITH JOLT" class="studio-eyebrow" /><Label
              col="1"
              text="Native by nature."
              class="studio-eyebrow"
          /></GridLayout>
        </StackLayout>
      </ScrollView>
      <GridLayout row="1" columns="*,*" class="studio-bottom">
        <Label
          text="◉  Studio"
          class="studio-tab-active"
          verticalAlignment="middle"
          textAlignment="center"
        />
        <Label
          col="1"
          text="▦  Collection"
          class="studio-tab"
          verticalAlignment="middle"
          textAlignment="center"
          @tap="collection()"
          accessibilityRole="button"
          accessibilityLabel="Collection"
        />
      </GridLayout>
    </GridLayout>
  </Page>
</template>
