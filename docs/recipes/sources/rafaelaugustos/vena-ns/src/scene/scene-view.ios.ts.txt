import { Application, File, knownFolders, View } from '@nativescript/core'
import { motionScope, motionValue, onReducedMotion, reducedMotion, type MotionScope, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { sceneKitUniform, type NativeProperty } from '@rafaelaugusto/jolt/native'
import { decodeCloud, type PointCloud } from './cloud-data'
import { observePointer } from './pointer.ios'
import { anatomyShader } from './shaders'
import { hitsHeart } from './heart-space'

interface Controls {
  formation: NativeProperty<number>
  focus: NativeProperty<number>
  touchPower: NativeProperty<number>
  touchPosition: NativeProperty<readonly [number, number, number]>
  orbit: NativeProperty<readonly [number, number]>
  ripple: NativeProperty<number>
  rippleOrigin: NativeProperty<readonly [number, number, number]>
  pulsePower: NativeProperty<number>
  heartTap: NativeProperty<number>
  rippleFromHeart: NativeProperty<number>
}

function source(values: number[], semantic: string, components: number) {
  const floats = new Float32Array(values)
  const data = NSData.dataWithBytesLength(floats.buffer, floats.byteLength)
  return SCNGeometrySource.geometrySourceWithDataSemanticVectorCountFloatComponentsComponentsPerVectorBytesPerComponentDataOffsetDataStride(
    data, semantic, values.length / components, true, components, 4, 0, components * 4,
  )
}

function pointNode(cloud: PointCloud, isHeart: boolean, glow = false) {
  const count = cloud.positions.length / 3
  const indices = Uint32Array.from({ length: count }, (_, index) => index)
  const element = SCNGeometryElement.geometryElementWithDataPrimitiveTypePrimitiveCountBytesPerIndex(
    NSData.dataWithBytesLength(indices.buffer, indices.byteLength), SCNGeometryPrimitiveType.Point, count, 4,
  )
  element.pointSize = glow ? 8 : isHeart ? 2 : 1.4
  element.minimumPointScreenSpaceRadius = glow ? 3 : isHeart ? .6 : .35
  element.maximumPointScreenSpaceRadius = glow ? 4 : isHeart ? 1 : .7
  const geometry = SCNGeometry.geometryWithSourcesElements([
    source(cloud.positions, SCNGeometrySourceSemanticVertex, 3),
    source(glow ? cloud.colors.map((v, i) => i % 4 === 3 ? v * .014 : v) : cloud.colors, SCNGeometrySourceSemanticColor, 4),
  ], [element])
  const material = SCNMaterial.material()
  material.lightingModelName = SCNLightingModelConstant
  material.diffuse.contents = UIColor.whiteColor
  material.doubleSided = true
  material.blendMode = SCNBlendMode.Add
  material.readsFromDepthBuffer = false
  material.writesToDepthBuffer = false
  material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(anatomyShader, SCNShaderModifierEntryPointGeometry)
  for (const [key, value] of Object.entries({ formation: 0, beat: 0, pulsePower: 0, isHeart: isHeart ? 1 : 0, focus: 1, touchPower: 0, ripple: 1, heartTap: 1, rippleFromHeart: 0 })) material.setValueForKey(value, key)
  material.setValueForKey(NSValue.valueWithSCNVector3({ x: 0, y: 0, z: 0 }), 'touchPosition')
  material.setValueForKey(NSValue.valueWithSCNVector3({ x: 0, y: 0, z: 0 }), 'rippleOrigin')
  material.setValueForKey(NSValue.valueWithCGPoint(CGPointMake(0, 0)), 'orbit')
  geometry.materials = NSArray.arrayWithObject(material)
  return { node: SCNNode.nodeWithGeometry(geometry), material }
}

/** SceneKit draws the cloud; Jolt writes the shader inputs on the native clock. */
export class HeartScene extends View {
  private materials: SCNMaterial[] = []
  private heartPoints: number[] = []
  private controls: Controls[] = []
  private properties: Array<{ dispose(): void }> = []
  private scope?: MotionScope
  private clock = motionValue(0)
  private heartbeat?: PlaybackAnimation
  private bpm = 72
  private running = true
  private revealed = 0
  private focused = true
  private backgrounded = false
  private removePointer?: () => void
  private interactionEnabled = false
  private pointerActive = false
  private settling?: ReturnType<typeof setTimeout>

  override createNativeView(): SCNView {
    const view = SCNView.alloc().initWithFrameOptions(CGRectZero, null)
    view.backgroundColor = UIColor.clearColor
    view.opaque = false
    view.antialiasingMode = SCNAntialiasingMode.Multisampling4X
    view.preferredFramesPerSecond = 60
    view.autoenablesDefaultLighting = false
    view.allowsCameraControl = false
    const scene = SCNScene.scene()
    const camera = SCNNode.node()
    camera.camera = SCNCamera.camera()
    camera.camera.usesOrthographicProjection = true
    camera.camera.orthographicScale = 1.62
    camera.position = { x: 0, y: .03, z: 7 }
    scene.rootNode.addChildNode(camera)
    const load = (name: string) => decodeCloud(interop.bufferFromData(File.fromPath(`${knownFolders.currentApp().path}/assets/anatomy/${name}.bin`).readSync() as NSData))
    const body = load('torso'), heart = load('heart')
    this.heartPoints = heart.positions
    for (const [cloud, red, glow] of [[body, false, false], [heart, true, true], [heart, true, false]] as const) {
      const built = pointNode(cloud, red, glow)
      scene.rootNode.addChildNode(built.node)
      this.materials.push(built.material)
    }
    view.scene = scene
    view.pointOfView = camera
    return view
  }

  override onLoaded() {
    super.onLoaded()
    this.accessibilityHidden = true
    const scope = this.scope = motionScope()
    this.removePointer = observePointer(this, (x, y, active) => this.pointerAt(x, y, active), (x, y) => this.tapAt(x, y))
    for (const material of this.materials) {
      const own = <T extends { dispose(): void }>(property: T): T => { this.properties.push(property); return property }
      const scalar = (name: string, range: readonly [number, number] = [0, 1]) => own(sceneKitUniform(material, name, { type: 'float', range, units: ['fraction'], motion: 'spatial' }))
      const beat = scalar('beat')
      scope.use(() => beat.bind(this.clock, value => value))
      this.controls.push({
        formation: scalar('formation'), focus: scalar('focus'), touchPower: scalar('touchPower'),
        touchPosition: own(sceneKitUniform(material, 'touchPosition', { type: 'float3', range: [-4, 4], units: ['x', 'y', 'z'], motion: 'spatial' })),
        orbit: own(sceneKitUniform(material, 'orbit', { type: 'float2', range: [-.65, .65], units: ['radians', 'radians'], motion: 'spatial' })),
        ripple: scalar('ripple'),
        rippleOrigin: own(sceneKitUniform(material, 'rippleOrigin', { type: 'float3', range: [-4, 4], units: ['x', 'y', 'z'], motion: 'spatial' })),
        pulsePower: own(sceneKitUniform(material, 'pulsePower', { type: 'float', range: [0, 1], units: ['fraction'], motion: 'appearance' })),
        heartTap: scalar('heartTap'), rippleFromHeart: scalar('rippleFromHeart'),
      })
    }
    this.controls.forEach(control => { control.formation.set(this.revealed); control.focus.set(this.focused ? 1 : 0) })
    scope.use(() => onReducedMotion(this.updatePlayback))
    Application.on(Application.suspendEvent, this.suspend)
    Application.on(Application.resumeEvent, this.resume)
    this.updatePlayback()
    this.notify({ eventName: 'sceneReady', object: this })
  }

  private suspend = () => { this.backgrounded = true; this.updatePlayback() }
  private resume = () => { this.backgrounded = false; this.updatePlayback() }
  private updateRendering = () => {
    const active = !this.backgrounded && !reducedMotion() && (this.running || this.pointerActive || this.settling !== undefined)
    const native = this.nativeViewProtected as SCNView | undefined
    if (native) { native.playing = active; native.rendersContinuously = active; native.setNeedsDisplay() }
  }
  private renderFor(duration: number) {
    clearTimeout(this.settling)
    this.settling = setTimeout(() => { this.settling = undefined; this.updateRendering() }, duration)
    this.updateRendering()
  }
  private updatePlayback = () => {
    this.heartbeat?.stop()
    this.heartbeat = undefined
    const active = this.running && !this.backgrounded && !reducedMotion()
    for (const control of this.controls) {
      if (active || this.backgrounded || reducedMotion()) control.pulsePower.set(active ? 1 : 0)
      else this.scope?.add(control.pulsePower.animate(0, { duration: 180, ease: 'easeOut' }))
    }
    if (!active && !this.backgrounded && !reducedMotion()) this.renderFor(250)
    this.updateRendering()
    if (active && this.scope) this.heartbeat = this.scope.animate(this.clock, [0, 1], { duration: 60000 / this.bpm, ease: 'linear', repeat: Infinity })
  }

  setTempo(bpm: number) { this.bpm = Math.max(40, Math.min(180, bpm)); this.updatePlayback() }
  setRunning(running: boolean) { this.running = running; this.updatePlayback() }
  setReveal(progress: number, duration = 0) {
    this.revealed = Math.max(0, Math.min(1, progress))
    this.renderFor(duration + 100)
    this.controls.forEach(control => {
      if (duration && this.scope) this.scope.add(control.formation.animate(this.revealed, { duration, ease: 'easeOut' }))
      else control.formation.set(this.revealed)
    })
  }
  setFocus(focused: boolean) {
    this.focused = focused
    this.renderFor(1200)
    this.controls.forEach(control => this.scope?.add(control.focus.animate(focused ? 1 : 0, { type: 'spring', duration: 950, bounce: .05 })))
  }
  setInteractionEnabled(enabled: boolean) { this.interactionEnabled = enabled; if (!enabled) this.pointerAt(0, 0, false) }
  private scenePoint(x: number, y: number): readonly [number, number, number] | undefined {
    const { width, height } = this.getActualSize()
    if (!width || !height) return
    return [(x - width / 2) * 3.24 / height, (.5 - y / height) * 3.24 + .03, .35]
  }
  tapAt(x: number, y: number) {
    if (!this.interactionEnabled || this.backgrounded || reducedMotion()) return
    const point = this.scenePoint(x, y)
    const pose = this.controls[0]
    if (!point || !this.scope || !pose) return
    const onHeart = hitsHeart(this.heartPoints, point, 7 * 3.24 / this.getActualSize().height, {
      beat: this.clock.get(), heartTap: pose.heartTap.get(), focus: pose.focus.get(), orbit: pose.orbit.get(),
    })
    this.renderFor(950)
    for (const control of this.controls) {
      control.rippleOrigin.set(point)
      control.rippleFromHeart.set(onHeart ? 1 : 0)
      control.ripple.set(0)
      this.scope.add(control.ripple.animate(1, { duration: 850, ease: 'linear' }))
      if (onHeart) {
        control.heartTap.set(0)
        this.scope.add(control.heartTap.animate(1, { duration: 680, ease: 'linear' }))
      }
    }
  }
  pointerAt(x: number, y: number, active: boolean) {
    active = active && this.interactionEnabled
    const changed = active !== this.pointerActive
    if (changed) {
      this.pointerActive = active
      this.notify({ eventName: 'pointerActive', object: this, active })
    }
    if (reducedMotion()) return
    this.renderFor(1300)
    const point = this.scenePoint(x, y)
    if (!point) return
    const size = this.getActualSize()
    for (const control of this.controls) {
      if (active) {
        this.scope?.add(control.touchPosition.animate(point, { type: 'spring', duration: 190, bounce: 0 }))
        this.scope?.add(control.orbit.animate([(x / size.width - .5) * .12, (y / size.height - .5) * .05], { type: 'spring', stiffness: 100, damping: 22 }))
      }
      if (changed) this.scope?.add(control.touchPower.animate(active ? 1 : 0, { type: 'spring', duration: active ? 220 : 850, bounce: active ? 0 : .06 }))
    }
    if (!active) this.resetPose()
  }
  resetPose() {
    this.controls.forEach(control => this.scope?.add(control.orbit.animate([0, 0], { type: 'spring', duration: 1100, bounce: .12 })))
  }
  override onUnloaded() {
    clearTimeout(this.settling); this.settling = undefined
    this.heartbeat?.stop(); this.heartbeat = undefined
    this.removePointer?.(); this.removePointer = undefined
    Application.off(Application.suspendEvent, this.suspend)
    Application.off(Application.resumeEvent, this.resume)
    this.scope?.dispose(); this.scope = undefined; this.controls = []
    this.properties.forEach(property => property.dispose()); this.properties = []
    const native = this.nativeViewProtected as SCNView | undefined
    if (native) { native.playing = false; native.rendersContinuously = false }
    super.onUnloaded()
  }
  override disposeNativeView() {
    const native = this.nativeViewProtected as SCNView | undefined
    if (native) native.scene = null
    this.materials = []
    this.heartPoints = []
    super.disposeNativeView()
  }
}
