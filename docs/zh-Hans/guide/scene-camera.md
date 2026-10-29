# SceneKit 相机视野 {#scenekit-camera-field-of-view}

`sceneKitFieldOfView(camera)` 在其位置保持固定的同时对透视相机的视角进行动画处理。将其绑定到与绘画、照明或相机姿势相同的动画值，以协调场景而无需应用程序帧循环。该适配器是 **iOS-仅限**，通过可选的 `@rafaelaugusto/jolt-native` 插件实现。

<Clip name="scene-camera-ios" caption="iPhone 17模拟器，iOS 26：真实SceneKit播放和XCTest点击。当油漆和光线发生变化时，固定摄像机从 70° 变焦到 32°；暂停/恢复、反转、源替换、子视图搜索和场景娱乐。实时，在主线程上；模拟器镜头。" />

自 **0.1.0-beta.15** 起可用。安装匹配的核心/原生版本并重建原生应用程序：

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.2 @rafaelaugusto/jolt-native@0.1.0-rc.2
```

平台最低仍为NativeScript 8.9和iOS 13；原生验证使用 Core 9.1.3、运行时 9.1.0 和 iOS 26 模拟器。

## 相机角度（以度为单位） {#a-camera-angle-in-degrees}

```ts
import { sceneKitFieldOfView } from '@rafaelaugusto/jolt/native'

const fov = sceneKitFieldOfView(cameraNode.camera!) // SCNCamera, not SCNNode
const zoom = fov.animate(32, 'smooth')
zoom.pause()
zoom.progress = 0.5
zoom.play()

fov.get() // current native model angle in degrees
fov.set(70) // stops the current Jolt owner and applies immediately
// Before destroying the scene:
fov.dispose()
```

支持的范围是 **1–179 度（含）**。这是 Jolt 的保守视角范围，避免退化的近零/180° 投影。初始角度、明确的目的地和每个绑定样本都必须是有限的并且在范围内。在更换工作所有者之前，无效输入会失败。弹簧夹超出该范围；自定义映射本身必须产生有效的角度。在应用所选缓动之前，补间插值在度数上是线性的，而不是在放大倍率上是线性的。

目标的`projectionDirection`选择垂直或水平角度； Jolt 保留它。 SceneKit 从视口纵横比导出另一个轴。因此，调整视口大小会更改互补视角，而不是绑定值。以这种方式缩放会改变视角；使用 `sceneKitPose(cameraNode)` 移动相机是一个单独的操作。

仅支持 **自动透视投影**。正交相机使用`orthographicScale`，定制的`projectionTransform`拥有自己的投影。工厂拒绝这两种配置而不进行修改。如果在播放期间安装了其中任何一个，原生播放器将停止并保持应用程序拥有的配置不变。在配置/更换相机之前，释放任何源绑定并处理包装器。恢复支持的自动透视相机后重新创建绑定。

编译的接收器检查两个视口宽高比的公共投影结果。它既不会读取私有相机标志，也不会覆盖自定义矩阵来测试 FOV 是否有效。即使固定的自定义矩阵在数值上与一个标准视口的投影匹配，也会被拒绝。

## 共享动作和播放 {#shared-motion-and-playback}

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
import { sceneKitFieldOfView, sceneKitLightIntensity } from '@rafaelaugusto/jolt/native'

const progress = motionValue(0)
const scope = motionScope()
const fov = sceneKitFieldOfView(cameraNode.camera!)
const light = sceneKitLightIntensity(keyLight)

scope.use(() => fov.bind(progress, (p) => 70 - p * 38))
scope.use(() => light.bind(progress, (p) => 550 + p * 350))
scope.add(animate(progress, 1, { duration: 2000, ease: 'sineInOut' }))

scope.suspend() // holds the source and releases its bindings
scope.resume() // reattaches bindings and resumes previously running work

// Before destroying camera/light targets:
scope.dispose()
fov.dispose()
light.dispose()
```

数值派生值和 `playbackProgress(animation)` 使用相同的 `bind()` 合约。映射函数在准备/重建样本时运行，因此请保持它们的纯净。源命令和手势事件仍然进入JS；自主原生插值/写入请求无 JS 观察帧。 NativeScript JS 和这些 SceneKit 写入共享主线程，因此繁忙的 JS 可能会拖延相机更新。

使用 `timeline()` 协调单独的相机/灯光/材质播放手柄。支持联合暂停/恢复/停止；在支持的情况下寻找单个有限句柄。该演示故意保持相机位置固定，以便可见尺寸变化来自 FOV，并将绘画绑定到同一源，同时第二个时间轴参与者控制照明。

## 镜头所有权和中断 {#lens-ownership-and-interruption}

SceneKit 结合 `fieldOfView`、`focalLength` 和 `sensorHeight`：FOV 写入会重新计算焦距，并且更改任一镜头属性都可以重新计算 FOV。这些副作用是 SceneKit 相机模型的一部分，Apple 在 [fieldOfView](https://developer.apple.com/documentation/scenekit/scncamera/fieldofview) 和 [projectionDirection](https://developer.apple.com/documentation/scenekit/scncamera/projectiondirection) 中记录了这些副作用。

在应用更改焦距、传感器高度、投影方向或投影模式之前停止/释放 FOV 动画或绑定。设置所需的相机配置，然后返回手动控制。这些耦合属性的独立应用程序动画与 Jolt 竞争；有效的外部镜头更改不会自动被视为新所有者，并且可以被下一个 FOV 样本覆盖。 Jolt 不会改变近/远平面、焦距、景深或相机姿势。

独立的 `SCNCamera` 没有公共演示 getter。 `get()` 和中断读取 **当前模型角度**，这是 Jolt 拥有的播放期间最新的即时 Jolt 写入，并且可能会延迟一帧的渲染呈现。写入使用禁用隐式操作的 SceneKit 事务，包括在外部动画事务内。 Jolt 不会恢复应用程序拥有的 SceneKit 动画的显示中间 FOV：删除竞争动画并首先建立切换值。

同一相机FOV的包装器共享所有权，包括当多个节点引用该相机时。处理旧包装并不会阻止新所有者的动画。姿势、光线和材质适配器保持其独立的属性。原生接收器目标较弱； JS 包装器保留相机标识直到 `dispose()`，因此在场景销毁之前显式释放它们。

## 生命周期和减少运动 {#lifecycle-and-reduced-motion}

FOV 为 **空间运动**。在减少运动的情况下，新的直接动画会立即稳定下来，并且在准备新的活动轨道时绑定会使用源轨道的目标。更改首选项不会追溯重建每个提交的原生动画。要立即做出反应，请停止并应用预期角度，或在更新首选项后启动替换源命令。暂停源会保留其当前值。照明和颜色适配器保留其非空间策略。

准备好后，曲目遵循 Jolt 的 `timeScale`。原始属性适配器不安装自动后台策略：它们的挂钟可以在显示链接传送暂停时提前。对于举行的场景，暂停 `Application.suspendEvent` 上的范围并有意恢复。手动暂停的手柄保持暂停状态。将属性包装保持在必须在暂停后仍有效的范围之外；使用句柄和绑定工厂的范围，如上所述。

用原生绑定替换应用程序的每帧订阅：

```ts
// Remove the old subscription that assigned camera.fieldOfView on each callback.
const fov = sceneKitFieldOfView(camera)
const release = fov.bind(progress, (p) => 70 - p * 38)
// At teardown:
release()
fov.dispose()
```

[原生验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-camera.md) 涵盖投影几何、视口变化、镜头耦合、中断、不支持的投影、范围和主线程争用。正交比例动画、任意镜头控制和 Android 3D 渲染器集成是单独的工作。
