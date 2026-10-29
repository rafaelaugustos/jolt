# SceneKit 环境与着色器 {#scenekit-environment-and-shader-inputs}

`sceneKitEnvironmentIntensity(scene)` 动画环境照明。 `sceneKitUniform(target, name, options)` 对应用程序的 SceneKit 着色器修改器的声明标量或矢量输入进行动画处理。两者都是 `@rafaelaugusto/jolt/native` 的可选 iOS 适配器。

自 **0.1.0-beta.17** 起可用。安装匹配的 `@rafaelaugusto/jolt@0.1.0-rc.2` 和 `@rafaelaugusto/jolt-native@0.1.0-rc.2`，然后重建原生应用程序。单独更新 JavaScript 无法安装已编译的接收器。

原生助手基线是 iOS 13+ 和 NativeScript 8.9+；您选择的应用程序/运行时可能需要更新的版本。未提供 Android SceneKit 渲染。

<Clip name="scene-shaders-ios" caption="真实的 XCTest 在 iOS 模拟器上轻敲：环境照明、机舱混合和着色器矢量遵循一个源，具有暂停/恢复、搜索、图像替换和场景重建。 Playback timing is unchanged.这不是真机性能证据。" />

## 环境强度 {#environment-intensity}

```ts
import { sceneKitEnvironmentIntensity } from '@rafaelaugusto/jolt/native'

const environment = sceneKitEnvironmentIntensity(scene)
environment.animate(0.45, { duration: 1200 })
// Later, before destroying the scene:
environment.dispose()
```

目标是`SCNScene`。值是有限的、非负的照明乘数；负弹簧过冲被钳位为零。该适配器不会更改 `lightingEnvironment.contents`、`background`、灯光、曝光或色调映射。替换或删除环境图像会使强度所有权保持不变。在没有环境图像的情况下，更改乘数可能不会产生明显的效果。

Apple 将通用材料属性强度描述为 0-1。 SceneKit 接受高于 1 的环境乘数，并且原生探头通过图像亮度测量检查 0、0.45、1.6 和 4。这些不是校准的光单位，也不是任意 HDR 范围的保证。参见 [苹果的强度参考](https://developer.apple.com/documentation/scenekit/scnmaterialproperty/intensity)。

## 类型化着色器输入 {#typed-shader-inputs}

应用程序拥有着色器并在创建适配器之前初始化其值：

```ts
material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
  `#pragma arguments
float cabinView;
#pragma body
_output.color.rgb = mix(_output.color.rgb, float3(0.03, 0.04, 0.05), cabinView);`,
  SCNShaderModifierEntryPointFragment,
)
material.setValueForKey(0, 'cabinView') // Setup only

const cabin = sceneKitUniform(material, 'cabinView', {
  type: 'float',
  range: [0, 1],
  units: ['blend fraction'],
  motion: 'appearance',
})
cabin.animate(1, 'smooth')
```

支持的目标是 `SCNMaterial` 和 `SCNGeometry`，在 `#pragma arguments` 下使用文字 Metal 声明。

| 着色器类型 | Jolt 值        | 初始 SceneKit 值        |
| ---------- | -------------- | ----------------------- |
| `float`    | 号码           | NSNumber / 数字 KVC 值  |
| `float2`   | `[x, y]`       | NSValue 包含 CGPoint    |
| `float3`   | `[x, y, z]`    | NSValue 包含 SCNVector3 |
| `float4`   | `[x, y, z, w]` | NSValue 包含 SCNVector4 |

声明一个有限有序 `range`、每个组件一个 `units` 字符串和一个 `motion` 策略。该范围适用于每个组件；采样的弹簧过冲被限制在其边界处。向量被写成一个盒装的原生值。浮点读回具有平台的浮点精度。

向量是**不会自动选择颜色**。没有 sRGB 转换、预乘或隐式 alpha 含义。如果您的着色器需要线性 RGB 或 RGBA，请自行初始化并映射该空间中的这些组件。现有的材料颜色适配器具有不同的颜色契约。

名称必须是自定义标识符，没有 KVC 路径或 SceneKit 保留的 `u_`、`a_`、`v_` 和 `scn_` 前缀。安装程序检查文字声明、组件类型和初始化的原生值。不支持未声明的名称、数组、矩阵、采样器、结构、条件/宏定义模式和自定义 `SCNProgram` 缓冲区。这种有界声明检查不是 Metal 编译器：应用程序仍然负责有效的着色器代码并实际使用其输入。参见 [Apple 的着色器修改器合约](https://developer.apple.com/documentation/scenekit/scnshadable)。

## 单一来源，原生播放 {#one-source-native-playback}

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
import { sceneKitEnvironmentIntensity, sceneKitUniform } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const inside = motionValue(0)
const environment = sceneKitEnvironmentIntensity(scene)
const cabin = sceneKitUniform(material, 'cabinView', {
  type: 'float',
  range: [0, 1],
  units: ['blend fraction'],
  motion: 'appearance',
})
const clamp = (p: number) => Math.max(0, Math.min(1, p))
scope.use(() => environment.bind(inside, (p) => 1.6 - 1.15 * clamp(p)))
scope.use(() => cabin.bind(inside, clamp))
const run = scope.add(animate(inside, 1, { duration: 1800 }))
run.pause()
run.progress = 0.5
run.play()
// Teardown:
scope.dispose()
cabin.dispose()
environment.dispose()
```

这取代了在 JavaScript 中分配环境强度和着色器值的应用程序 `inside.subscribe(...)` 循环。被检查的汽车消费者使用标量 `cabinView` 修饰符；它的气流发射/透明度已经使用其他适配器。该示例有意将机舱不断地融合在一起。原车的阈值切换是一种不同的视觉选择：采样的映射可以跨阈值进行插值，因此它们不是精确的离散事件回调。

正常动画值、数值推导和`playbackProgress()`使用现有的外部属性播放桥。 JavaScript 在设置和播放边界采样映射；编译后的 Objective-C 播放器在主线程上执行帧写入。原生执行并不意味着渲染线程隔离或不受主线程争用的影响。

保留的 `springValue()` 和原生手势输出无法作为固定外部属性轨迹进行采样。绑定这些来源明确拒绝；没有隐藏的 JavaScript 订阅后备。实时本地源桥是一项单独的功能。

## 所有权、读取和生命周期 {#ownership-reads-and-lifecycle}

两种适配器均提供 `get`、`set`、`animate`、`bind`、`stop` 和 `dispose`。播放支持暂停/恢复/进度调整、时间刻度和作用域清理。读取使用当前模型值，因为这些目标没有公共表示 getter。原生写入禁用隐式 SceneKit 操作。在将所有权转让给 Jolt 之前，删除竞争的 SceneKit 动画。

所有权由原生目标和属性或 uniform 名称决定。不同 uniform 参数的动画独立运行；同一 uniform 的新包装器会中断原来的所有者。释放旧包装器不会取消替代它的新包装器。共享材质也意味着共享其 uniform 参数。

修改着色器源码或分配程序会使适配器失效并取消播放。初始化替代着色器后，请释放旧适配器并创建新适配器。源码字典比较无法检测重复分配相同源码，或源码未变时的编译器重建；应用需要这种生命周期边界时，应显式重建适配器。原生接收器对目标持弱引用，显式释放会清除所有权和资源。

环境强度属于非空间属性，在减少动态效果模式下仍保留播放时序。每个 uniform 参数需声明 `motion: 'appearance'`（保留时序）或 `'spatial'`（减少动态效果模式下立即到达目标）。Jolt 无法根据参数名推断任意着色器的视觉影响。应用进入后台时使用作用域挂起和恢复，并在销毁场景前释放资源。原生验证报告会区分模拟器的实际行为与真机性能结论。
