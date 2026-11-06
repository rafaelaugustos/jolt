import { View } from '@nativescript/core'
import { sceneKitUniform } from '@rafaelaugusto/jolt/native'
export class PortableScene extends View {
  materials: SCNMaterial[] = []
  override createNativeView() {
    return SCNView.alloc().initWithFrameOptions(CGRectZero, null)
  }
  override initNativeView() {
    super.initNativeView()
    this.materials = []
    const view = this.nativeViewProtected as SCNView,
      scene = SCNScene.scene()
    view.scene = scene
    view.backgroundColor = UIColor.clearColor
    view.playing = false
    view.rendersContinuously = false
    view.antialiasingMode = SCNAntialiasingMode.Multisampling4X
    const camera = SCNNode.node()
    camera.camera = SCNCamera.camera()
    camera.position = new SCNVector3({ x: 0, y: 0, z: 6 })
    scene.rootNode.addChildNode(camera)
    view.pointOfView = camera
    for (let i = 0; i < 3; i++) {
      const geometry = SCNSphere.sphereWithRadius(0.55),
        material = SCNMaterial.material()
      material.lightingModelName = SCNLightingModelConstant
      material.diffuse.contents = UIColor.whiteColor
      material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
        '#pragma arguments\nfloat glow;\n#pragma body\n_output.color.rgb = mix(float3(0.08,0.17,0.25),float3(0.39,0.89,0.76),glow);',
        SCNShaderModifierEntryPointFragment,
      )
      material.setValueForKey(0.1, 'glow')
      geometry.firstMaterial = material
      const node = SCNNode.nodeWithGeometry(geometry)
      node.position = new SCNVector3({ x: (i - 1) * 1.5, y: 0, z: 0 })
      scene.rootNode.addChildNode(node)
      this.materials.push(material)
    }
  }
  properties() {
    return this.materials.map((material) =>
      sceneKitUniform(material, 'glow', {
        type: 'float',
        range: [0, 1],
        units: ['intensity'],
        motion: 'appearance',
      }),
    )
  }
  render(active: boolean) {
    const view = this.nativeViewProtected as SCNView
    view.rendersContinuously = active
    view.playing = active
  }
  redraw() {
    ;(this.nativeViewProtected as SCNView).setNeedsDisplay()
  }
  override disposeNativeView() {
    this.render(false)
    this.materials = []
    ;(this.nativeViewProtected as SCNView).scene = null
    super.disposeNativeView()
  }
}
