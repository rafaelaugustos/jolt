import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'nativescript-vue';
import type { ScrollView } from '@nativescript/core';
import { bind, set, type MotionValue } from '@rafaelaugusto/jolt';
import { GestureSurface, gestures, type Gestures } from '@rafaelaugusto/jolt/gestures';
import { useReducedMotion } from '@rafaelaugusto/jolt/vue';
import type { NativeElement } from '@/utils/native-element';

interface CockpitOptions {
	offset: MotionValue;
	height: number;
	closed: number;
	active: boolean;
}

export function useCockpitGesture(props: Readonly<CockpitOptions>) {
	const reduced = useReducedMotion();
	const root = useTemplateRef<NativeElement<GestureSurface>>('root');
	const scrollContent = useTemplateRef<NativeElement<ScrollView>>('scrollContent');
	const expanded = ref(false);
	let suppressTapUntil = 0;
	let panelGesture: Gestures | undefined;
	let releasePanelBinding: (() => void) | undefined;
	let releaseOffsetSync: (() => void) | undefined;
	let pendingMove: { target: number; resolve: (completed: boolean) => void } | undefined;
	const finishMove = (completed: boolean) => {
		const pending = pendingMove;
		pendingMove = undefined;
		pending?.resolve(completed);
	};
	const updateExpanded = () => {
		expanded.value = props.offset.get() < props.closed / 2;
	};
	const movePanel = (y: number) => {
		finishMove(false);
		if (!panelGesture) return Promise.resolve(false);
		const finished = new Promise<boolean>((resolve) => {
			pendingMove = { target: y, resolve };
		});
		if (reduced.value) panelGesture.jumpTo({ y });
		else panelGesture.settleTo({ y });
		if (Math.abs(panelGesture.position.y - y) < 0.1) finishMove(true);
		return finished;
	};
	const toggle = async () => {
		if (Date.now() < suppressTapUntil) return;
		const opening = (panelGesture?.position.y ?? props.offset.get()) > props.closed / 2;
		expanded.value = opening;
		movePanel(opening ? 0 : props.closed);
	};
	const close = async () => {
		expanded.value = false;
		await movePanel(props.closed);
	};
	const enter = () => {
		panelGesture?.jumpTo({ y: props.height });
		set(props.offset, props.height);
		void movePanel(props.closed).then((completed) => {
			if (completed) panelGesture?.updateBounds({ top: 0, bottom: props.closed });
		});
	};
	watch(
		() => props.active,
		(active) => {
			if (active) panelGesture?.play();
			else {
				panelGesture?.pause();
				finishMove(false);
			}
		},
	);
	onMounted(() => {
		const nativeRoot = root.value!.nativeView;
		const nativeScroll = scrollContent.value!.nativeView;
		panelGesture = gestures(nativeRoot, {
			initial: { y: props.offset.get() },
			pan: { axis: 'y', bounds: { top: 0, bottom: props.height }, failOffset: 18 },
			scrollView: nativeScroll,
			spring: { stiffness: 280, damping: 30 },
			onStart: () => {
				suppressTapUntil = Infinity;
				finishMove(false);
			},
			onEnd: (event) => {
				suppressTapUntil = Date.now() + 350;
				expanded.value = event.y + event.velocityY * 0.18 < props.closed / 2;
				panelGesture?.settleTo({ y: expanded.value ? 0 : props.closed });
			},
			onCancel: () => {
				suppressTapUntil = Date.now() + 350;
				updateExpanded();
			},
		});
		if (!panelGesture) return;
		releasePanelBinding = bind(root.value!.nativeView, { y: panelGesture.y });
		// SceneKit and gradient adapters still need a regular motion value.
		// Keep the gesture bridge scoped to this panel.
		releaseOffsetSync = panelGesture.y.subscribe((value) => {
			set(props.offset, value);
			expanded.value = value < props.closed / 2;
			if (pendingMove && Math.abs(value - pendingMove.target) < 0.1) finishMove(true);
		});
	});
	onUnmounted(() => {
		finishMove(false);
		releaseOffsetSync?.();
		releasePanelBinding?.();
		panelGesture?.dispose();
	});
	return { root, expanded, enter, close, toggle };
}
