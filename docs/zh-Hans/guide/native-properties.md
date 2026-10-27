# 原生属性 {#external-native-properties}

请参阅 [环境和着色器输入](./scene-shaders) 了解 beta.17 照明和带类型的 uniform适配器。

对地图坐标、SceneKit 相机、浅色或纯色材质进行动画处理，而无需编写 JavaScript 帧循环。可选的 `@rafaelaugusto/jolt/native` 条目提供属性注册表、编译的原生播放和参考适配器。导入主 JavaScript 条目不会初始化此注册表或加载地图 SDK。

<Clip name="native-map-ios" caption="MapKit 注释和相机在 iOS 模拟器上一起暂停和恢复。原生属性写道；实时播放。" />
<Clip name="native-map-android" caption="Android 模拟器上的 MapLibre 11.8.0 标记和相机。地图SDK是一个demo依赖；原生属性写入，实时播放。" />
<Clip name="native-camera-ios" caption="真实的 SceneKit 摄像机在 iOS 模拟器上改变位置和方向、暂停和继续。该适配器仅限 iOS。" />

请参阅 [SceneKit 灯及材料](./scene-lighting) 了解类型化强度、颜色、透明度、漫反射和发射适配器，包括原生演示和从 JS 帧循环的迁移。

## 可选安装 {#optional-installation}

注册表、地图和相机姿势适配器自 Jolt **0.1.0-beta.13** 起可用。 [SceneKit 灯及材料](./scene-lighting) 需要 **0.1.0-beta.14** 或更新版本。使用匹配的核心和可选的原生运行时版本。

安装 `@rafaelaugusto/jolt-native` 和 Jolt 并重建原生应用程序。 JavaScript 注册表位于 `/native` 条目中；编译的源代码和 MapKit/SceneKit 框架链接仅存在于这个可选插件中。仅包含主包的应用程序不包含这些帮助程序。在没有插件的情况下创建属性会报告显式错误。

```sh
npm install @rafaelaugusto/jolt @rafaelaugusto/jolt-native
```

MapLibre 仍然是一个单独的 Android 应用程序依赖项。该demo使用本地开发插件来pin SDK 11.8.0； `demo` 中的 `npm install` 安装两个本地插件。

## 使用适配器 {#using-an-adapter}

```ts
import { timeline } from '@rafaelaugusto/jolt'
import { mapKitCoordinate, mapKitCamera } from '@rafaelaugusto/jolt/native'

const marker = mapKitCoordinate(annotation) // MKAnnotation with a writable coordinate
const camera = mapKitCamera(mapView) // MKMapView
const scene = timeline([
  {
    at: 0,
    run: () =>
      marker.animate(
        { latitude: 37.78, longitude: -122.415 },
        { duration: 4000, ease: 'linear' },
      ),
  },
  {
    at: 0,
    run: () =>
      camera.animate(
        {
          latitude: 37.78,
          longitude: -122.415,
          altitude: 1300,
          pitch: 45,
          heading: 50,
        },
        { duration: 4000, ease: 'sineInOut' },
      ),
  },
])
scene.pause()
scene.play()
// Before destroying/replacing the native targets:
scene.stop()
marker.dispose()
camera.dispose()
```

每个属性有 `get()`、`set(value)`、`animate(to, transition)`、`bind(value, map)`、`stop()` 和 `dispose()`。 `animate()` 返回 `PlaybackAnimation`，包括暂停、播放、有限进度和完成。同一原生对象和注册属性的包装器共享中断所有权。停止或处置旧包装器不会停止新包装器的工作。处理包装器是最终的，并且必须在其 SDK 目标被销毁之前发生。

```ts
const release = marker.bind(progress, (p) => ({
  latitude: 37.772 + p * 0.008,
  longitude: -122.423 + p * 0.008,
}))
// progress can be a motion value or playbackProgress(animation).
// map runs while sampling a track, not on every native frame.
release()
```

映射必须是纯粹的：不要执行副作用或读取其中更改的应用程序状态。 Jolt 在设置和源更改时对它们进行采样，每秒使用多达 60 个样本（上限为 6000 个统一间隔，加上现有关键帧）。对源的更改会重建其原生绑定。手势事件和合成窗口重建保留了 [动画值执行限制](./motion-values)；这不会将任意 JavaScript 输入转换为原生源。

## 支持的目标和单位 {#supported-targets-and-units}

| 适配器               | 目标                          | 值                                                        | 平台    |
| -------------------- | ----------------------------- | --------------------------------------------------------- | ------- |
| `mapKitCoordinate`   | 可写 `MKAnnotation`           | `{ latitude, longitude }`，度                             | iOS     |
| `mapKitCamera`       | `MKMapView`                   | 坐标，`altitude` 以米为单位，`pitch`/`heading` 以度为单位 | iOS     |
| `mapLibreCoordinate` | MapLibre `Marker`             | `{ latitude, longitude }`，度                             | Android |
| `mapLibreCamera`     | MapLibre `MapLibreMap`        | 坐标，`zoom` 级别，`tilt`/`bearing`（以度为单位）         | Android |
| `sceneKitPose`       | `SCNNode`，包括一个摄像头节点 | `{ position: [x,y,z], orientation: [x,y,z,w] }`           | iOS     |

对于透视相机变焦，请使用 [`sceneKitFieldOfView(camera)`](./scene-camera)：1–179 度的 `SCNCamera` 角度，具有原生播放和动画值绑定。此适配器需要匹配核心/原生版本 **0.1.0-beta.15** 或更高版本以及原生重建。

五个[SceneKit外观适配器](./scene-lighting#properties-and-units)接受`SCNLight`或`SCNMaterial`：`sceneKitLightIntensity`、`sceneKitLightColor`、`sceneKitMaterialTransparency`、`sceneKitMaterialDiffuse`和`sceneKitMaterialEmission`。所有均为 iOS 专用。

核心包保留其NativeScript 8.9+最低；参考演示在 iOS 26 和 Android 16 上使用 NativeScript 9.1 进行检查。MapLibre 是可选的，必须单独添加到应用程序中；演示引脚 `org.maplibre.gl:android-sdk:11.8.0`。这并不是声称支持每个版本或地图插件。 SceneKit 没有 Android 适配器。编译后的 Android 渲染器集成可以实现相同的属性契约。

坐标使用线性纬度和最短经度插值，包括交叉±180°。这是局部路线近似值，而不是测地线或恒定地速。标题采用最短角度。 MapKit 高度和 MapLibre 缩放是不同的单位。 MapKit 俯仰为 0–80°，MapLibre 倾斜为 0–60°，缩放为 0–24； SDK可以进一步约束相机。 MapLibre 将纬度限制在其墨卡托投影限制内。复合坐标和相机状态写在一起。

场景姿势使用单位四元数最短路径插值和采样关键帧之间的原生归一化。位置使用场景单位。适配器在中断时读取 [呈现节点](https://developer.apple.com/documentation/scenekit/scnnode/presentation)，并在禁用隐式操作的情况下写入。从 Jolt 拥有的属性中删除竞争的 SceneKit 约束/操作。 MapKit 使用 [`setCamera(..., animated: false)`](<https://developer.apple.com/documentation/mapkit/mkmapview/setcamera(_:animated:)>)，MapLibre 使用即时相机更新，避免第二个 SDK 缓动曲线。将控制权交还给用户的地图手势或另一个渲染器控制器时停止该属性。

## 注册财产 {#registering-a-property}

```ts
const reveal = registerNativeProperty<number>({
  name: 'acme.chart/reveal',
  units: ['fraction'],
  platforms: ['ios', 'android'],
  encode: (n) => [n],
  decode: (components) => components[0],
  create: (chart) => createCompiledChartSink(chart),
})
const amount = reveal(nativeChart)
amount.animate(1, 'snappy')
```

`createCompiledChartSink` 由插件提供。在 Objective-C/Swift 中实现 `JoltPropertySink` 或在 Java/Kotlin 中实现 `org.rafaelaugusto.jolt.PropertySink`。其原生 `read()`/`write()` 使用与 `units` 匹配的有限数值向量；接收器拥有一个弱目标并报告它是否还活着。以原子方式实现复合写入。包含的标量工厂支持数字 Objective-C 键路径或 float/double JavaBean getter/setter。注册表拒绝重复名称、不支持的平台、无效向量和 JavaScript 生成的接收器实现。准备样品时执行自定义 `validate` 和 `interpolate` 函数。

提供的播放器在原生主/UI 线程上写入。需要不同队列的渲染器必须在其编译的接收器中安全地编组并定义呈现读取的同步方式；它不得每帧调度 JavaScript setter。此 API 不提供隐式 JavaScript 后备。 Native helper源码单独打包在`@rafaelaugusto/jolt-native`中；应用程序 SDK 依赖项仍然是可选的。

空间适配器声明`spatial: true`并在减少的运动下跳转到目的地。通用标量属性保留计时。不支持附加适配器层；在适当的时候绑定 [分层标量动画值](./motion-values#layers-on-a-value)。四元数姿势不获取标量加性语义。

## 验证和清理 {#validation-and-cleanup}

原生演示的 **运行原生检查** 通过补间、弹簧、暂停/查找/恢复、共享值绑定、图层、进度观察、时间线调度、中断和处置在两个平台上运行编译的 `reveal` 自定义视图装置。它检查原生玩家计数并验证原生绑定是否请求 JavaScript 观察帧。单元测试涵盖注册表验证、复合采样、角度和四元数行为。插件作者应该针对自己的接收器和 SDK 运行相同的场景，包括 SDK 销毁和应用程序后台/前台。

使用 `scope.add(property.animate(...))` 和 `scope.use(() => property.bind(...))` 作为所有权。将财产处置在目标的实际破坏边界处。 `subscribe()` 传递的场景回调仍然在 JavaScript 中执行。原生属性写入在 UI 线程上运行，因此主线程 JavaScript 可以延迟它们；参见 [Android性能](./android-performance)。原生播放并不能保证与繁忙的 UI 线程隔离。

编译后的示例位于 `demo/native-fixture` 中，其可重用套件位于 `benchmarks/playback-adapters.ts` 中。当 JavaScript 繁忙时，它还会检查作用域所有权、目标失效、慢动作和采样。

要从 `value.subscribe(n => nativeTarget.setValue(n))` 迁移，请注册已编译的接收器并使用 `property.bind(value, n => n)`。在与之前取消订阅相同的生命周期边界处保留并调用释放函数。

包装器保留目标身份直到 `dispose()`，这也释放其 JavaScript 引用。原生接收器使用弱引用。在销毁SDK对象之前进行Dispose；垃圾收集不能替代显式生命周期所有权。
