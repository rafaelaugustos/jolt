import { sceneKitFieldOfView, type NativeProperty } from '../src/native/index.js'
declare const camera: SCNCamera
declare const node: SCNNode
const fov: NativeProperty<number> = sceneKitFieldOfView(camera)
fov.animate(35, 'smooth')
// @ts-expect-error The target is the camera, not its node.
sceneKitFieldOfView(node)
// @ts-expect-error FOV accepts numeric degrees, not CSS units.
fov.set('45deg')
