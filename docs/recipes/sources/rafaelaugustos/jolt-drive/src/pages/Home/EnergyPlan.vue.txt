<script lang="ts" setup>
import { shallowRef, onMounted, onUnmounted, ref } from 'nativescript-vue';
import type { NativeElement } from '@/utils/native-element';
import type { ScrollView, View } from '@nativescript/core';
import { bottomSheet, type BottomSheet } from '@rafaelaugusto/jolt/bottom-sheet';
import type { GestureSurface } from '@rafaelaugusto/jolt/gestures';
import { blur, type Blur } from '@rafaelaugusto/jolt/blur';
import type { PlaybackAnimation } from '@rafaelaugusto/jolt';
import { useMotionScope } from '@rafaelaugusto/jolt/vue';
import Icon from '@/components/Icon.vue';
import { safeArea } from '@/utils/safe-area';
import { springs } from '@/themes/motion';
import { withAlpha } from '@/themes/palette';

const props = defineProps<{ accent: string; level: number; limit: number; background?: View }>();
const emit = defineEmits<{ save: [limit: number]; close: [] }>();
const motion = useMotionScope();
const bottom = safeArea().bottom;
const selected = ref(props.limit);
const panel = shallowRef<NativeElement<GestureSurface>>();
const handle = shallowRef<NativeElement>();
const scroll = shallowRef<NativeElement<ScrollView>>();
const backdrop = shallowRef<NativeElement>();
let sheet: BottomSheet | undefined;
let backgroundBlur: Blur | undefined;
let clearing: PlaybackAnimation | undefined;
let disposed = false;
let closing = false;
const choices = [
	{ value: 80, title: 'Everyday', detail: 'For the familiar roads.' },
	{ value: 90, title: 'A little further', detail: 'Room for a detour.' },
	{ value: 100, title: 'Open road', detail: 'Make a day of it.' },
];
const clearBackground = () => {
	if (!clearing && backgroundBlur)
		clearing = motion.add(backgroundBlur.animate(0, { duration: 260, ease: 'easeInOut' }));
	return clearing?.finished;
};
const close = () => {
	if (closing) return;
	closing = true;
	void clearBackground();
	sheet?.dismiss();
};
const save = () => {
	if (!closing) {
		emit('save', selected.value);
		close();
	}
};
onMounted(() => {
	// Only the garage is blurred. The sheet and its controls are sharp siblings.
	if (props.background) {
		backgroundBlur = blur(props.background, { amount: 0, radius: 18, style: 'dark' });
		motion.add(backgroundBlur.animate(0.8, { duration: 380, ease: 'easeInOut' }));
	}
	sheet = motion.add(
		bottomSheet(panel.value!.nativeView, {
			handle: handle.value!.nativeView,
			scrollView: scroll.value!.nativeView,
			backdrop: backdrop.value!.nativeView,
			backdropOpacity: backgroundBlur && backgroundBlur.snapshot().backend !== 'none' ? 0.24 : 0.62,
			snap: ['content', '90%'],
			safeArea: { top: 16, bottom: 0 },
			spring: { stiffness: 280, damping: 30 },
			accessibility: {
				label: 'Charge plan',
				expand: 'Expand charge plan',
				collapse: 'Collapse charge plan',
				dismiss: 'Close charge plan',
			},
			onDismiss: async () => {
				closing = true;
				await clearBackground();
				if (!disposed) emit('close');
			},
		}),
	);
	sheet.open('content');
});
onUnmounted(() => {
	disposed = true;
	backgroundBlur?.dispose();
});
</script>

<template>
	<GridLayout iosOverflowSafeArea="true">
		<GridLayout ref="backdrop" backgroundColor="#000000" opacity="0" />
		<GestureSurface
			ref="panel"
			height="520"
			rows="auto, *"
			class="plan"
			v-gradient="{ type: 'linear', angle: 150, colors: ['#1C2C25', '#0C1613'] }"
		>
			<GridLayout rows="20, auto" padding="4 22 16">
				<GridLayout
					ref="handle"
					accessible="true"
					accessibilityRole="button"
					accessibilityLabel="Expand charge plan"
					@tap="sheet?.expand()"
					><ContentView
						width="34"
						height="4"
						borderRadius="2"
						backgroundColor="#64776A"
						horizontalAlignment="center"
				/></GridLayout>
				<GridLayout row="1" columns="*, 36" marginTop="12">
					<StackLayout>
						<Label text="THE GOOD ENERGY" class="eyebrow body-strong" :color="accent" />
						<Label text="Your charge. Your call." class="title display" textWrap="true" />
					</StackLayout>
					<GridLayout
						col="1"
						width="36"
						height="36"
						borderRadius="18"
						backgroundColor="#293A30"
						accessible="true"
						accessibilityRole="button"
						accessibilityLabel="Close charge plan"
						v-press
						@tap="close"
					>
						<Label
							text="×"
							fontSize="25"
							color="#DCE8DC"
							textAlignment="center"
							verticalAlignment="middle"
						/>
					</GridLayout>
				</GridLayout>
			</GridLayout>
			<ScrollView ref="scroll" row="1" scrollBarIndicatorVisible="false">
				<StackLayout padding="0 22" :paddingBottom="bottom + 18">
					<GridLayout columns="*, auto" marginBottom="18">
						<Label
							text="CHARGE LIMIT"
							class="eyebrow body-strong"
							color="#95AA9C"
							verticalAlignment="middle"
						/>
						<Label
							col="1"
							:text="`${level}% now`"
							fontSize="11"
							color="#95AA9C"
							class="body-medium"
						/>
					</GridLayout>
					<GridLayout
						v-for="choice in choices"
						:key="choice.value"
						columns="*, auto"
						padding="14 16"
						marginBottom="9"
						borderRadius="19"
						borderWidth="1"
						:backgroundColor="selected === choice.value ? withAlpha(accent, 0.12) : '#16231D'"
						:borderColor="selected === choice.value ? withAlpha(accent, 0.6) : '#2A3C30'"
						accessible="true"
						accessibilityRole="button"
						:accessibilityLabel="`${choice.title}, ${choice.value} percent${selected === choice.value ? ', selected' : ''}`"
						v-press="[{ scale: 0.98 }, { ...springs.snap, haptic: 'light' }]"
						@tap="selected = choice.value"
					>
						<StackLayout
							><Label
								:text="choice.title"
								fontSize="15"
								color="#ECF4E8"
								class="body-strong" /><Label
								:text="choice.detail"
								fontSize="11"
								color="#95AA9C"
								class="body"
								marginTop="5"
						/></StackLayout>
						<Label
							col="1"
							:text="`${choice.value}%`"
							fontSize="27"
							:color="selected === choice.value ? accent : '#D2DFCF'"
							class="display"
							verticalAlignment="middle"
						/>
					</GridLayout>
					<StackLayout orientation="horizontal" margin="11 0 22" horizontalAlignment="center">
						<Icon name="navigate-outline" :size="13" :color="accent" marginRight="7" />
						<Label
							:text="`Up to ${selected * 4} miles of possibility.`"
							fontSize="12"
							color="#C0D0BE"
							class="body-medium"
						/>
					</StackLayout>
					<GridLayout
						height="52"
						borderRadius="18"
						:backgroundColor="accent"
						accessible="true"
						accessibilityRole="button"
						accessibilityLabel="Save charge plan"
						v-press="[{ scale: 0.97 }, { ...springs.snap, haptic: 'medium' }]"
						@tap="save"
					>
						<Label
							text="Make it the plan ↗"
							class="body-strong"
							fontSize="14"
							color="#16220E"
							textAlignment="center"
							verticalAlignment="middle"
						/>
					</GridLayout>
					<Label
						text="DEMO ESTIMATE · NO VEHICLE COMMANDS"
						class="body-strong"
						fontSize="6.5"
						letterSpacing="0.1"
						color="#708673"
						textAlignment="center"
						marginTop="14"
					/>
				</StackLayout>
			</ScrollView>
		</GestureSurface>
	</GridLayout>
</template>

<style scoped>
.plan {
	margin: 0 10;
	border-radius: 28;
	border-width: 1;
	border-color: #39503c;
}
.eyebrow {
	font-size: 8;
	letter-spacing: 0.13;
}
.title {
	font-size: 25;
	color: #f0f6e8;
	margin-top: 7;
}
</style>
