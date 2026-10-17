# Vue

```ts
import Jolt from '@rafaelaugusto/jolt/vue'

createApp(App).use(Jolt).start()
```

<Clip name="vue" caption="JoltTransition removing and restoring a row, v-animate changing its entrance." />

The core takes a view or an element that holds one, so `animate(card.value, 'popIn')` already works from a template ref. `@rafaelaugusto/jolt/vue` adds the template side: `v-animate`, `v-press` and a `<JoltTransition>` component for views that come and go. It needs NativeScript-Vue 3 and is only loaded by apps that import it.

## Registering

`app.use(Jolt)` registers the two directives and the component for every template. A component can also import just what it uses. In `<script setup>`, importing `vAnimate` and `vPress` under those names makes `v-animate` and `v-press` available in that template:

```vue
<script setup lang="ts">
import { JoltTransition, vAnimate, vPress } from '@rafaelaugusto/jolt/vue'
</script>
```

## v-animate

```vue
<Label v-animate="'fadeInUp'" />
<Label v-animate="{ opacity: [0, 1], y: [24, 0] }" />
<Label v-animate="['popIn', { delay: 200 }]" />
<Label v-animate="[entrance, 'bouncy']" />
```

The value is what [`animate()`](./animating) takes: a preset name or keyframes, alone or paired with a transition or a spring name. The animation plays when the element mounts. Mounting happens before the view is on screen, so the view takes its first keyframe right away and plays once it loads; nothing flashes.

When the value changes, the element animates again, picking up the value and velocity on screen like any [interruption](./interrupting). Values are compared by content, so an object written in the template doesn't restart the animation on every render. Unmounting stops the animation.

## v-press

```vue
<GridLayout v-press />
<GridLayout v-press="{ scale: 0.95, opacity: 0.8 }" />
<GridLayout v-press="[{ scale: 0.9, rotate: -4 }, 'bouncy']" />
```

The same as [`press()`](./press): the view animates to the pressed values while a finger is on it, and back once it lifts or a scroll takes over. Without a value it scales to 0.96. A changed value replaces the effect; unmounting removes it.

## JoltTransition

```vue
<JoltTransition enter="popIn" leave="fadeOut">
  <Label v-if="saved" text="Saved" />
</JoltTransition>

<JoltTransition :enter="['fadeInUp', { delay: 100 }]" leave="fadeOutDown" mode="out-in">
  <component :is="screen" />
</JoltTransition>
```

`JoltTransition` wraps Vue's `BaseTransition`, so it follows the rules of `<Transition>`: one child, toggled with `v-if` or `v-show`, or replaced through a changing `key` or component. `enter` plays when the child is inserted and `leave` plays before it is removed. Vue keeps the element until the leave animation settles, which is what makes exit animations possible: without the component, `v-if` removes the view before anything can play.

| Prop     | Meaning                                                                   |
| -------- | ------------------------------------------------------------------------- |
| `enter`  | Preset, keyframes, or a pair with a transition. Omit to insert instantly. |
| `leave`  | The same shapes. Omit to remove instantly.                                |
| `appear` | Also play `enter` on the first render.                                    |
| `mode`   | `out-in` waits for the leave before inserting, `in-out` the reverse.      |

Interruptions follow the engine. Showing a child while its leave is still running cancels the leave, and the enter starts from where the view is. An enter that is cancelled still releases Vue, so nothing stays stuck half-visible. Leaving a page cancels whatever is running on it.

## Page transitions

Routing between pages is a different job: the frame owns that navigation. [vue-router-ns](https://github.com/rafaelaugustos/vue-router-ns) pairs with Jolt for that, and `JoltTransition` covers the views within a page.
