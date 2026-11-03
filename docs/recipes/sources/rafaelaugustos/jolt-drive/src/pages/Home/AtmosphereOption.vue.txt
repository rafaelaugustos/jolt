<script lang="ts" setup>
import { watch } from 'nativescript-vue';
import { set, springValue } from '@rafaelaugusto/jolt';
import { useBinding, useMotionScope, useMotionValue } from '@rafaelaugusto/jolt/vue';
import { springs } from '@/themes/motion';
import { withAlpha } from '@/themes/palette';

const props = defineProps<{ name: string; color: string; selected: boolean }>();
const emit = defineEmits<{ select: [] }>();
const motion = useMotionScope();
const target = useMotionValue(props.selected ? 1 : 0);
const selection = motion.add(springValue(target, springs.snap));
const surface = useBinding({
	backgroundColor: selection.to([0, 1], ['#ffffff05', withAlpha(props.color, 0.12)]),
	borderColor: selection.to([0, 1], ['#ffffff10', withAlpha(props.color, 0.55)]),
	borderRadius: selection.to([0, 1], [15, 18]),
});
const label = useBinding({ color: selection.to([0, 1], ['#8E9C93', props.color]) });

watch(
	() => props.selected,
	(selected) => set(target, selected ? 1 : 0),
);
</script>

<template>
	<GridLayout
		:ref="surface"
		columns="auto, auto"
		class="option"
		accessible="true"
		accessibilityRole="button"
		:accessibilityLabel="`${name} atmosphere${selected ? ', selected' : ''}`"
		v-press="[{ scale: 0.96 }, { ...springs.snap, haptic: 'selection' }]"
		@tap="emit('select')"
	>
		<ContentView
			width="8"
			height="8"
			borderRadius="4"
			:backgroundColor="color"
			verticalAlignment="middle"
			marginRight="7"
		/>
		<Label :ref="label" col="1" :text="name" class="label body-medium" verticalAlignment="middle" />
	</GridLayout>
</template>

<style scoped>
.option {
	border-width: 1;
	horizontal-align: stretch;
	padding: 0 10;
}
.label {
	font-size: 10;
}
</style>
