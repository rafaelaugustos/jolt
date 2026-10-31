# Vue {#vue}

```ts
import Jolt from '@rafaelaugusto/jolt/vue'

createApp(App).use(Jolt).start()
```

<Clip name="vue" caption="JoltTransition 删除并恢复一行，v-animate 更改其入口。" />

核心采用一个视图或一个包含视图的元素，因此 `animate(card.value, 'popIn')` 已经可以从模板引用开始工作，无论它位于元素上还是（自 **0.1.0-rc.3** 起）根为视图的组件上。 `@rafaelaugusto/jolt/vue` 添加了模板端：`v-animate`、`v-press`、`v-gradient` 和用于来来去去的视图的 `<JoltTransition>` 组件。它需要 NativeScript-Vue 3 并且仅由导入它的应用程序加载。

## 范围内的组件运动 {#scoped-component-motion}

在设置中使用 [`useMotionScope()`](./motion-controllers#vue-lifecycle) 拥有动画和订阅，直到卸载为止，并通过 KeepAlive 暂停/恢复。

## 减少运动 {#reduced-motion}

`useReducedMotion()` 返回 [简化运动偏好](./configure#reading-the-preference) 后面的只读引用，直到组件卸载：

```vue
<script setup lang="ts">
import { useReducedMotion } from '@rafaelaugusto/jolt/vue'

const reduced = useReducedMotion()
</script>

<template>
  <Image v-if="reduced" src="~/assets/still.png" />
  <Splash v-else />
</template>
```

## 键盘 {#keyboard}

`useKeyboard()` 返回 [键盘状态](./keyboard#keyboard-state) 的只读引用，并保持最新状态，直到组件卸载：

```vue
<script setup lang="ts">
import { useKeyboard } from '@rafaelaugusto/jolt/vue'

const keyboard = useKeyboard()
</script>

<template>
  <ScrollView>
    <StackLayout :paddingBottom="keyboard.height">...</StackLayout>
  </ScrollView>
</template>
```

## 动画值 {#motion-values}

`useMotionValue()` 创建一个在组件卸载时停止的 [动画值](./motion-values)，`useScrollValue()` 通过 `ref` 跟随 ScrollView，`useBinding()` 返回将值绑定到元素的模板引用：

```vue
<script setup lang="ts">
const progress = useMotionValue(0)
const sheet = useBinding({ y: progress.to([0, 1], [200, 0]) })
</script>

<template>
  <GridLayout :ref="sheet" />
</template>
```

## 注册中 {#registering}

`app.use(Jolt)` 为每个模板注册三个指令和组件。组件还可以只导入它所使用的内容。在 `<script setup>` 中，以这些名称导入 `vAnimate`、`vPress` 和 `vGradient` 将使 `v-animate`、`v-press` 和 `v-gradient` 在该模板中可用：

```vue
<script setup lang="ts">
import { JoltTransition, vAnimate, vGradient, vPress } from '@rafaelaugusto/jolt/vue'
</script>
```

## v-动画 {#v-animate}

```vue
<Label v-animate="'fadeInUp'" />
<Label v-animate="{ opacity: [0, 1], y: [24, 0] }" />
<Label v-animate="['popIn', { delay: 200 }]" />
<Label v-animate="[entrance, 'bouncy']" />
```

该值是 [`animate()`](./animating) 所采用的值：预设名称或关键帧，单独或与过渡或弹簧名称配对。动画在元素安装时播放。安装发生在视图出现在屏幕上之前，因此视图会立即获取其第一个关键帧并在加载后播放；没有任何闪烁。

当值发生变化时，元素会再次产生动画，像任何 [中断](./interrupting) 一样在屏幕上拾取值和速度。值是按内容进行比较的，因此模板中写入的对象不会在每次渲染时重新启动动画。卸载会停止动画。

## v-按 {#v-press}

```vue
<GridLayout v-press />
<GridLayout v-press="{ scale: 0.95, opacity: 0.8 }" />
<GridLayout v-press="[{ scale: 0.9, rotate: -4 }, 'bouncy']" />
```

与 [`press()`](./press) 相同：当手指放在视图上时，视图将动画显示为按下的值，一旦抬起或滚动接管，视图就会动画返回。如果没有值，它会缩放至 0.96。改变的值取代了效果；卸载会将其删除。

## v 梯度 {#v-gradient}

```vue
<GridLayout
  v-gradient="{ type: 'radial', colors: ['#A78BFA', '#0F172A'], radius: 0.8 }"
/>
<GridLayout
  v-gradient="[{ type: 'linear', colors: mood.colors, angle: mood.angle }, 'smooth']"
/>
```

与 [`gradient()`](./gradients#scopes-and-vue) 相同：元素子元素后面的原生渐变，在安装时绘制，当它们更改时动画为新值并在卸载时删除。

## 摇动过渡 {#jolttransition}

```vue
<JoltTransition enter="popIn" leave="fadeOut">
  <Label v-if="saved" text="Saved" />
</JoltTransition>

<JoltTransition :enter="['fadeInUp', { delay: 100 }]" leave="fadeOutDown" mode="out-in">
  <component :is="screen" />
</JoltTransition>
```

`JoltTransition` 包装了 Vue 的 `BaseTransition`，因此它遵循 `<Transition>` 的规则：一个子级，与 `v-if` 或 `v-show` 切换，或者通过更改的 `key` 或组件进行替换。 `enter` 在子项插入时播放，而 `leave` 在子项移除之前播放。 Vue 保留该元素直到离开动画稳定下来，这使得退出动画成为可能：如果没有该组件，`v-if` 会在任何内容可以播放之前删除视图。

| 道具     | 含义                                         |
| -------- | -------------------------------------------- |
| `enter`  | 预设、关键帧或带有过渡的一对。省略立即插入。 |
| `leave`  | 相同的形状。省略立即删除。                   |
| `appear` | 在第一次渲染时也播放 `enter`。               |
| `mode`   | `out-in` 在插入前等待离开，`in-out` 则相反。 |

引擎发生中断。在休假仍在运行时显示子级会取消休假，并且从视图所在的位置开始输入。取消的输入仍会释放 Vue，因此没有任何内容会卡在半可见状态。离开页面会取消该页面上正在运行的任何内容。

## 页面转换 {#page-transitions}

页面之间的路由是一项不同的工作：框架拥有该导航。为此，[vue-router-ns](https://github.com/rafaelaugustos/vue-router-ns) 与 Jolt 配对，`JoltTransition` 覆盖页面内的视图。
