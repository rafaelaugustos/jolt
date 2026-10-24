import { Color } from '@nativescript/core'
import { NativeLightingDemo } from './scene-lighting.ios'

export const cabinShader = `#pragma arguments
float cabinView;
#pragma body
_output.color.rgb = mix(_output.color.rgb, float3(0.035, 0.11, 0.16), cabinView);
`
export const signalShader = `#pragma arguments
float3 signalTint;
#pragma body
_output.color.rgb = signalTint;
`
/** A real, generated lat-long environment image; drawing happens only at scene setup. */
export function studioImage(warm = false): UIImage {
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(512, 256), true, 1)
  for (let row = 0; row < 256; row++) {
    const t = row / 255,
      level = 0.14 + 0.64 * Math.sin(t * Math.PI)
    UIColor.colorWithRedGreenBlueAlpha(
      level,
      level * (warm ? 0.86 : 1),
      level * (warm ? 0.68 : 1),
      1,
    ).setFill()
    UIRectFill(CGRectMake(0, row, 512, 1))
  }
  UIColor.whiteColor.setFill()
  UIRectFill(CGRectMake(42, 55, 80, 66))
  UIRectFill(CGRectMake(300, 40, 130, 48))
  const result = UIGraphicsGetImageFromCurrentImageContext()
  UIGraphicsEndImageContext()
  return result!
}
export class NativeShaderDemo extends NativeLightingDemo {
  get scene(): SCNScene {
    return (this.nativeViewProtected as SCNView).scene!
  }
  override initNativeView() {
    super.initNativeView()
    const view = this.nativeViewProtected as SCNView
    view.accessibilityLabel = 'Studio car with environment lighting and cabin shader'
    view.backgroundColor = new Color('#111e2d').ios
    this.scene.background.contents = new Color('#111e2d').ios
    this.camera.position = new SCNVector3({ x: 4, y: 3.3, z: 6.5 })
    this.camera.lookAt(new SCNVector3({ x: 0, y: 0.5, z: 0 }))
    this.scene.rootNode.enumerateChildNodesUsingBlock((node: SCNNode) => {
      if (node.light) node.light.intensity = 0
    })
    this.scene.lightingEnvironment.contents = studioImage()
    this.scene.lightingEnvironment.intensity = 1.6
    this.paint.lightingModelName = SCNLightingModelPhysicallyBased
    this.paint.diffuse.contents = new Color('#7197B5').ios
    this.paint.roughness.contents = NSNumber.numberWithDouble(0.22)
    this.paint.metalness.contents = NSNumber.numberWithDouble(0.65)
    this.camera.camera!.exposureOffset = 0
    this.camera.camera!.bloomIntensity = 0
    this.glass.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
      cabinShader,
      SCNShaderModifierEntryPointFragment,
    )
    this.glass.setValueForKey(0, 'cabinView')
    this.charge.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
      signalShader,
      SCNShaderModifierEntryPointFragment,
    )
    this.charge.setValueForKey(
      NSValue.valueWithSCNVector3(new SCNVector3({ x: 0.12, y: 0.75, z: 1 })),
      'signalTint',
    )
  }
}
