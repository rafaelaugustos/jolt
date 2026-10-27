# 多个视图 {#several-views}

传递一个数组来将它们一起设置动画，并传递 `stagger` 来依次启动它们：

<Clip name="stagger" caption="行以 50 毫秒交错输入。" />

```ts
animate(rows, 'fadeInUp', { stagger: 40 })
animate(tiles, 'popIn', { stagger: { each: 30, from: 'center' } })
```

`each` 是两个视图之间的间隙，以毫秒为单位。 `from` 是 `'first'`（默认）、`'last'`、`'center'` 或索引。

每个视图完成后，您返回的动画就会解析，并且 `stop()` 会停止所有视图。
