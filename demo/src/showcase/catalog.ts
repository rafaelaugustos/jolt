import ScrollHeaderLab from '../components/ScrollHeaderLab.vue'
import ReturnTargetsLab from '../components/ReturnTargetsLab.vue'
import GalleryLab from '../components/GalleryLab.vue'
import SharedEntryLab from '../components/SharedEntryLab.vue'
import PredictiveBackLab from '../components/PredictiveBackLab.vue'
import SharedNavigationLab from '../components/SharedNavigationLab.vue'
import InteractiveNavigationLab from '../components/InteractiveNavigationLab.vue'
import MotionInspectorLab from '../components/MotionInspectorLab.vue'
import CurveSamplingLab from '../components/CurveSamplingLab.vue'
import InteractionReplayLab from '../components/InteractionReplayLab.vue'
import SharedLayoutLab from '../components/SharedLayoutLab.vue'
import MotionStudio from './MotionStudio.vue'
import { markRaw } from 'nativescript-vue'
import ReorderLab from '../components/ReorderLab.vue'
import Decay from '../components/Decay.vue'
import Stagger from '../components/Stagger.vue'
import MotionPath from '../components/MotionPath.vue'
import Timeline from '../components/Timeline.vue'
import Playback from '../components/Playback.vue'
import Loops from '../components/Loops.vue'
import Pauses from '../components/Pauses.vue'
import RandomPauses from '../components/RandomPauses.vue'
import TrackEasing from '../components/TrackEasing.vue'
import EasingCurves from '../components/EasingCurves.vue'
import Tuning from '../components/Tuning.vue'
import Press from '../components/Press.vue'
import GestureLab from '../components/GestureLab.vue'
import LiveSprings from '../components/LiveSprings.vue'
import DragLab from '../components/DragLab.vue'
import DragValues from '../components/DragValues.vue'
import Keyboard from '../components/Keyboard.vue'
import Haptics from '../components/Haptics.vue'
import Gradients from '../components/Gradients.vue'
import GradientDirective from '../components/GradientDirective.vue'
import GradientValues from '../components/GradientValues.vue'
import Shimmer from '../components/Shimmer.vue'
import Particles from '../components/Particles.vue'
import Loaders from '../components/Loaders.vue'
import Reveal from '../components/Reveal.vue'
import ImageLab from '../components/ImageLab.vue'
import OpacityRotation from '../components/OpacityRotation.vue'
import FadeOverflow from '../components/FadeOverflow.vue'
import Text from '../components/Text.vue'
import Rolling from '../components/Rolling.vue'
import RollingLayout from '../components/RollingLayout.vue'
import Symbols from '../components/Symbols.vue'
import LayoutLab from '../components/LayoutLab.vue'
import SizeLab from '../components/SizeLab.vue'
import ListItems from '../components/ListItems.vue'
import ScrollValues from '../components/ScrollValues.vue'
import Remount from '../components/Remount.vue'
import MotionValues from '../components/MotionValues.vue'
import ValueObservers from '../components/ValueObservers.vue'
import ValueLayers from '../components/ValueLayers.vue'
import Layers from '../components/Layers.vue'
import MotionStates from '../components/MotionStates.vue'
import StateTransitions from '../components/StateTransitions.vue'
import BusyJs from '../components/BusyJs.vue'
import VueAdapter from '../components/VueAdapter.vue'
import FromReactNative from '../components/FromReactNative.vue'
import SceneStudio from './SceneStudio.vue'
import PlaybackLab from '../components/PlaybackLab.vue'

export const categories = [
  'All',
  'Motion',
  'Touch',
  'Visual',
  'Type',
  'Layout',
  'State',
  'SceneKit',
] as const
export const examples = [
  {
    id: 'scroll-header',
    title: 'Made to scroll',
    category: 'Layout',
    description: 'One scroll. Everything in its place.',
    component: markRaw(ScrollHeaderLab),
    full: true,
    ios: false,
  },
  {
    id: 'gallery',
    title: 'The living gallery',
    category: 'Touch',
    description: 'Open. Explore. Find your way home.',
    component: markRaw(GalleryLab),
    full: true,
    ios: false,
  },
  {
    id: 'return-targets',
    title: 'Find the way back',
    category: 'Layout',
    description: 'The right photo. Wherever it moved.',
    component: markRaw(ReturnTargetsLab),
    full: true,
    ios: false,
  },
  {
    id: 'shared-entry',
    title: 'Shared gestures',
    category: 'Layout',
    description: 'One image. Every part of the journey.',
    component: markRaw(SharedEntryLab),
    full: true,
    ios: false,
  },
  {
    id: 'predictive-back',
    title: 'Predictive back',
    category: 'Touch',
    description: 'A little room to change your mind.',
    component: markRaw(PredictiveBackLab),
    full: true,
    ios: false,
  },
  {
    id: 'springs',
    title: 'Springs',
    category: 'Motion',
    description: 'Interrupt it. It keeps its momentum.',
    component: markRaw(MotionStudio),
    full: false,
    ios: false,
  },
  {
    id: 'presets',
    title: 'Presets',
    category: 'Motion',
    description: 'Small entrances with a big personality.',
    component: markRaw(MotionStudio),
    full: false,
    ios: false,
  },
  {
    id: 'decay',
    title: 'Momentum',
    category: 'Motion',
    description: 'Flick, coast and come to rest.',
    component: markRaw(Decay),
    full: false,
    ios: false,
  },
  {
    id: 'stagger',
    title: 'Stagger',
    category: 'Motion',
    description: 'One movement. A beautiful ripple.',
    component: markRaw(Stagger),
    full: false,
    ios: false,
  },
  {
    id: 'motion-path',
    title: 'Motion paths',
    category: 'Motion',
    description: 'Take the scenic route.',
    component: markRaw(MotionPath),
    full: false,
    ios: false,
  },
  {
    id: 'timeline',
    title: 'Timelines',
    category: 'Motion',
    description: 'Choreograph a whole sequence.',
    component: markRaw(Timeline),
    full: false,
    ios: false,
  },
  {
    id: 'playback',
    title: 'Playback',
    category: 'Motion',
    description: 'Pause, scrub and play it your way.',
    component: markRaw(Playback),
    full: false,
    ios: false,
  },
  {
    id: 'loops',
    title: 'Loops',
    category: 'Motion',
    description: 'Find your rhythm.',
    component: markRaw(Loops),
    full: false,
    ios: false,
  },
  {
    id: 'pauses',
    title: 'Pauses',
    category: 'Motion',
    description: 'Make room between movements.',
    component: markRaw(Pauses),
    full: false,
    ios: false,
  },
  {
    id: 'random-pauses',
    title: 'Organic timing',
    category: 'Motion',
    description: 'A rhythm that feels less mechanical.',
    component: markRaw(RandomPauses),
    full: false,
    ios: false,
  },
  {
    id: 'track-easing',
    title: 'Track easing',
    category: 'Motion',
    description: 'Give each property its own rhythm.',
    component: markRaw(TrackEasing),
    full: false,
    ios: false,
  },
  {
    id: 'easing-curves',
    title: 'Easing curves',
    category: 'Motion',
    description: 'Feel the difference a curve makes.',
    component: markRaw(EasingCurves),
    full: false,
    ios: false,
  },
  {
    id: 'tuning',
    title: 'Motion settings',
    category: 'Motion',
    description: 'Find your pace. Respect reduced motion.',
    component: markRaw(Tuning),
    full: false,
    ios: false,
  },
  {
    id: 'press',
    title: 'Press feedback',
    category: 'Touch',
    description: 'A little response to every touch.',
    component: markRaw(Press),
    full: false,
    ios: false,
  },
  {
    id: 'gesture-lab',
    title: 'Native gestures',
    category: 'Touch',
    description: 'Pan, pinch and rotate together.',
    component: markRaw(GestureLab),
    full: true,
    ios: false,
  },
  {
    id: 'live-springs',
    title: 'Live springs',
    category: 'Touch',
    description: 'Follow your finger, then settle.',
    component: markRaw(LiveSprings),
    full: true,
    ios: false,
  },
  {
    id: 'drag-lab',
    title: 'Drag & snap',
    category: 'Touch',
    description: 'Pick it up. Let it find its place.',
    component: markRaw(DragLab),
    full: true,
    ios: false,
  },
  {
    id: 'drag-values',
    title: 'Drag a value',
    category: 'Touch',
    description: 'Your gesture becomes the motion.',
    component: markRaw(DragValues),
    full: true,
    ios: false,
  },
  {
    id: 'keyboard',
    title: 'Keyboard',
    category: 'Touch',
    description: 'A composer that moves with you.',
    component: markRaw(Keyboard),
    full: false,
    ios: false,
  },
  {
    id: 'haptics',
    title: 'Haptics',
    category: 'Touch',
    description: 'Feel the moments that matter.',
    component: markRaw(Haptics),
    full: false,
    ios: false,
  },
  {
    id: 'colors',
    title: 'Colors',
    category: 'Visual',
    description: 'Move through color, beautifully.',
    component: markRaw(MotionStudio),
    full: false,
    ios: false,
  },
  {
    id: 'gradients',
    title: 'Gradients',
    category: 'Visual',
    description: 'A softer kind of transformation.',
    component: markRaw(Gradients),
    full: false,
    ios: false,
  },
  {
    id: 'gradient-directive',
    title: 'Gradient directive',
    category: 'Visual',
    description: 'Bring a surface to life.',
    component: markRaw(GradientDirective),
    full: false,
    ios: false,
  },
  {
    id: 'gradient-values',
    title: 'Gradient values',
    category: 'Visual',
    description: 'One source, a spectrum of color.',
    component: markRaw(GradientValues),
    full: false,
    ios: false,
  },
  {
    id: 'decorations',
    title: 'Decorations',
    category: 'Visual',
    description: 'Corners, borders and shadows in motion.',
    component: markRaw(MotionStudio),
    full: false,
    ios: false,
  },
  {
    id: 'shimmer',
    title: 'Shimmer',
    category: 'Visual',
    description: 'Make the wait feel lighter.',
    component: markRaw(Shimmer),
    full: false,
    ios: true,
  },
  {
    id: 'particles',
    title: 'Particles',
    category: 'Visual',
    description: 'A little controlled chaos.',
    component: markRaw(Particles),
    full: false,
    ios: false,
  },
  {
    id: 'loaders',
    title: 'Loaders',
    category: 'Visual',
    description: 'Keep the anticipation moving.',
    component: markRaw(Loaders),
    full: false,
    ios: true,
  },
  {
    id: 'reveal',
    title: 'Reveals',
    category: 'Visual',
    description: 'Let the next thing unfold.',
    component: markRaw(Reveal),
    full: false,
    ios: true,
  },
  {
    id: 'image-lab',
    title: 'Images & zoom',
    category: 'Visual',
    description: 'Get closer. Change your perspective.',
    component: markRaw(ImageLab),
    full: true,
    ios: false,
  },
  {
    id: 'opacity-rotation',
    title: 'Light trails',
    category: 'Visual',
    description: 'Opacity and rotation, in orbit.',
    component: markRaw(OpacityRotation),
    full: false,
    ios: false,
  },
  {
    id: 'fade-overflow',
    title: 'Fade & overflow',
    category: 'Visual',
    description: 'Let content move beyond its frame.',
    component: markRaw(FadeOverflow),
    full: false,
    ios: false,
  },
  {
    id: 'text',
    title: 'Animated text',
    category: 'Type',
    description: 'Every word gets an entrance.',
    component: markRaw(Text),
    full: false,
    ios: false,
  },
  {
    id: 'rolling',
    title: 'Rolling numbers',
    category: 'Type',
    description: 'Make a changing number feel alive.',
    component: markRaw(Rolling),
    full: false,
    ios: false,
  },
  {
    id: 'rolling-layout',
    title: 'Rolling layout',
    category: 'Type',
    description: 'Numbers that make room for each other.',
    component: markRaw(RollingLayout),
    full: false,
    ios: false,
  },
  {
    id: 'symbols',
    title: 'Symbols',
    category: 'Type',
    description: 'Give an icon a little character.',
    component: markRaw(Symbols),
    full: false,
    ios: true,
  },
  {
    id: 'layout-lab',
    title: 'Layout changes',
    category: 'Layout',
    description: 'Let the whole interface find its place.',
    component: markRaw(LayoutLab),
    full: true,
    ios: false,
  },
  {
    id: 'size-lab',
    title: 'Real dimensions',
    category: 'Layout',
    description: 'Grow, shrink and make room.',
    component: markRaw(SizeLab),
    full: true,
    ios: false,
  },
  {
    id: 'list-items',
    title: 'Lists',
    category: 'Layout',
    description: 'A little choreography for your content.',
    component: markRaw(ListItems),
    full: false,
    ios: false,
  },
  {
    id: 'interaction-replay',
    title: 'Interaction replay',
    category: 'State',
    description: 'Keep the moment. Catch the regression.',
    component: markRaw(InteractionReplayLab),
    full: true,
    ios: false,
  },
  {
    id: 'interactive-navigation',
    title: 'Interactive navigation',
    category: 'Layout',
    description: 'A way back that follows your hand.',
    component: markRaw(InteractiveNavigationLab),
    full: true,
    ios: true,
  },
  {
    id: 'shared-navigation',
    title: 'Shared navigation',
    category: 'Layout',
    description: 'A new page. The same connection.',
    component: markRaw(SharedNavigationLab),
    full: true,
    ios: false,
  },
  {
    id: 'shared-layout',
    title: 'Shared layouts',
    category: 'Layout',
    description: 'One identity. A new place to belong.',
    component: markRaw(SharedLayoutLab),
    full: true,
    ios: false,
  },
  {
    id: 'reorder',
    title: 'Reorder a list',
    category: 'Layout',
    description: 'Hold a handle. Make room for a favourite.',
    component: markRaw(ReorderLab),
    full: true,
    ios: false,
  },
  {
    id: 'scroll-values',
    title: 'Scroll values',
    category: 'Layout',
    description: 'Let scrolling tell the story.',
    component: markRaw(ScrollValues),
    full: false,
    ios: false,
  },
  {
    id: 'remount',
    title: 'Remount',
    category: 'Layout',
    description: 'An entrance worth seeing again.',
    component: markRaw(Remount),
    full: false,
    ios: false,
  },
  {
    id: 'motion-values',
    title: 'Motion values',
    category: 'State',
    description: 'One value. Many moving parts.',
    component: markRaw(MotionValues),
    full: false,
    ios: false,
  },
  {
    id: 'value-observers',
    title: 'Value observers',
    category: 'State',
    description: 'Watch a movement take shape.',
    component: markRaw(ValueObservers),
    full: false,
    ios: false,
  },
  {
    id: 'value-layers',
    title: 'Value layers',
    category: 'State',
    description: 'Add a pulse without losing the flow.',
    component: markRaw(ValueLayers),
    full: false,
    ios: false,
  },
  {
    id: 'layers',
    title: 'Animation layers',
    category: 'State',
    description: 'Compose movements, independently.',
    component: markRaw(Layers),
    full: false,
    ios: false,
  },
  {
    id: 'motion-states',
    title: 'Motion states',
    category: 'State',
    description: 'Change state. Keep the continuity.',
    component: markRaw(MotionStates),
    full: false,
    ios: false,
  },
  {
    id: 'state-transitions',
    title: 'State transitions',
    category: 'State',
    description: 'Make every change feel intentional.',
    component: markRaw(StateTransitions),
    full: false,
    ios: false,
  },
  {
    id: 'busy-js',
    title: 'Busy JavaScript',
    category: 'State',
    description: 'See motion keep going under load.',
    component: markRaw(BusyJs),
    full: false,
    ios: false,
  },
  {
    id: 'vue-adapter',
    title: 'Vue integration',
    category: 'State',
    description: 'Motion that feels at home in Vue.',
    component: markRaw(VueAdapter),
    full: false,
    ios: false,
  },
  {
    id: 'from-react-native',
    title: 'Spring comparison',
    category: 'State',
    description: 'Explore familiar spring controls.',
    component: markRaw(FromReactNative),
    full: false,
    ios: false,
  },
  {
    id: 'scene-shader',
    title: 'Environment & shaders',
    category: 'SceneKit',
    description: 'One studio. A whole new atmosphere.',
    component: markRaw(SceneStudio),
    full: true,
    ios: true,
  },
  {
    id: 'scene-lighting',
    title: 'Lights & materials',
    category: 'SceneKit',
    description: 'Shape the light. Change the mood.',
    component: markRaw(SceneStudio),
    full: true,
    ios: true,
  },
  {
    id: 'scene-camera',
    title: 'Camera lens',
    category: 'SceneKit',
    description: 'A new perspective, in one movement.',
    component: markRaw(SceneStudio),
    full: true,
    ios: true,
  },
  {
    id: 'playback-lab',
    title: 'Maps & 3D',
    category: 'SceneKit',
    description: 'Take motion beyond the interface.',
    component: markRaw(PlaybackLab),
    full: true,
    ios: false,
  },
  {
    id: 'curve-sampling',
    title: 'Curve precision',
    category: 'Motion',
    description: 'Every curve. Just enough detail.',
    component: markRaw(CurveSamplingLab),
    full: false,
    ios: false,
  },
  {
    id: 'motion-inspector',
    title: 'Motion inspector',
    category: 'Motion',
    description: 'See the curve. Find the cause.',
    component: markRaw(MotionInspectorLab),
    full: false,
    ios: false,
  },
]
export type Example = (typeof examples)[number]
