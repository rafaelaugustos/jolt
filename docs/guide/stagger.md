# Several views

Pass an array to animate them together, and `stagger` to start them one after another:

<Clip name="stagger" caption="Rows entering with a 50 ms stagger." />

```ts
animate(rows, 'fadeInUp', { stagger: 40 })
animate(tiles, 'popIn', { stagger: { each: 30, from: 'center' } })
```

`each` is the gap between two views, in milliseconds. `from` is `'first'` (the default), `'last'`, `'center'` or an index.

The animation you get back resolves once every view has finished, and `stop()` stops them all.
