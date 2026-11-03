<script lang="ts" setup>
import { shallowRef, onMounted, onUnmounted, ref, watch } from 'nativescript-vue';
import type { NativeElement } from '@/utils/native-element';
import { Application, type EventData } from '@nativescript/core';
import {
	drag,
	seekableTimeline,
	set,
	stop,
	type DerivedValue,
	type MotionValue,
} from '@rafaelaugusto/jolt';
import {
	useBinding,
	useMotionScope,
	useMotionValue,
	useReducedMotion,
} from '@rafaelaugusto/jolt/vue';
import { springs } from '@/themes/motion';
import { createCarStage, type OrbitCamera } from './car-stage';
import ClimatePanel from './ClimatePanel.vue';
import type { SceneView } from './scene-view';

const DEGREES_PER_DIP = 0.45;
const IDLE_SPIN = 4;
const FRAMING: OrbitCamera = {
	near: { radius: 7.6, height: 1.9, target: { x: 0, y: 0.35, z: 0 } },
	far: { radius: 12.8, height: 3.6, target: { x: 0, y: 0.35, z: 0 } },
	fov: 38,
};

const props = withDefaults(
	defineProps<{
		target: number;
		charge: MotionValue;
		framing?: DerivedValue;
		inset?: number;
		interactive?: boolean;
		active?: boolean;
	}>(),
	{
		inset: 0,
		interactive: true,
		active: true,
	},
);
const emit = defineEmits<{ ready: []; target: [value: number] }>();

const motion = useMotionScope();
const reduced = useReducedMotion();
const yaw = useMotionValue(80 / DEGREES_PER_DIP);
const inside = useMotionValue(0);
const travel = useMotionValue(0);
const lift = useMotionValue(0);
const lamp = useMotionValue(0);
const charge = props.charge;
const airGlow = useMotionValue(0);
const airOpacity = useMotionValue(0);
const restFrame = useMotionValue(0);
const veil = useBinding({ opacity: inside.to([0.55, 0.76, 0.94], [0, 0.92, 0]) });

const surface = shallowRef<NativeElement>();
const cabinOpen = ref(false);
const fan = ref(3);
const stage = createCarStage({ name: 'car', extension: 'usdz' });
const stageMotion = motion.add(
	stage.connect(
		{
			yaw: yaw.to([0, 1], [0, DEGREES_PER_DIP], { clamp: false }),
			framing: props.framing ?? restFrame,
			inside,
			travel,
			lift,
			lamp,
			charge,
			airGlow,
			airOpacity,
		},
		FRAMING,
	),
);
let sceneView: SceneView['sceneView'] | undefined;
let lit = 0;
let cabinRevision = 0;
let chargeRevision = 0;
let disposed = false;
let foreground = true;
let chargingOn = false;

const spin = () => {
	if (!props.active || !foreground || reduced.value || inside.get() > 0) return;
	motion.animate(yaw, yaw.get() + 3600 / DEGREES_PER_DIP, {
		duration: (3600 / IDLE_SPIN) * 1000,
		ease: 'linear',
	});
};

const onSceneLoaded = (args: EventData) => {
	const view = (args.object as SceneView).sceneView;
	if (!view) {
		emit('ready');
		return;
	}
	view.scene = stage.scene;
	view.pointOfView = stage.camera;
	sceneView = view;
	view.rendersContinuously = props.active && foreground;
	view.playing = props.active && foreground;
	props.active && foreground ? stageMotion.play() : stageMotion.pause();
	emit('ready');
};

const squat = async (depth = 0.035) => {
	if (reduced.value) return;
	await motion.animate(lift, -depth, { duration: 140, ease: 'quadOut' });
	if (disposed) return;
	await motion.animate(lift, 0, springs.settle);
};

const introduce = async () => {
	stageMotion.orbit();
	if (reduced.value) return spin();
	set(travel, -14);
	const entrance = motion.add(
		seekableTimeline([
			{ value: travel, keyframes: [-14, 0], transition: { duration: 2600, ease: 'quartOut' } },
			{ value: lamp, keyframes: [lamp.get(), 1], at: 200, transition: { duration: 500 } },
			{
				value: yaw,
				keyframes: [yaw.get(), 30 / DEGREES_PER_DIP],
				at: 1200,
				transition: { duration: 3400, ease: 'cubicInOut' },
			},
			{
				value: lift,
				keyframes: [0, -0.025, 0],
				at: 2600,
				transition: { duration: 560, times: [0, 0.25, 1], ease: 'quadOut' },
			},
		]),
	);
	if (!(await entrance.finished) || disposed) return;
	motion.animate(lamp, lit, { duration: 900, delay: 600, ease: 'quadInOut' });
	spin();
};

const lightsOn = (on: boolean) => {
	lit = on ? 1 : 0;
	return motion.animate(lamp, lit, { duration: 380, ease: 'quadOut' });
};

const flash = () => {
	squat();
	return motion.animate(lamp, [null, 0, 1, 0, 1, lit], { duration: 900, ease: 'easeInOut' });
};

const charging = async (on: boolean) => {
	chargingOn = on;
	const revision = ++chargeRevision;
	if (motion.suspended) {
		set(charge, on ? 1 : 0);
		return;
	}
	if (!on) return motion.animate(charge, 0, { duration: 320 });
	await motion.animate(charge, 1, { duration: 260 });
	if (!disposed && revision === chargeRevision && !reduced.value) {
		motion.animate(charge, [1, 0.3], {
			duration: 1100,
			ease: 'sineInOut',
			repeat: Infinity,
			repeatType: 'reverse',
		});
	}
};

const climate = (on: boolean) => {
	stage.climate(on, fan.value);
	const duration = reduced.value ? 0 : on ? 900 : 600;
	motion.animate(airGlow, on ? 1.4 + fan.value * 0.3 : 0, { duration, ease: 'easeInOut' });
	motion.animate(airOpacity, on ? 1 : 0, { duration, ease: 'easeInOut' });
};

const enterCabin = async () => {
	const revision = ++cabinRevision;
	if (!reduced.value) {
		const current = yaw.get() * DEGREES_PER_DIP;
		const turn = ((((stage.doorYaw() - current) % 360) + 540) % 360) - 180;
		await motion.animate(yaw, (current + turn) / DEGREES_PER_DIP, {
			duration: 900,
			ease: 'cubicInOut',
		});
	}
	if (disposed || revision !== cabinRevision) return;
	stageMotion.cabin();
	await motion.animate(
		inside,
		1,
		reduced.value ? { duration: 0 } : { duration: 1900, ease: 'cubicInOut' },
	);
	if (disposed || revision !== cabinRevision) return;
	climate(true);
	cabinOpen.value = true;
};

const leaveCabin = async () => {
	const revision = ++cabinRevision;
	cabinOpen.value = false;
	climate(false);
	stageMotion.cabin();
	await motion.animate(
		inside,
		0,
		reduced.value ? { duration: 0 } : { duration: 1400, ease: 'cubicInOut' },
	);
	if (!disposed && revision === cabinRevision) {
		stageMotion.orbit();
		spin();
	}
};

const setFan = (level: number) => {
	fan.value = level;
	climate(true);
};

watch(reduced, (on) => {
	if (on) stop(yaw);
	else if (props.interactive && !motion.suspended) spin();
	if (chargingOn) charging(true);
});

const syncActive = () => {
	const active = props.active && foreground;
	if (sceneView) {
		sceneView.rendersContinuously = active;
		sceneView.playing = active;
	}
	if (active) {
		motion.resume();
		stageMotion.play();
		spin();
		if (chargingOn) void charging(true);
	} else {
		stop(yaw);
		motion.suspend();
		stageMotion.pause();
	}
};
const suspendScene = () => {
	foreground = false;
	syncActive();
};
const resumeScene = () => {
	foreground = true;
	syncActive();
};
watch(() => props.active, syncActive);

onMounted(() => {
	Application.on(Application.suspendEvent, suspendScene);
	Application.on(Application.resumeEvent, resumeScene);
	motion.use(() =>
		drag(surface.value!, {
			axis: 'x',
			value: yaw,
			friction: 0.92,
			onSettle: () => spin(),
		}),
	);
});

onUnmounted(() => {
	Application.off(Application.suspendEvent, suspendScene);
	Application.off(Application.resumeEvent, resumeScene);
	disposed = true;
	cabinRevision++;
	chargeRevision++;
});

defineExpose({ introduce, enterCabin, leaveCabin, lightsOn, flash, squat, charging });
</script>

<template>
	<GridLayout>
		<SceneView @loaded="onSceneLoaded" />
		<GridLayout
			ref="surface"
			backgroundColor="rgba(0,0,0,0.001)"
			:isUserInteractionEnabled="interactive && !cabinOpen"
		/>
		<GridLayout :ref="veil" class="veil" opacity="0" isUserInteractionEnabled="false" />
		<ClimatePanel
			:marginBottom="inset"
			:open="cabinOpen"
			:target="props.target"
			:fan="fan"
			@target="emit('target', $event)"
			@fan="setFan"
		/>
	</GridLayout>
</template>

<style scoped>
.veil {
	background-color: #05070a;
}
</style>
