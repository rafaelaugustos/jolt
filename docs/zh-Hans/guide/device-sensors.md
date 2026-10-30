# 设备传感器 {#motion-from-your-phone}

`sensor()` 为 Jolt 现有的原生值图提供旋转和重力。一个源可以倾斜卡片、移动其突出显示并偏移背景，并使用原生弹簧平滑结果。导入可选的 `@rafaelaugusto/jolt/sensors` 入口点。自 **0.1.0-rc.1** 起可用；重建原生应用程序。

<Clip name="device-sensors-physical-ios" caption="实体 iPhone 17 Pro，iOS 27.2，Release 演示：Core Motion 的真实旋转和重力数据驱动卡片、反光和视差，并由原生弹簧平滑处理。英文界面，通过 USB 录屏，保持原速。此视频展示实时响应，不用于证明轴精度或性能。" />

<Clip name="device-sensors-physical-android" caption="实体 ASUS_Z017DC，Android 8 / API 26，英文诊断界面：真实传感器输入使原生卡片倾斜。保留原始时间，复用手动测试录像。该片段展示实时响应；姿态标签不代表已通过校准轴测试或性能测量。" />

<Clip name="device-sensors-ios" caption="iOS 26.2 模拟器：由显式模拟传感器输入驱动的真实原生视图，通过实际点击来暂停、恢复、居中和减少运动。原来的速度。模拟器没有运动硬件；这不是真机传感器或性能证据。" />
<Clip name="device-sensors-ios-pt" caption="iOS 模拟器，葡萄牙语：相同的原生输入预览和生命周期控件。屏幕识别模拟输入。" />
<Clip name="device-sensors-android" caption="Android 16模拟器：原生卡，光线和视差遵循明确的测试样本。实际的 ADB 点击锻炼暂停、恢复和减少运动。原速度；模拟硬件和测试样本无法确定真机性能。" />
<Clip name="device-sensors-android-pt" caption="Android 模拟器，葡萄牙语：具有明显标记的模拟输入和翻译控件的原生播放。" />

## 后台与页面重新进入 {#background-and-reentry}

生命周期审计在三个独立创建的 **Move the light** 页面中执行五次真实的主屏幕切换与应用恢复。它验证恢复瞬间传感器值、卡片和高光的原生姿态保持不变，随后更新继续进行，手动暂停状态得到保留，并且每次释放路由后传感器注册、数据源和原生数值节点均归零。

第一个周期使用平台采集：Android 模拟器进入后台时取消两个传感器注册，返回后恢复；iOS 模拟器则正确保持硬件不可用时的静态回退。后续周期使用屏幕明确标注的原生模拟输入预览。这验证了生命周期行为，不代表真实传感器精度、延迟或电池消耗。此次审计确认了现有实现，无需修改公开传感器 API。请参阅[记录、验证器及复现步骤](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#background-and-reentry-audit-2026-10-29)。

<Clip name="sensor-lifecycle-ios" caption="iOS 26.2 模拟器，英文演示：真实主屏幕切换与应用恢复、手动暂停以及三次页面进入；原生播放明确标注的模拟传感器输入，保持原始时间。模拟器不支持 Core Motion 采集；这是生命周期证据，不是真机性能证据。" />
<Clip name="sensor-lifecycle-android" caption="Android 16 / API 36 模拟器，英文演示：真实主屏幕切换、应用恢复与重复导航。第一个周期检查模拟器传感器订阅，卡片运动周期使用明确标注的模拟输入。保持原始时间，不作真机传感器精度或性能声明。" />

## 实体设备采样间隔 {#physical-sampling-intervals}

第二次实体 iPhone 审计检查十二个测量窗口：`auto`、16/33/100 ms、不同请求频率的源、移除单个绑定和最快消费者、重新绑定与资源释放。移除最快消费者后，共享采集从约 66 次/秒降至 10 次/秒；移除最后一个绑定后停止。所有测量窗口均无 JavaScript 回调。参见[实测频率和复现步骤](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#physical-sampling-intervals-2026-10-29)。这是单台设备上的短时正确性检查；原生提交次数不等于实际呈现帧率。

<Clip name="sensor-intervals-physical-ios" caption="实体 iPhone 17 Pro，iOS 27.2，Release 演示，英文诊断界面：十二个真实 Core Motion 采样窗口、共享采集、绑定移除及资源释放。USB 录屏保持原始时间，无模拟输入，也无需手动倾斜设备。计数器显示采样和原生提交次数，不表示实际呈现帧率。" />

## 连接源 {#connect-a-source}

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { sensor } from '@rafaelaugusto/jolt/sensors'

const scope = motionScope()
const rotation = sensor('rotation', { scope })
const gravity = sensor('gravity', { scope, interval: 'auto' })
const tilt = scope.add(springValue(rotation.y, { stiffness: 155, damping: 23 }))

// use() recreates bindings after suspension; add(cleanup) would remove them permanently.
scope.use(() => bind(card, { rotateY: tilt.to([-0.6, 0.6], [-20, 20]) }))
scope.use(() => bind(highlight, { x: tilt.to([-0.6, 0.6], [-90, 90]) }))
scope.use(() => bind(background, { x: gravity.x.to([-6, 6], [-35, 35]) }))

// Optional explicit actions:
rotation.recenter()
scope.suspend()
scope.resume()
// When the screen is permanently released:
scope.dispose()
```

源保持空闲状态，直到加载的视图绑定或显式 JS 订阅需要它们。需求通过原生弹簧链传播；暂停最后一个跟随者、卸载最后一个绑定视图或删除其绑定会停止硬件订阅。将源放在作用域中并在完成后将其丢弃。 `get()` 和 `snapshot()` 读取最后一个值而不开始采样。

## 值和坐标 {#values-and-coordinates}

| 来源                  | 值                 | 合同                                                                                                      |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `rotation`            | `x`, `y`, `z`      | 相对外在 XYZ 欧拉角，弧度；等价于内在的 ZYX。身份是第一个有效的阅读。将弧度映射到 Jolt 的旋转度数。       |
| `rotation.quaternion` | `x`, `y`, `z`, `w` | 归一化汉密尔顿四元数，样本之间具有符号连续性。相对于初始设备姿态，不是磁北。                              |
| `gravity`             | `x`, `y`, `z`      | 向下重力加速度，单位为 m/s²。平面、正面朝上的手机的 z 值约为 -9.80665。这既不是总加速度也不是线性加速度。 |

默认的 `coordinates: 'interface'` 使用 x 向右、y 向上和 z 超出可见屏幕。原生代码在屏幕旋转后重新映射轴。 `'device'` 保持设备的硬件轴，与接口方向无关；在 Android 上，这些遵循设备的自然方向，包括横向原生平板电脑。旋转基础随轴一起变换，因此更改界面方向不会将身份姿势转变为人为的 90° 旋转。

旋转使用任意非磁性参考：iOS 上的 Core Motion 的 `XArbitraryZVertical` 和 Android 上的 `TYPE_GAME_ROTATION_VECTOR`。偏航可以漂移。 `recenter()` 使下一个有效姿势成为身份。恢复锚定相对旋转以保持其先前的姿势；重力恢复实际测量。使用 `springValue()` 实现平滑的重力变化。欧拉角具有环绕和万向节锁定限制：对标量绑定使用适度的倾斜范围。全3D插值需要四元数感知插值；独立弹起四个四元数分量不是 slerp。

## 采样和所有权 {#sampling-and-ownership}

`interval` 接受 `'auto'`（显示器报告的间隔）或 5–1000 毫秒。该请求尊重硬件限制，并且不承诺确切的节奏。 iOS 共享一份 Core Motion 认购； Android 每种可用传感器类型共享一个原生侦听器。兼容的消费者使用最快的请求间隔，每个源将读数合并到自己的间隔和显示帧。多个绑定使用相同的保留值。

应用程序后台会原生以及通过 Jolt 的生命周期挂钩停止硬件收集。 `pause()` 保留该源的值并停止收集； `play()` 恢复并重试失败的订阅。 `dispose()` 是幂等的，断开绑定、删除原生值并释放订阅。另一个活动源可以使共享硬件保持运行。

减少运动默认为 `reducedMotion: 'pause'`：装饰传感器收集停止并且当前姿势保持静止。需要读取非装饰功能的应用程序可以显式选择 `'continue'`。 **移动灯光** 演示使用默认设置，并提供英语、葡萄牙语、西班牙语和简体中文的暂停、重定位和减少运动控件。

## 可用性和配置 {#availability-and-configuration}

在 iOS 上，将有意义的 `NSMotionUsageDescription` 添加到应用程序的 Info.plist 中。缺少描述会在启动 Core Motion 之前生成 `error: 'missing-motion-usage-description'`。在 Android 上，此实现将请求上限限制为 200 Hz，并且不需要高采样率许可。没有基于加速度计的后备伪装成重力或旋转传感器。

`available` 报告是否存在必要的硬件源。 `status` 区分 `idle`、`starting`、`active`、`paused`、`unavailable`、`error`、`replaying` 和 `disposed`。如果三秒（或三个请求的时间间隔）内没有有效测量到达，则 `snapshot().error` 报告访问/启动失败或 `no-data`。无效值和无序硬件时间戳将被忽略。缺少硬件会保留静态零/身份回退。该应用程序可以提供普通的静态布局，而无需依赖运动的动作。

`onStatus` 是可选的，并且仅在州边界运行。 `snapshot()` 返回最后的值、自启动以来单调毫秒的硬件时间戳、接收样本计数、提交帧计数、原生回调计数和累积提交处理毫秒数。它是显式诊断读取，而不是订阅或端到端性能测量。使用 `.subscribe()` 显式选择帧时钟上的 JS 观察；普通的`bind()`不需要每次读取JS调用。

## 可重复预览和剩余验证 {#reproducible-preview-and-remaining-validation}

演示的 **预览动作** 按钮使用 `@rafaelaugusto/jolt/testing` 中的 `replaySensor()`。规范四元数/重力样本的有限序列一次性交给原生代码；硬件集合分离以进行播放，并使用相同的数学、合并、值图和弹簧对其进行渲染。屏幕将输入标记为模拟。这是一个测试设施，而不是虚假的硬件可用性。

原生路径仍然需要平台的 UI 线程。该线程上的同步 JavaScript 任务可能会停止显示更新；避免每个样本的 JS 调用并不能使 UI 免受阻塞。

实体 iPhone 和 Android 审计覆盖真实旋转与重力、共享采集、请求的采样间隔、暂停与减少动态效果、后台恢复及资源释放。所有已测量的稳定窗口均无传感器 JavaScript 回调。Android 手动演示已确认可用；原生规范输入测试覆盖单位和界面坐标映射。参见[实体设备验收、记录和进程成本测量](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#physical-acceptance-2026-10-30)。受控原生服务故障可通过 `play()` 恢复；iPhone 注入的回调错误并非系统权限撤销测试。

这完成了 #114 的初始旋转/重力范围，未更改生产 API。包含重力的加速度计、线性加速度、陀螺仪及磁场源由 [#256](https://github.com/rafaelaugustos/jolt/issues/256) 跟踪。短时进程分析包含诊断开销，不能证明校准后的轴精度、实际呈现 FPS、输入到显示的延迟、电池消耗或持续负载能力。

平台合约：[Apple 设备动作](https://developer.apple.com/documentation/coremotion/getting-processed-device-motion-data)、[Android 运动传感器](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion) 和 [Android 传感器坐标和限制](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview)。
