import { View, Color } from '@nativescript/core'

/** Scene setup only. All animated camera/light/material writes belong to Jolt's compiled sinks. */
export class NativeLightingDemo extends View {
  camera!: SCNNode
  keyLight!: SCNLight
  paint!: SCNMaterial
  charge!: SCNMaterial
  glass!: SCNMaterial
  sharedNodes: SCNNode[] = []
  createNativeView() {
    return SCNView.alloc().initWithFrameOptions(CGRectZero, null)
  }
  initNativeView() {
    super.initNativeView()
    const view = this.nativeViewProtected as SCNView,
      scene = SCNScene.scene()
    view.scene = scene
    // Present the scene as one image; projected node bounds may extend outside its viewport.
    view.isAccessibilityElement = true
    view.accessibilityLabel = 'Electric car and two shared charging panels'
    view.accessibilityTraits = UIAccessibilityTraitImage
    view.backgroundColor = new Color('#091321').ios
    view.antialiasingMode = SCNAntialiasingMode.Multisampling4X
    view.playing = true
    const material = (color: string) => {
      const m = SCNMaterial.material()
      m.lightingModelName = SCNLightingModelPhysicallyBased
      m.diffuse.contents = new Color(color).ios
      m.emission.contents = UIColor.blackColor
      m.roughness.contents = NSNumber.numberWithDouble(0.45)
      m.metalness.contents = NSNumber.numberWithDouble(0.15)
      return m
    }
    const block = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      m: SCNMaterial,
      radius = 0.08,
    ) => {
      const box = SCNBox.boxWithWidthHeightLengthChamferRadius(w, h, d, radius)
      box.firstMaterial = m
      const node = SCNNode.nodeWithGeometry(box)
      node.position = new SCNVector3({ x, y, z })
      scene.rootNode.addChildNode(node)
      return node
    }
    this.paint = material('#2563eb')
    this.paint.lightingModelName = SCNLightingModelLambert
    this.glass = material('#294658')
    this.glass.transparencyMode = SCNTransparencyMode.DualLayer
    this.charge = material('#0f3047')
    block(0, -0.12, 0, 12, 0.2, 12, material('#27364a'))
    block(0, 0.6, 0, 1.85, 0.52, 3.4, this.paint, 0.2)
    block(0, 1.05, -0.1, 1.5, 0.5, 1.7, this.glass, 0.16)
    const rubber = material('#13151b')
    for (const x of [-0.97, 0.97])
      for (const z of [-1.05, 1.05]) {
        const wheel = SCNCylinder.cylinderWithRadiusHeight(0.32, 0.23)
        wheel.firstMaterial = rubber
        const node = SCNNode.nodeWithGeometry(wheel)
        node.position = new SCNVector3({ x, y: 0.32, z })
        node.eulerAngles = new SCNVector3({ x: 0, y: 0, z: Math.PI / 2 })
        scene.rootNode.addChildNode(node)
      }
    this.sharedNodes = []
    for (const x of [-2.1, 2.1]) {
      block(x, 0.6, -0.9, 0.45, 1.2, 0.45, material('#18263a'))
      this.sharedNodes.push(block(x, 1, -0.65, 0.3, 0.55, 0.08, this.charge, 0.035))
    }
    block(0, 0.52, 1.73, 1.45, 0.09, 0.06, this.charge, 0.025)
    this.keyLight = SCNLight.light()
    this.keyLight.type = SCNLightTypeOmni
    this.keyLight.color = UIColor.whiteColor
    this.keyLight.intensity = 550
    const lamp = SCNNode.node()
    lamp.light = this.keyLight
    lamp.position = new SCNVector3({ x: -2, y: 4, z: 3 })
    scene.rootNode.addChildNode(lamp)
    const ambient = SCNNode.node()
    ambient.light = SCNLight.light()
    ambient.light.type = SCNLightTypeAmbient
    ambient.light.color = new Color('#b3d4ff').ios
    ambient.light.intensity = 220
    scene.rootNode.addChildNode(ambient)
    this.camera = SCNNode.node()
    this.camera.camera = SCNCamera.camera()
    this.camera.camera.fieldOfView = 48
    this.camera.camera.wantsHDR = true
    this.camera.camera.exposureOffset = -1
    this.camera.camera.wantsExposureAdaptation = false
    this.camera.camera.bloomIntensity = 0.2
    this.camera.camera.bloomThreshold = 1.2
    this.camera.position = new SCNVector3({ x: 0, y: 3.3, z: 8.5 })
    this.camera.orientation = new SCNVector4({
      x: -Math.sin(0.16),
      y: 0,
      z: 0,
      w: Math.cos(0.16),
    })
    scene.rootNode.addChildNode(this.camera)
    view.pointOfView = this.camera
  }
  disposeNativeView() {
    const view = this.nativeViewProtected as SCNView
    view.playing = false
    view.pointOfView = null
    view.scene = null
    this.sharedNodes = []
    this.camera =
      this.keyLight =
      this.paint =
      this.charge =
      this.glass =
        undefined as never
    super.disposeNativeView()
  }
}
