# Web 生命周期与输入

**自 0.1.0-rc.7 起提供。** #314–#317 为实验性 `/web` runtime 添加子作用域、指针跟随、视口进入和 Vue 持续资源配置，复用现有值、弹簧、播放和调度器。[浮层、共享元素与交互示例](./web-interactions) 采用相同的资源所有权模型。

## 管理一次交互的资源 {#scopes}

```ts
const owner = runtime.scope()
const input = owner.motionValue(0)
const spring = owner.springValue(input)
owner.bind(card, { x: spring, rotate: owner.map(spring, [0, 100], [0, 8]) })
input.set(100)
owner.dispose()
```

工厂方法拥有其返回的资源。`add(handle)` 接管现有资源一次；`borrow(handle)` 将生命周期留给原所有者。向 `springValue`、`map` 或 `bind` 传入来源不会转移该来源的所有权。`map()` 拥有产生的数值/颜色映射，`subscribe()` 仅拥有订阅。同一 runtime 中，一个资源不能属于两个作用域。释放作用域只停止其 handles、bindings 和子作用域，保留借用的来源、runtime、独立 press 以及更新的通道所有者；不会调用 `runtime.release(target)`。

`scope(setup)` 和 `use(setup)` 在同步配置失败时回滚通过所提供作用域创建的资源。请提前等待应用数据。已完成动画会退出资源计数。`reset()` 清理后可复用；`dispose()` 永久且幂等。释放后注册会抛错；被 `add()` 拒绝的外部资源仍由调用方负责。即使某项清理抛错，也会尝试其余资源。

`suspend()` 暂停正在播放的 handles/followers，保留作用域创建的数值输入和映射，并暂停支持该操作的 controllers。应用预先暂停的 handle 不会被擅自恢复。直接绑定、press 等不可播放资源会被释放。需要在 `resume()` 后重新建立时，用 `use()` 注册工厂：

```ts
owner.use((active) => {
  active.bind(card, { x: spring })
  active.observeGeometry(card)
  active.press(card)
})
```

runtime 保留表面的静止状态，直到宿主释放表面。释放作用域不会删除应用内容或恢复其他所有者的 CSS。调度器保留原有的文档隐藏策略；不要在作用域暂停时手动重启其资源。

<Clip name="web-lifecycle-scopes-chromium" :width="900" caption="macOS arm64 上的 Chromium：真实控件改变两组弹簧目标，释放第一组后第二组继续运动，宿主 press 保持可用。原速录制。" />

## 跟随指针区域 {#pointer}

```ts
const follow = owner.pointerFollow(region, {
  range: { x: [-90, 90], y: [-45, 45] },
  spring: { stiffness: 150, damping: 18 },
})
owner.bind(icon, { x: follow.x, y: follow.y })
owner.press(icon)
owner.animate(icon, 'pulse')
```

使用与运动表面分开的稳定输入区域。默认坐标以中心为原点，范围为 `[-1, 1]`；`range` 映射并限制输出。`coordinates: 'pixels'` 返回相对于中心的视口 CSS 像素，并按指定 range 限制。支持 `axis`、`rest`、`spring: false` 和 `disabled`。静止值默认为零，必须位于限制范围内。`x`/`y` 为只读输出；用 `owner.map()` 映射旋转、缩放或颜色。

鼠标和悬停笔输入更新最新状态，不捕获指针，不阻止默认动作。触摸和接触状态的笔不会模拟 hover。离开/取消时回到静止值；失焦、文档隐藏、disabled/inert 表面和实时减少动态效果会立即归位。恢复运动后等待新的输入，不重放旧位置。controller 提供 `update({ disabled })`、`refresh()`、`suspend()`、`resume()` 和 `dispose()`。

几何信息缓存后由 resize、捕获阶段的 scroll、祖先 class/style、DOM 布局变化及字体加载失效。其他应用布局变化使用 `refresh()`。不会在每个指针事件读取布局。支持与轴对齐的平移和正缩放；旋转、倾斜、镜像和透视会被拒绝，并提示使用稳定 wrapper。持续动画的输入区域本身不能作为稳定坐标源。top layer 决定实际影响渲染的祖先边界。

<Clip name="web-lifecycle-pointer-chromium" :width="900" caption="macOS arm64 上的 Chromium：真实指针驱动弹簧跟随，独立 press/pulse、实时减少动态效果、新输入恢复和释放。不是实体设备延迟测量。" />

## 进入视口 {#viewport}

```ts
const entrance = owner.viewportEnter(cards, {
  root: scroller,
  threshold: 0.2,
  rootMargin: '0px',
  once: false,
  keyframes: { opacity: [0, 1], y: [24, 0] },
  transition: { duration: 400, stagger: 80 },
})
```

默认播放一次 `fadeInUp`。目标组固定且身份唯一；即使观察回调分批到达，stagger 仍采用原始组顺序。更换组时释放并重建 controller。`root`、`rootMargin`、`threshold`、`once` 和 `disabled` 配置观察。复用已有预设、关键帧、spring/tween 和 delay，不需要应用定时器。

配置前及 SSR 期间不会隐藏内容。不支持 IntersectionObserver 时保持可读。减少动态效果跳过装饰性进入，将仍由本次进入拥有的通道（包括透明度）置于终值，不覆盖应用更新后的可见性决定。播放中离开会取消待处理工作，仅结束仍拥有的通道，新所有者不受影响。进入动画自身 transform 越过阈值不视为新的滚动退出；真实 scroll/resize/layout 和 `refresh()` 会使该保护失效。

一次性观察完成后断开；重复模式在退出后重新准备。目标移除、释放、禁用、文档隐藏和暂停会使排队回调失效。重新启用观察当前几何。Jolt 不改变焦点、Tab 顺序、路由或应用可见性。并发 CSS 动画需要独立 wrapper 或明确的所有权。

<Clip name="web-lifecycle-viewport-chromium" :width="900" caption="macOS arm64 上的 Chromium：真实滚轮触发有序进入、再次进入、移除和减少动态效果。observer 不要求应用用 CSS 长期隐藏内容。" />

## Vue 持续资源配置 {#vue}

```ts
import { shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const target = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(target)
motion.use((scope, element) => {
  const pointer = scope.pointerFollow(element.parentElement!)
  scope.bind(element, { x: scope.map(pointer.x, [-1, 1], [-40, 40]) })
  scope.observeGeometry(element)
  scope.press(element)
})
```

在 setup 中调用 `useWebMotion`。`use()` 注册同步配置，挂载前不访问 DOM。回调可使用作用域所有工厂，包括值、绑定、几何/滚动、指针/视口及共享布局。每个已挂载 ref 配置一次，在 null、替换或停用时清理，KeepAlive 激活时为当前 ref 重建。回调内连续状态会重建；需跨缓存保留的应用状态应放在外部。返回的移除函数仅结束此配置。

视觉写入不经过 Vue 每帧渲染；只有需要响应式读数时才显式订阅。有限 enter/leave 保留原行为：leave 可在 ref 变 null 后保留表面，持续输入则立即分离。命令式 animate/set/press/layout 仍要求已挂载 ref。

借用宿主声明的表面时，使用 `useWebMotion(target, { runtime: hostRuntime })`。宿主提供兼容 runtime 和 ref，不通过 `$el` 搜索或另建上下文接管元素。adapter 仅释放自己的资源，保留借用 runtime 和宿主 press。借用模式下 `stop()` 仅影响自己的有限 handles，持续资源由 `use()` 清理。通过宿主配置 runtime。`WebAnimation.stop(properties, { layer })` 可取消 handle 仍拥有的选定通道。

导入和服务端 setup 不安排浏览器任务，也不创建进程全局应用状态。原生 `/vue` 契约保持不变。Mavis 单独适配其可移植表面。

<Clip name="web-lifecycle-vue-chromium" :width="900" caption="macOS arm64 上的 Chromium：Vue 控件改变弹簧目标、触发 pulse、停用/激活 KeepAlive、替换 ref 并卸载。持续写入不依赖 Vue 每帧渲染。" />

## 原生参考与验证 {#verification}

以下现有演示展示对应的原生弹簧、生命周期和进入行为，不运行浏览器指针或 IntersectionObserver API。

<Clip name="live-springs-ios" caption="现有英文 NativeScript 演示，iOS 模拟器：持久弹簧跟随目标变化。原生参考，不是 Web hover 或实体设备录制。" />
<Clip name="motion-controllers-ios" caption="现有英文演示，iOS 模拟器：状态、作用域及卸载/重挂载。原生生命周期参考，不是实体设备测量。" />
<Clip name="vue-lifecycle-reference-ios" caption="现有英文 NativeScript Vue 演示节选，iOS 模拟器：行进入和移除。仅省略启动画面，播放时间不变。原生参考，不是 Web 视口观察。" />

运行 `npm run web:lifecycle:test`、`npm run web:lifecycle:typecheck`、`npm run package:check`、`npm run docs:check-media` 和 `npm run docs:build`。[证据报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-lifecycle.md) 记录引擎版本及复现步骤。测试和视频不证明普遍合成器加速、移动 FPS 或输入到显示延迟。
