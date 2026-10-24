import { registerElement } from 'nativescript-vue'
import { HapticProbe } from './haptic-probe'
import { NativeMapDemo, NativeSceneDemo } from './native-demo'
import { NativeLightingDemo } from './scene-lighting'
import { NativeShaderDemo } from './scene-shader'
import { StudioScene } from './showcase/studio-scene'

// Registration belongs to the app module, not a component's setup. Routed
// examples mount repeatedly, while the native element registry is process-wide.
registerElement('HapticProbe', () => HapticProbe)
registerElement('NativeMapDemo', () => NativeMapDemo)
registerElement('NativeSceneDemo', () => NativeSceneDemo)
registerElement('NativeCameraDemo', () => NativeLightingDemo)
registerElement('NativeLightingDemo', () => NativeLightingDemo)
registerElement('NativeShaderDemo', () => NativeShaderDemo)
registerElement('StudioScene', () => StudioScene)
registerElement('PlaybackStudioScene', () => StudioScene)
