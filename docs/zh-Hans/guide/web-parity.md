# Web 重力、触觉、传感器、玻璃与图库

## RC.10 审计 {#rc10-audit}

已发布的 RC.10 包含 PR #358、#365、#372 和 #379。[完整导出矩阵](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/capability-matrix.json)和[契约审计](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-web-audit.md)区分 API 可用性与功能对等性。`npm run parity:check` 检查所有运行时导出和关键帧属性。路径运动、3D 旋转、阴影/深度、回放/检查器及真实移动浏览器硬件验证仍存在差距。下方桌面录制不能证明真实设备验收已完成。

**自 0.1.0-rc.10 起可用。** 本批次完成 [#236](https://github.com/rafaelaugustos/jolt/issues/236) 下的 [#373–#378](https://github.com/rafaelaugustos/jolt/issues/373)，并推进 [#117](https://github.com/rafaelaugustos/jolt/issues/117) 的 Web 部分。SSR 可安全导入 `/web`；请在客户端创建 runtime 和已挂载的目标。通过 scope 创建的资源随其暂停、恢复与销毁。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## 有限重力运动 {#gravity}

`animate()` 为 `x`、`y` 和数值 motion value 支持 `type: 'gravity'`。它复用原生有限弹道编译器：朝向终点的正加速度、`[0, 1)` 范围内的恢复系数、带符号的显式或继承速度、单个终点、延迟/重复和独立图层。暂停、恢复、跳转、停止、减少动态效果与事务验证遵循现有播放规则。暂停的动画传递零速度。这与多物体 `physicsWorld()` API 是独立功能。

```ts
const fall = scope.animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.6,
  },
)
fall.pause()
fall.progress = 0.3
fall.play()
const height = scope.motionValue(0)
scope.animate(height, 280, { type: 'gravity', velocity: -600 })
```

<Clip name="web-gravity-parity-chromium" :width="900" caption="macOS Chromium，英文界面：真实点击演示下落、暂停/恢复、抛掷和中断。原始速度。" />
<Clip name="gravity-ios" caption="iOS 模拟器，英文原生 demo：真实触摸演示下落、抛掷、中断和暂停/恢复。已复核的现有录像，原始速度；不是物理设备性能证据。" />

## 可选触觉反馈 {#haptics}

`haptic()` 返回 `backend: 'vibration' | 'none'` 和 `status: 'requested' | 'unavailable' | 'blocked' | 'disabled'`。`requested` 只表示浏览器接受请求，不证明硬件振动。[Vibration API](https://www.w3.org/TR/vibration/) 使用 10/20/30 毫秒的短时长提示，不等价于原生 light/medium/heavy 强度。要求文档可见且用户曾激活页面；减少动态效果会禁用请求。不会强制振动。Press 每次接受触摸或按键只触发一次，并遵循 disabled/loading。动画默认在到达时触发，也可使用不包含初始延迟、位于 `(0, 1]` 的递增 `times`。暂停重新调度，跳转消耗跳过的提示，中断取消提示，超过 100 毫秒的迟到提示会被丢弃。

```ts
const result = motion.haptic('light')
scope.press(button, { scale: 0.96 }, { haptic: 'light' })
scope.animate(
  card,
  { x: 240 },
  {
    duration: 800,
    haptic: { style: 'medium', times: [0.5, 1] },
  },
)
```

<Clip name="web-haptics-parity-chromium" :width="900" caption="macOS Chromium，英文界面：真实按钮/动画反馈请求与暂停/恢复。桌面录像不能证明振动或原生触觉强度。" />
<Clip name="haptics-android-device" caption="物理 ASUS_Z017DC，Android 8，英文界面：真实触摸请求原生反馈。闪光仅标记请求，视频无法传递触觉。已复核现有录像。" />

## 旋转与重力传感器 {#sensors}

`sensor('rotation')` 提供以**弧度**表示的相对 XYZ、归一化 Hamilton 四元数（`xyzw`）与 `recenter()`。`sensor('gravity')` 提供单位为 **m/s²** 的向下重力；屏幕朝上平放时 Z 为负。重力取线性加速度减去包含重力的加速度；任一读数缺失时，不以总加速度替代。默认采用屏幕界面坐标，`device` 保持设备轴。[Device Orientation and Motion API](https://www.w3.org/TR/orientation-event/) 要求安全上下文，并可能需要权限。必须从用户操作直接调用 `requestPermission()`；构造与恢复不会自动请求。存在 API 不证明存在硬件：有效样本到达后 `available` 才为 true；两秒没有可用数据会报告 `unavailable` / `no-data`。还包括 `permission-required`、`denied`、`idle`、`starting`、`active`、`paused` 和 `disposed`。时间戳是浏览器单调事件时间，不承诺硬件时间戳。`interval: 'auto' | 5–1000` 限制读数交付，不设置硬件采样率。绑定或订阅需求启动按事件/文档共享的采集；最后一个消费者离开、scope 暂停、后台、减少动态效果与销毁都会停止采集。重新启动保留相对旋转姿态。仅对有意的非装饰性输入使用 `reducedMotion: 'continue'`。

```ts
const rotation = scope.sensor('rotation')
const gravity = scope.sensor('gravity', { coordinates: 'interface' })
scope.bind(card, {
  rotate: scope.map(rotation.z, [-Math.PI, Math.PI], [-180, 180]),
  x: scope.map(gravity.x, [-10, 10], [-80, 80]),
})
enableButton.onclick = () => {
  void rotation.requestPermission()
  void gravity.requestPermission()
}
rotation.recenter()
console.log(gravity.snapshot())
```

<Clip name="web-sensors-parity-chromium" :width="900" caption="macOS Chromium，英文界面：真实启用、暂停/恢复与重新居中，诚实显示无数据状态。录像没有物理传感器样本或模拟运动。" />
<Clip name="device-sensors-physical-ios" caption="物理 iPhone 17 Pro，iOS 27.2，英文 Release demo：真实 Core Motion 旋转和重力驱动原生视图。已复核 USB 原速录像；不证明浏览器传感器或轴校准。" />

## 可控玻璃表面 {#glass}

`glass()` 提供 `set`、`animate`、`stop`、`suspend`、`resume`、`dispose` 和 `snapshot`。实际后端为 `css-backdrop-filter` 或 `solid`。缺少支持、减少透明度或强制颜色模式会使用实色回退；不承诺 UIKit Liquid Glass 折射或融合。滤镜作用于背景，子控件仍可交互。强度范围为 `[0, 1]`，半径为 `1–64` CSS 像素。销毁仅恢复仍由效果持有的样式，保留应用写入。不要让两个 blur/glass 实例拥有同一背景通道。

```ts
const surface = scope.glass(panel, {
  amount: 0.7,
  radius: 24,
  tint: 'rgba(30, 38, 58, 0.35)',
  fallbackColor: '#202638',
})
scope.add(surface.animate(1, { duration: 400 }))
console.log(surface.snapshot().backend)
```

<Clip name="web-glass-parity-chromium" :width="900" caption="macOS Chromium，英文界面：真实背景模糊、暂停强度与可交互子按钮。CSS 滤镜，不是原生 Liquid Glass。" />
<Clip name="glass-legacy-ios" caption="iOS 18.6 模拟器，英文界面：真实触摸控制原生圆角模糊表面与运动。已复核录像；无 Liquid Glass 融合或物理设备声明。" />

## 交互式路由返回 {#navigation}

`interactiveNavigation()` 复用手势引擎并使用独立平移图层。水平手势默认从边缘前 32 CSS 像素开始，垂直手势使用整个表面。释放位置和速度决定取消或退出。弹簧从当前姿态和速度继续，退出后 `commit` 调用应用路由一次。返回 `false`、拒绝或超时会回滚视图。`cancel()` 反转进行中的退出；`back()` 支持按钮和键盘。路由必须遵循取消信号，并在路由确认后完成 Promise。Jolt 无法撤销应用已更改的路由，不拦截浏览器历史、不实现操作系统预测返回，也不自动管理路由焦点。scope 销毁会移除自身图层与输入监听器。

```ts
const backGesture = scope.interactiveNavigation(page, {
  axis: 'x',
  edgeWidth: 32,
  canBegin: () => !editorIsBusy(),
  commit: ({ animated, signal }) => routerBack({ animated, signal }),
})
backButton.onclick = () => backGesture.back()
// backGesture.cancel()
```

<Clip name="web-navigation-parity-chromium" :width="900" caption="macOS Chromium，英文界面：真实边缘拖动取消短返回、完成长返回且只提交一次。应用路由，不宣称系统返回手势。" />
<Clip name="interactive-navigation-ios" caption="iOS 26.2 模拟器，英文界面：真实点击和边缘拖动取消/完成原生返回。已复核现有原速录像；不是物理设备。" />

## 图库与按键值返回缩略图 {#gallery}

`sharedNavigationEntry()` 协调一次进入和返回，沿用 shared-layout 快照限制。`returnFrom(intent)` 在路由变化前捕获保留的缩放/拖动姿态并传递垂直释放速度。返回被拒绝时调用 `intent.cancel()`，保持查看器可用。重复返回请求共用一次操作。`resolveListTarget()` 重新读取当前索引，请求应用虚拟列表实现项目，验证当前键值，并要求矩形在两个布局帧内稳定。不会保留旧单元格或索引。resolver 接收取消信号；默认超时 1500 毫秒，最多 5000 毫秒。项目删除、缺失或超时后，路由仍完成，但不执行共享飞行，并使用必须可聚焦的 `fallbackFocus`。当前缩略图优先聚焦其外层按钮/链接。路由由应用持有并必须遵循取消；取消视觉效果不能撤销已确认导航。项目实现与图片解码由应用回调负责。下方录像展示焦点缩放、按钮返回、取消/完成拖动、单元格复用和删除。这推进 #117，但不宣称其剩余原生无障碍和设备验收已完成。

```ts
import { resolveListTarget } from '@rafaelaugusto/jolt/web'
const entry = scope.sharedNavigationEntry(region, {
  tag: photoKey,
  source: () => thumbnailForKey(photoKey),
  detail: () => detailImage,
  back: ({ animated, signal }) => showCollection({ animated, signal }),
  returnTarget: {
    key: photoKey,
    resolve: (context) =>
      resolveListTarget(context, {
        container: list,
        indexOf: (key) => photos.findIndex((photo) => photo.id === key),
        scrollToIndex: (index, { signal }) => realizeRow(index, signal),
        viewForKey: thumbnailForKey,
        keyOf: (element) => element.dataset.key,
      }),
    fallbackFocus: () => collectionHeading,
  },
})
await entry.open(({ animated, signal }) => showPhoto({ animated, signal }))
scope.zoomable(detailImage, {
  viewport,
  onDismiss: (intent) => {
    void entry.returnFrom(intent)
  },
})
backButton.onclick = () => {
  void entry.back()
}
```

<Clip name="web-gallery-parity-chromium" :width="900" caption="macOS Chromium，英文界面：真实缩略图打开、焦点缩放、平移、取消/完成拖动、虚拟滚动与删除后的焦点回退。原始速度。" />
<Clip name="gallery-ios" caption="iOS 26.2 模拟器，英文界面：真实多点缩放、中断双击、取消拖动、重新排序后返回及删除回退。已复核现有原速录像。" />

## 验证与复现 {#validation}

运行 `npm run web:parity:typecheck`、`npm run web:parity:test`、`npm run build`、`npm run core:check`、`npm run package:check`、`python3 benchmarks/verify-sensor-math.py --web`、`npm run docs:check-media` 与 `npm run docs:build`。浏览器测试覆盖 Chromium、Firefox 和 WebKit。注入的权限/传感器/振动输入仅为测试 fixture，不是物理设备证据。通过 `node benchmarks/web-parity/record.mjs` 复现真实浏览器录像；原生捕获见 `CONTRIBUTING.md`。Mavis 采用工作保持独立。

[移动 Web 验证](mobile-web.md)
