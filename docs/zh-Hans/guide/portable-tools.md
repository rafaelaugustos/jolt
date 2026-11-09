# 可移植检查与传感器重播

可选 Web inspector/testing 入口的候选扩展：有界预期/观测曲线和标准传感器重播。原生对应能力已存在，新增 Web API 尚未包含在 RC.12.1。

```ts
import { createMotionInspector } from '@rafaelaugusto/jolt/web/inspector'
const inspector = createMotionInspector(document, runtime, {
  development: true,
  capacity: 128,
})
const unwatch = inspector.watch(card, 'card')
inspector.sample('card', 'x', 80, 'replace')
const svg = inspector.plot('card', 'x')
// Application teardown:
unwatch()
inspector.dispose()
```

采样由调用方显式触发：x/y 为 CSS transform 平移像素，透明度无单位。预期值及可选语义事件由应用提供；观测来自 computed style，不是 GPU 或物理传感器。断开的元素或不支持的投影 transform 产生 null 空缺。共享历史默认容量为 256，导出最多接受 4096 个按时间排序的样本。事件仅包括 start、replace、pause、play、stop、complete、seek。

使用不含个人数据的唯一 ID 观察已挂载节点。重复使用 ID 前先释放旧观察，新观察建立新历史。销毁 inspector 会清除其观测和自有 diagnostics，保留应用节点和动画。借用的 diagnostics 仍由调用方负责。不进行自动轮询、个人内容录制或性能承诺。

```ts
import { replaySensor } from '@rafaelaugusto/jolt/web/testing'
const source = runtime.sensor('gravity', { reducedMotion: 'continue' })
const unsubscribe = source.x.subscribe((value) => console.log(value))
const replay = replaySensor(
  source,
  [
    { time: 0, values: [0, -9.81, 0], orientation: 0 },
    { time: 100, values: [1, -9.76, 0], orientation: 0 },
  ],
  { manual: true },
)
replay.advanceTo(0)
replay.advanceTo(100)
await replay.finished
unsubscribe()
source.dispose()
```

样本明确属于合成输入：复制 2–10000 条记录，相对毫秒时间严格递增，范围为 0–60000。向量采用设备 xyz 和 m/s²、rad/s 或 µT；旋转采用归一化 quaternion xyzw。可选方向为 0/90/180/270 度。复用现有界面映射和 recenter 语义，不伪造中间硬件读数。

重播只断开自己的 sensor 与设备事件的连接。在无消费者、源暂停、后台/页面隐藏或减少动态效果时暂停。手动模式需要在时长范围内调用 advanceTo。handle 还提供 pause/play/stop/dispose 和 finished，完成为 true、取消为 false。无效输入保留原有重播；销毁 source 取消重播。结束或停止后按原权限和需求恢复正常采集。

snapshot().sampleSource 区分 replay、device-event 和 none，也标记保留的最后样本。重播不授予权限，合成输入的 available 始终为 false。API 存在、模拟器事件或重播不证明真实硬件数据，#385 仍未完成。测试应通过 scope 或显式清理管理订阅、派生值、bindings 和 source。

<Clip name="web-tools" caption="macOS Chromium：合成传感器样本驱动真实 DOM 元素，演示暂停/继续、显式 CSS 观测和替换标记。不代表物理传感器或 GPU 测量。" />

<Clip name="interaction-inspector-ios" caption="iOS 模拟器上的现有原生 inspector，真实操作播放控制和观测。原生与 Web 的观测来源仍不同。" />

<Clip name="composition-sensors-ios" caption="iOS 模拟器上的现有原生传感器 demo，仅提供生命周期和映射证据，不代表物理读数或新硬件基准。" />
