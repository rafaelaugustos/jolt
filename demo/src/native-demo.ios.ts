import { View } from '@nativescript/core'

export class NativeMapDemo extends View {
  map!: MKMapView
  marker!: MKPointAnnotation
  createNativeView() {
    return MKMapView.new()
  }
  initNativeView() {
    super.initNativeView()
    this.map = this.nativeViewProtected
    this.map.scrollEnabled = false
    this.map.zoomEnabled = false
    this.map.rotateEnabled = false
    this.map.setRegionAnimated(
      new MKCoordinateRegion({
        center: new CLLocationCoordinate2D({ latitude: 37.776, longitude: -122.419 }),
        span: new MKCoordinateSpan({ latitudeDelta: 0.014, longitudeDelta: 0.014 }),
      }),
      false,
    )
    this.marker = MKPointAnnotation.new()
    this.marker.coordinate = new CLLocationCoordinate2D({
      latitude: 37.772,
      longitude: -122.423,
    })
    this.marker.title = 'Jolt car'
    this.map.addAnnotation(this.marker)
  }
  whenReady(callback: () => void) {
    callback()
  }
}
export class NativeSceneDemo extends View {
  camera!: SCNNode
  createNativeView() {
    return SCNView.alloc().initWithFrameOptions(CGRectZero, null)
  }
  initNativeView() {
    super.initNativeView()
    const view = this.nativeViewProtected as SCNView
    const scene = SCNScene.scene()
    view.scene = scene
    view.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.05, 0.08, 0.14, 1)
    view.autoenablesDefaultLighting = true
    view.antialiasingMode = SCNAntialiasingMode.Multisampling4X
    const material = (r: number, g: number, b: number) => {
      const m = SCNMaterial.material()
      m.diffuse.contents = UIColor.colorWithRedGreenBlueAlpha(r, g, b, 1)
      return m
    }
    const block = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: SCNMaterial,
    ) => {
      const box = SCNBox.boxWithWidthHeightLengthChamferRadius(w, h, d, 0.08)
      box.firstMaterial = color
      const node = SCNNode.nodeWithGeometry(box)
      node.position = new SCNVector3({ x, y, z })
      scene.rootNode.addChildNode(node)
      return node
    }
    block(0, -0.15, 0, 10, 0.2, 10, material(0.13, 0.2, 0.28))
    block(0, 0.5, 0, 1.8, 0.5, 3, material(0.2, 0.8, 0.65))
    block(0, 0.95, -0.15, 1.5, 0.5, 1.5, material(0.05, 0.15, 0.2))
    for (const x of [-1, 1])
      for (const z of [-0.9, 0.9])
        block(x, 0.3, z, 0.3, 0.5, 0.7, material(0.03, 0.04, 0.05))
    for (const x of [-3, 3])
      for (const z of [-3, 3]) block(x, 0.7, z, 0.5, 1.4, 0.5, material(0.5, 0.4, 0.95))
    this.camera = SCNNode.node()
    this.camera.camera = SCNCamera.camera()
    this.camera.camera.fieldOfView = 45
    this.camera.position = new SCNVector3({ x: 0, y: 3, z: 9 })
    this.camera.orientation = new SCNVector4({
      x: -Math.sin(0.15),
      y: 0,
      z: 0,
      w: Math.cos(0.15),
    })
    scene.rootNode.addChildNode(this.camera)
    view.pointOfView = this.camera
  }
}
