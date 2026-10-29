# SceneKit 光照 {#scenekit-lights-and-materials}

通过现有的 [原生财产合同](./native-properties) 对光强度/颜色、材质透明度和固体漫反射/发射颜色进行动画处理。这些适配器是 **iOS-仅限**，需要可选的 `@rafaelaugusto/jolt-native` 插件以及原生重建。它们不添加 Android 3D 渲染器、纹理混合或着色器统一支持。

自 **0.1.0-beta.14** 起可用。安装匹配的核心和可选的原生运行时版本，然后重建 iOS 应用程序：

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.2 @rafaelaugusto/jolt-native@0.1.0-rc.2
```

<Clip name="scene-lighting-ios" caption="iPhone 17模拟器，iOS 26：真实的SceneKit渲染和XCTest点按。相机、油漆、玻璃和灯光共享原生绑定；标量电荷层在基极继续的同时添加脉冲。包括暂停/恢复、子播放搜索和场景处理/娱乐。主线程实时播放；没有真机声明。" />

## 属性和单位 {#properties-and-units}

```ts
import {
  sceneKitLightIntensity,
  sceneKitLightColor,
  sceneKitMaterialTransparency,
  sceneKitMaterialDiffuse,
  sceneKitMaterialEmission,
} from '@rafaelaugusto/jolt/native'

const brightness = sceneKitLightIntensity(light) // SCNLight
const tint = sceneKitLightColor(light)
const opacity = sceneKitMaterialTransparency(material) // SCNMaterial
const paint = sceneKitMaterialDiffuse(material)
const glow = sceneKitMaterialEmission(material)

brightness.animate(1800, { duration: 800, ease: 'sineInOut' })
paint.animate('#14b8a6', 'smooth')
opacity.set(0.6)
```

| 适配器                                   | 目标属性                        | 接受的值                                                     |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `sceneKitLightIntensity(light)`          | `SCNLight.intensity`            | 有限数 ≥ 0。基于物理的照明的流明；否则强度/1000 乘以光颜色。 |
| `sceneKitLightColor(light)`              | `SCNLight.color`                | NativeScript 颜色字符串或 `Color`。                          |
| `sceneKitMaterialTransparency(material)` | `SCNMaterial.transparency`      | 0-1 范围内的有限数； 1 是默认的不透明乘数。                  |
| `sceneKitMaterialDiffuse(material)`      | `SCNMaterial.diffuse.contents`  | 仅纯色：字符串或 `Color`。                                   |
| `sceneKitMaterialEmission(material)`     | `SCNMaterial.emission.contents` | 仅纯色：字符串或 `Color`。                                   |

原生目标必须分别为 `SCNLight` 或 `SCNMaterial`。现有颜色内容必须是可转换实体 `UIColor` 或 `CGColor`。灰度和 Display P3 颜色转换为 sRGB；动态 UIKit 颜色在读取时根据当前特征集合进行解析。图案、图像、纹理、文件路径/URL、图层、数字和 `nil` 在所有权更改之前被拒绝。适配器绝不会默默地用颜色替换纹理。如果应用程序稍后分配不支持的内容，原生播放将停止并保持这些内容不变；恢复纯色后需要新装订。

颜色 `get()` 返回 NativeScript `Color`，标准化为 8 位 sRGB/alpha。动画样本重复使用 Jolt 的 [预乘OKLab插值](./colors)，剪辑到 sRGB 色域。原生接收器接收标准化预乘 sRGB RGBA 向量（RGB in 0–alpha，alpha in 0–1）；它在采样向量之间进行插值，取消预乘并分配一个完整的 `UIColor`。这保留了透明端点，无需单独的每通道设置器回调。原生读取在公共颜色边界处舍入，因此中断精度是一个 8 位分量。不保留超出 sRGB 的 HDR/广色域输出。颜色和数字范围的弹簧过冲被限制；绑定映射本身必须返回有效值。

Alpha保留在颜色值中； SceneKit的材质和光照规则决定了它的视觉贡献。使用光强度作为亮度，使用材质透明度作为不透明度乘数。这些适配器不会更改 `transparent`、`transparencyMode`、`blendMode`、深度设置、金属度、粗糙度或着色器代码。颜色 alpha 为零并不能普遍替代配置透明几何体。

对于 `physicallyBased`、`lambert`、`phong` 或 `blinn`，漫反射外观取决于照明和其他材质属性；未照明场景中的黑色表面可能隐藏颜色变化。 `constant` 显示独立于直接照明的漫射颜色。发射增加了与照明无关的外观； **它不会照亮附近的物体**。 `shadowOnly` 和自定义着色器可以忽略正常的漫反射/发射贡献。使用实际的光进行照明，并根据需要单独配置光晕。这些是 SceneKit 渲染规则，在 Apple 的 [强度](https://developer.apple.com/documentation/scenekit/scnlight/intensity)、[发射](https://developer.apple.com/documentation/scenekit/scnmaterial/emission) 和 [透明度](https://developer.apple.com/documentation/scenekit/scnmaterial/transparency) 参考文献中进行了描述。

## 共享价值观和电荷层 {#shared-values-and-charge-layers}

```ts
import { Color, Application } from '@nativescript/core'
import { animate, motionValue, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const charge = motionValue(0)
const brightness = sceneKitLightIntensity(light)
const glow = sceneKitMaterialEmission(material)

scope.use(() => brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600))
scope.use(() =>
  glow.bind(
    charge,
    (n) => new Color(255, 0, Math.round(Math.min(1, Math.max(0, n)) * 255), 180),
  ),
)
scope.add(animate(charge, 0.6, { duration: 10000, ease: 'linear' }))
scope.animate(charge, [0, 0.5, 0], {
  duration: 1100,
  ease: 'sineInOut',
  repeat: Infinity,
  layer: 'charge',
})
```

脉冲是**标量动画值**上的一层；底座继续在下面。这不会添加任意颜色、材质或四元数姿势。使用 `stop(charge, { layer: 'charge' })` 仅去除脉冲。派生值或 `playbackProgress(animation)` 也可以提供给 `bind()`。该演示使用相同的相机姿势、光线和材质源，无需轮询或每帧使用 JS setter。

映射在 Jolt 准备样本或重建源轨道时执行，因此请保持它们的纯净。标量层组合可以在JS中重建采样窗口；手势/源事件也仍然是 JS 边界。原生写入通过主线程上现有的原生播放器在编译后的 Objective-C 中运行。该线程上繁忙的 JS 可能会延迟它们。 `subscribe(value => sceneKitSetter(value))` 回调仍然在 JS 中运行，并且不是原生绑定。

`animate()` 返回通用播放句柄：暂停/播放、有限进度查找、停止和完成。 `timeline()` 协调这些句柄以进行暂停/恢复/停止；在支持的情况下寻求单独的控制，因为时间线本身没有进度设置器。在替换当前所有者之前，会检查无效的目标、颜色、数值范围和映射样本。

## 中断、所有权和生命周期 {#interruption-ownership-and-lifecycle}

引用相同 `SCNMaterial` 或 `SCNLight` 的两个节点共享其状态。同一原生实例和属性的包装器共享中断所有权。不同的属性保持独立；处理旧包装器不能阻止新包装器的工作。如果实例必须独立制作动画，请复制应用程序中的材质/灯光。

`sceneKitPose` 在中断时读取表示节点。独立灯光和材质没有公共等效的呈现吸气剂，因此这些适配器读取其 **当前模型属性**。 Jolt 写入时禁用隐式 SceneKit 操作；在 Jolt 拥有的播放期间，该模型是最新编写的样本，并且重定向从那里开始，没有第二条缓动曲线。它可能会延迟渲染帧的屏幕呈现。 Jolt 无法恢复独立灯光/材质上应用程序拥有的动画的显示中间值。删除竞争的 SceneKit 动画/动作/约束，并在给予 Jolt 控制权之前提交所需的切换值。在归还财产之前停止/释放 Jolt。 SceneKit 所有权是排他性的，而不是与 SDK 动画的附加混合。

在运动范围内拥有自己的可玩手柄和绑定工厂。将属性包装器保留在您打算暂停的范围之外：`scope.add(property)` 采用一次性资源，因此暂停会永久处置它。在场景/目标破坏边界显式处置包装器：

```ts
const suspend = () => scope.suspend()
Application.on(Application.suspendEvent, suspend)
// On an intentional return to the scene:
scope.resume()

// Before removing/replacing the scene:
Application.off(Application.suspendEvent, suspend)
scope.dispose()
brightness.dispose()
glow.dispose()
```

暂停会暂停可玩的手柄、分离绑定并删除原生玩家。显式恢复重新启动绑定工厂并恢复之前运行的句柄；它不会重新启动手动暂停的句柄。该演示在后台暂停，需要显式恢复。原始适配器不安装自己的应用程序生命周期策略：如果没有作用域暂停/停止，它们的挂钟会在显示链接暂停时前进，并且返回可能会立即赶上或完成。不要依赖后台执行进行原生渲染。

照明/颜色/透明度适配器是非空间的，并且在减少运动的情况下保留其定时，包括脉冲定时。 `sceneKitPose` 是空间的，当在设置/源重建时启用减少运动时，会跳转到其目的地。为了避免装饰性闪烁，请在应用程序应用减少运动时抑制充电脉冲。策略更改不会追溯重建每个现有的独立动画。两种类型在创建曲目时都遵循 Jolt 的 `timeScale`。

可选运行时使用弱原生目标；包装器保留目标标识直到 `dispose()`。即使对于暂停的绑定，也应在销毁前进行处置，并且不要依赖 GC。编译后的写入和读取使用主线程；不要从另一个队列上的渲染器回调调用 JS API。最小值仍为 NativeScript 8.9 和 iOS 13；该实现已通过 NativeScript Core 9.1.3/runtime 9.1.0 和 iOS 26 进行了验证。使用包含这些适配器的兼容核心/原生包进行重建；较旧的 beta.13 插件二进制文件不包含它们。

## 迁移模型的帧循环 {#migrating-a-model-s-frame-loop}

替换轮询或每帧订阅：

```ts
// Before: app-owned JS write on every observed frame.
const unsubscribe = charge.subscribe((n) => {
  light.intensity = 400 + n * 1600
})

// After: sample the mapping at setup/source boundaries, write natively.
const brightness = sceneKitLightIntensity(light)
const release = brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600)
// At destruction: release(); brightness.dispose()
```

对于相机，请继续使用`sceneKitPose(cameraNode)`。安装绑定时删除旧的订阅/计时器。 [验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-appearance.md) 记录原生一致性、连续性、层组成、生命周期计数器、颜色容差和 busy-JS 限制。
