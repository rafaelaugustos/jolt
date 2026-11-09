# Web 框架适配器

基于现有 Web runtime 的 React DOM、Angular、Svelte 和 Solid 候选 API，尚未包含在已发布的 RC.12.1 中。

绑定在客户端渲染后启动，服务端渲染不创建 runtime。等价声明不会重启动画；新目标从当前姿态替换运动。节点断开时保存最新声明，重新连接后应用；销毁时停止自身动画并移除反馈监听器。手动暂停状态在断开后保留。每个属性只应有一个所有者，按压反馈在独立层上组合。

默认绑定在挂载期间按 document 共享 runtime。显式传入的 runtime 属于借用资源，绑定不会配置、释放或销毁它；应用应在组件销毁后再销毁 runtime。React 接收 `{ runtime }`；Angular 使用 `[joltRuntime]` 或 `*joltIf` 的 `runtime:`；Svelte 使用 `createActions({ runtime })`；Solid 使用 `createDirectives({ runtime })`。

使用 Web keyframes 和 transition：平移为 CSS 像素、旋转为度、透明度和缩放无单位、时长为毫秒。减少动态效果遵循 runtime 策略，控件保留 DOM 键盘和焦点语义。浏览器执行和线程不同于 NativeScript。声明必须使用普通对象和数组；已挂载节点的无效替换不会破坏现有动画。React hook 的返回函数允许显式重播，其他适配器通过声明更新。

## React DOM

```tsx
import { useRef } from 'react'
import { useAnimate, usePress } from '@rafaelaugusto/jolt/web/react'
function Card({ x }: { x: number }) {
  const ref = useRef<HTMLButtonElement>(null)
  const replay = useAnimate(ref, [{ x }, { duration: 500 }])
  usePress(ref, { scale: 0.94 })
  return (
    <button ref={ref} onClick={() => replay('popIn')}>
      Jolt
    </button>
  )
}
```

<Clip name="web-react" caption="macOS 上的 Chromium：真实 DOM 动画和指针交互、替换、移除/重新挂载、减少动态效果。英文界面，不是设备性能基准。" />

<Clip name="framework-react-ios" caption="现有 NativeScript 对应实现：iOS 26.2 模拟器上的真实原生播放和 XCTest 触摸。这些原生适配器已发布，新入口面向 DOM 元素。" />

## Angular DOM

```ts
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
} from '@rafaelaugusto/jolt/web/angular'
// @Component({ imports: [JoltAnimateDirective, JoltPressDirective, JoltIfDirective], ... })
```

```html
<button [joltAnimate]="{ x: position() }" [joltPress]="{ scale: 0.94 }">Jolt</button>
<div *joltIf="visible(); enter: 'fadeIn'; leave: 'fadeOut'">Jolt</div>
```

Angular 在渲染后连接绑定。`joltIf` 保留恰好一个 HTML 根元素直到退出完成；重新进入会取消待执行的删除。多个同级根节点需要包装元素。自定义 preset 的中断需要显式 keyframes，内置名称可直接使用。服务端和 hydration 中的结构视图始终由 Angular 管理。

<Clip name="web-angular" caption="macOS 上的 Chromium：真实 DOM 动画和指针交互、替换、移除/重新挂载、减少动态效果。英文界面，不是设备性能基准。" />

<Clip name="framework-angular-ios" caption="现有 NativeScript 对应实现：iOS 26.2 模拟器上的真实原生播放和 XCTest 触摸。这些原生适配器已发布，新入口面向 DOM 元素。" />

## Svelte

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/web/svelte'
  let x = $state(0)
</script>
<button use:animate={{ x }} use:press={{ scale: 0.94 }} onclick={() => x = x ? 0 : 80}>Jolt</button>
```

<Clip name="web-svelte" caption="macOS 上的 Chromium：真实 DOM 动画和指针交互、替换、移除/重新挂载、减少动态效果。英文界面，不是设备性能基准。" />

<Clip name="framework-svelte-ios" caption="现有 NativeScript 对应实现：iOS 26.2 模拟器上的真实原生播放和 XCTest 触摸。这些原生适配器已发布，新入口面向 DOM 元素。" />

## Solid

```tsx
import { createSignal } from 'solid-js'
import {
  animate,
  press,
  type AnimateValue,
  type PressValue,
} from '@rafaelaugusto/jolt/web/solid'
declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      animate: AnimateValue
      press: PressValue
    }
  }
}
function Card() {
  const [x, setX] = createSignal(0)
  return (
    <button
      use:animate={{ x: x() }}
      use:press={{ scale: 0.94 }}
      onClick={() => setX(x() ? 0 : 80)}
    >
      Jolt
    </button>
  )
}
```

<Clip name="web-solid" caption="macOS 上的 Chromium：真实 DOM 动画和指针交互、替换、移除/重新挂载、减少动态效果。英文界面，不是设备性能基准。" />

<Clip name="framework-solid-ios" caption="现有 NativeScript 对应实现：iOS 26.2 模拟器上的真实原生播放和 XCTest 触摸。这些原生适配器已发布，新入口面向 DOM 元素。" />

已验证实际 tarball 消费应用：React 19.3.1 Strict Mode、Angular 22.2.4 部分编译库和真实 hydration、Svelte 5.57.3、Solid 1.9.18 客户端/服务端 JSX。TypeScript NodeNext/Bundler 及 Chromium/Firefox/WebKit 覆盖导入、hydration、更新、替换、无障碍和销毁。这不代表 Next、所有旧版框架或所有 Angular 渲染模式均已验证。
