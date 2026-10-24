import { Color, View } from '@nativescript/core'
import type { ScenePose } from '@rafaelaugusto/jolt/native'

const vector = (x: number, y: number, z: number) => new SCNVector3({ x, y, z })
export function studioEnvironment(warm = false): UIImage {
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(1024, 512), true, 1)
  for (let y = 0; y < 512; y++) {
    const level = 0.025 + 0.055 * Math.sin((y / 512) * Math.PI)
    UIColor.colorWithRedGreenBlueAlpha(level, level, level * 1.1, 1).setFill()
    UIRectFill(CGRectMake(0, y, 1024, 1))
  }
  UIColor.colorWithRedGreenBlueAlpha(1, warm ? 0.77 : 0.98, warm ? 0.52 : 1, 1).setFill()
  UIBezierPath.bezierPathWithRoundedRectCornerRadius(
    CGRectMake(320, 20, 384, 60),
    14,
  ).fill()
  UIColor.colorWithRedGreenBlueAlpha(
    0.7,
    warm ? 0.62 : 0.8,
    warm ? 0.5 : 0.95,
    1,
  ).setFill()
  UIBezierPath.bezierPathWithRoundedRectCornerRadius(
    CGRectMake(60, 150, 130, 150),
    12,
  ).fill()
  UIBezierPath.bezierPathWithRoundedRectCornerRadius(
    CGRectMake(834, 150, 130, 150),
    12,
  ).fill()
  const result = UIGraphicsGetImageFromCurrentImageContext()!
  UIGraphicsEndImageContext()
  return result
}
export class StudioScene extends View {
  scene!: SCNScene
  camera!: SCNNode
  vehicle!: SCNNode
  paint!: SCNMaterial
  glass!: SCNMaterial
  signal!: SCNMaterial
  keyLight!: SCNLight
  detailedModel = false
  cameraPose(position: ScenePose['position']): ScenePose {
    const node = SCNNode.node()
    node.position = vector(...position)
    node.lookAt(vector(0, 0.35, 0))
    const q = node.orientation
    return { position, orientation: [q.x, q.y, q.z, q.w] }
  }
  createNativeView() {
    return SCNView.alloc().initWithFrameOptions(CGRectZero, null)
  }
  initNativeView() {
    super.initNativeView()
    const view = this.nativeViewProtected as SCNView
    const scene = (this.scene = SCNScene.scene())
    view.scene = scene
    view.playing = true
    view.antialiasingMode = SCNAntialiasingMode.Multisampling4X
    view.isAccessibilityElement = true
    view.accessibilityLabel = 'Jolt automotive studio'
    view.accessibilityTraits = UIAccessibilityTraitImage
    view.backgroundColor = new Color('#0B1016').ios
    scene.background.contents = new Color('#0B1016').ios
    scene.lightingEnvironment.contents = studioEnvironment()
    scene.lightingEnvironment.intensity = 1.1
    scene.fogColor = new Color('#0B1016').ios
    scene.fogStartDistance = 12
    scene.fogEndDistance = 24
    const material = (hex: string, metal = 0.2, rough = 0.25) => {
      const value = SCNMaterial.material()
      value.lightingModelName = SCNLightingModelPhysicallyBased
      value.diffuse.contents = new Color(hex).ios
      value.metalness.contents = NSNumber.numberWithDouble(metal)
      value.roughness.contents = NSNumber.numberWithDouble(rough)
      return value
    }
    this.paint = material('#CBD5DD', 0.5, 0.2)
    this.paint.clearCoat.contents = NSNumber.numberWithDouble(1)
    this.paint.clearCoatRoughness.contents = NSNumber.numberWithDouble(0.08)
    this.glass = material('#0A1722', 0.35, 0.1)
    this.glass.doubleSided = true
    this.signal = material('#D8EDFC', 0, 0.2)
    this.signal.emission.contents = new Color('#A2D7EE').ios
    this.signal.emission.intensity = 1.6
    this.glass.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
      '#pragma arguments\nfloat cabinView;\n#pragma body\n_output.color.rgb = mix(_output.color.rgb, float3(0.14, 0.23, 0.28), cabinView);',
      SCNShaderModifierEntryPointFragment,
    )
    this.glass.setValueForKey(0, 'cabinView')
    this.signal.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
      '#pragma arguments\nfloat3 signalTint;\n#pragma body\n_output.color.rgb = signalTint;',
      SCNShaderModifierEntryPointFragment,
    )
    this.signal.setValueForKey(
      NSValue.valueWithSCNVector3(vector(0.65, 0.85, 1)),
      'signalTint',
    )

    const vehicle = (this.vehicle = SCNNode.node())
    const url = NSBundle.mainBundle.URLForResourceWithExtension('preview-car', 'usdz')
    if (url) {
      const source = SCNScene.sceneWithURLOptionsError(url, null)
      for (const child of Array.from(
        { length: source.rootNode.childNodes.count },
        (_, i) => source.rootNode.childNodes.objectAtIndex(i),
      ))
        vehicle.addChildNode(child)
      vehicle.enumerateHierarchyUsingBlock((node: SCNNode) => {
        if (!node.geometry) return
        const replacements: SCNMaterial[] = []
        for (let i = 0; i < node.geometry.materials.count; i++) {
          const original = node.geometry.materials.objectAtIndex(i) as SCNMaterial
          const name = original.name || ''
          if (/CarExteriorShell/i.test(name)) replacements.push(this.paint)
          else if (/Glass/i.test(name)) replacements.push(this.glass)
          else if (/FrontLightBulb/i.test(name)) replacements.push(this.signal)
          else {
            const rubber = /Tire|BlackOut|matte/i.test(name)
            const brake = /Brake/i.test(name)
            const rim = /Rim|Rotor|Reflector|Metal/i.test(name)
            if (rubber || brake || rim) {
              original.diffuse.contents = new Color(
                brake ? '#B8533B' : rubber ? '#15191E' : '#343D46',
              ).ios
              original.lightingModelName = SCNLightingModelPhysicallyBased
              original.metalness.contents = NSNumber.numberWithDouble(rim ? 0.85 : 0.1)
              original.roughness.contents = NSNumber.numberWithDouble(
                rubber ? 0.75 : 0.25,
              )
              original.normal.contents = null
              original.transparent.contents = null
            }
            replacements.push(original)
          }
        }
        node.geometry.materials = NSArray.arrayWithArray(replacements)
      })
      const low = new interop.Reference(SCNVector3, vector(0, 0, 0))
      const high = new interop.Reference(SCNVector3, vector(0, 0, 0))
      vehicle.getBoundingBoxMinMax(low, high)
      const size = high.value,
        min = low.value
      const scale = 4.5 / Math.max(size.x - min.x, size.z - min.z)
      vehicle.scale = vector(scale, scale, scale)
      vehicle.position = vector(
        (-(size.x + min.x) * scale) / 2,
        -min.y * scale + 0.025,
        (-(size.z + min.z) * scale) / 2,
      )
      this.detailedModel = true
    } else {
      // Repository-only fallback is deliberate; the private preview asset is optional.
      const body = SCNBox.boxWithWidthHeightLengthChamferRadius(1.85, 0.52, 4.2, 0.25)
      body.firstMaterial = this.paint
      const shell = SCNNode.nodeWithGeometry(body)
      shell.position = vector(0, 0.6, 0)
      vehicle.addChildNode(shell)
      const roof = SCNBox.boxWithWidthHeightLengthChamferRadius(1.55, 0.48, 2, 0.24)
      roof.firstMaterial = this.glass
      const cabin = SCNNode.nodeWithGeometry(roof)
      cabin.position = vector(0, 1, -0.1)
      vehicle.addChildNode(cabin)
      for (const x of [-0.94, 0.94])
        for (const z of [-1.25, 1.25]) {
          const wheel = SCNCylinder.cylinderWithRadiusHeight(0.34, 0.22)
          wheel.firstMaterial = material('#12171C', 0.1, 0.8)
          const node = SCNNode.nodeWithGeometry(wheel)
          node.position = vector(x, 0.34, z)
          node.eulerAngles = vector(0, 0, Math.PI / 2)
          vehicle.addChildNode(node)
        }
    }
    scene.rootNode.addChildNode(vehicle)
    const floor = SCNFloor.floor()
    floor.reflectivity = 0.14
    floor.reflectionFalloffEnd = 1.8
    floor.reflectionResolutionScaleFactor = 0.5
    floor.firstMaterial = material('#0B1016', 0, 0.8)
    floor.firstMaterial.lightingModelName = SCNLightingModelLambert
    scene.rootNode.addChildNode(SCNNode.nodeWithGeometry(floor))
    const key = (this.keyLight = SCNLight.light())
    key.type = SCNLightTypeDirectional
    key.intensity = 850
    key.castsShadow = true
    key.shadowMode = SCNShadowMode.Deferred
    key.shadowSampleCount = 8
    key.shadowRadius = 7
    key.orthographicScale = 7
    key.shadowColor = new Color('#99000000').ios
    const lamp = SCNNode.node()
    lamp.light = key
    lamp.eulerAngles = vector(-1.1, -0.5, 0)
    scene.rootNode.addChildNode(lamp)
    const fill = SCNNode.node()
    fill.light = SCNLight.light()
    fill.light.type = SCNLightTypeOmni
    fill.light.intensity = 450
    fill.light.color = new Color('#C5DEFF').ios
    fill.position = vector(-4, 3, -3)
    scene.rootNode.addChildNode(fill)
    const camera = (this.camera = SCNNode.node())
    camera.camera = SCNCamera.camera()
    camera.camera.projectionDirection = SCNCameraProjectionDirection.Horizontal
    camera.camera.fieldOfView = 48
    camera.camera.zNear = 0.03
    camera.camera.zFar = 60
    camera.camera.wantsHDR = true
    camera.camera.wantsExposureAdaptation = false
    camera.camera.exposureOffset = 0
    camera.camera.bloomIntensity = 0.35
    camera.position = vector(4.2, 2.1, 4.6)
    camera.lookAt(vector(0, 0.35, 0))
    scene.rootNode.addChildNode(camera)
    view.pointOfView = camera
  }
  disposeNativeView() {
    const view = this.nativeViewProtected as SCNView
    view.playing = false
    view.pointOfView = null
    view.scene = null
    this.scene =
      this.camera =
      this.vehicle =
      this.paint =
      this.glass =
      this.signal =
      this.keyLight =
        undefined as never
    super.disposeNativeView()
  }
}
