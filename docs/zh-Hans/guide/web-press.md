# Web 按压反馈

`motion.press()` 为声明的 HTML 表面添加有限时长的指针和键盘反馈。它使用 [Web 运行时](./web-runtime)，无需 Vue、React 或永久逐帧循环。该实验性 API 已包含在 **0.1.0-rc.5** 中；参见[安装](./install#experimental-web-candidate)。Mavis 集成仍单独推进。

<Clip name="web-press-chromium" :width="720" caption="macOS arm64 上的 Chromium 156，原速真实浏览器录制，使用实际指针按住和键盘输入：应用缩放 1.1、按压系数 0.96、按住时目标改为 1.2、松开、Space/Enter、区域外松开、销毁反馈及 loading 取消。这不是实体设备性能测量。" />

## 命令式用法 {#imperative-usage}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document) // 挂载之后
motion.set(button, { scale: 1.1 })
const feedback = motion.press(button) // scale: 0.96，snappy 弹簧

// 指针或 Space/Enter 按住期间，应用仍可改变缩放。
motion.animate(button, { scale: 1.2 }, 'snappy')
feedback.update({ loading: true }) // 取消反馈；不会禁用 HTML 激活行为
feedback.update({ loading: false }) // 允许下一次按压

// 组件卸载或替换声明的表面时：
feedback.dispose() // 立即只移除自己的贡献和输入监听器
motion.release(button) // 表面生命周期结束时，释放整个表面
motion.dispose() // 不再需要时销毁上下文
```

可选值使用运行时的数值通道：`motion.press(button, { scale: 0.96, opacity: 0.8 }, { transition: 'snappy', disabled: false, loading: false })`。缩放和透明度相乘，位移和旋转相加。反馈返回自身的中性贡献，不会恢复应用之前的旧值。

| 状态               | 视觉缩放 |
| ------------------ | -------- |
| 应用为 1.1         | 1.1      |
| 以 0.96 系数按住   | 1.056    |
| 按住时应用改为 1.2 | 1.152    |
| 松开或销毁反馈     | 1.2      |

每个表面支持一个绑定。私有命名空间 `jolt:press:` 为按压反馈保留。`pressed` 表示输入状态，`animation` 暴露最近的有限动画句柄。中断将 `finished` 解析为 `false`，完成则为 `true`，均只发生一次。新运动继承当前的位置和速度，旧句柄不能重新夺取控制权。实时减少动态效果设置遵循运行时策略。

## 输入与生命周期 {#input-and-lifecycle}

主指针适用于可变换的 HTML 盒子。原生 `<button>` 还支持 Space/Enter 反馈。Jolt 不合成点击、不改变焦点、不调用 `preventDefault()`、不设置 `touch-action`，也不请求指针捕获。按钮激活、表单提交和键盘重复行为仍由浏览器处理。其他元素仅获得指针反馈；应用负责其键盘和无障碍语义。嵌套的交互控件会被忽略。

区域外松开、指针取消或丢失捕获、鼠标离开、祖先滚动、焦点或窗口失焦、页面隐藏都会取消反馈，浏览器仍可接管滚动。原生 `:disabled`（包括 fieldset）、`aria-disabled`、目标上的 `aria-busy`、祖先 `inert` 以及 `update({ disabled, loading })` 会阻止反馈并取消当前按压。这些状态只管理反馈：组件仍须实现激活、焦点和加载语义，通常使用原生 `disabled` 属性。

目标必须已挂载。移除的目标会自动释放，shadow root 内也一样；显式销毁是幂等的，可在移除后立即调用。替换表面需要创建新绑定。请遵循运行时的 [CSS 表面策略](./web-runtime#surface-policy-and-limits)：静态二维基础变换，不与其他 CSS 动画或过渡竞争，在控制期间不修改运动样式或类。可使用专门的内部表面分离组件样式与运动。

## 原生参考与验证 {#native-reference-and-verification}

原生按压行为没有改变。保留的英文录制展示已有的分层组合，并不展示 Web 代码或共享的 Mavis 页面。

<Clip name="motion-rfc-ios" caption="iOS 26.2 模拟器，已有英文 Layers 验证：真实按住和松开在独立运动层并存时保留非 1 基础缩放。原速原生参考，不是实体 iPhone 录制。" />
<Clip name="motion-rfc-android" caption="Android 16 / API 36 模拟器，已有英文 Layers 验证，通过 ADB 执行真实点击和按住。原速原生组合参考，不作实体设备性能承诺。" />

运行 `npm run web:press:typecheck` 和 `npm run web:press:test`。Chromium、Firefox、WebKit 覆盖输入、组合与清理；实际触摸滚动手势仅使用 Chromium CDP。参见[验证和录制报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-press.md)。
