# 按压 {#press}

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

<Clip name="press" caption="Android 上的三种按压效果。" />

当手指按下时动画到给定值，并在手指抬起或通过滚动取消触摸后返回到视图所在的位置。 `isEnabled` 设置为 `false` 的视图​​不会做出反应。它返回一个消除效果的函数。
