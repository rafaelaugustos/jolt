# Várias views

Passe um array para animá-las juntas, e `stagger` para começar uma depois da outra:

```ts
animate(rows, 'fadeInUp', { stagger: 40 })
animate(tiles, 'popIn', { stagger: { each: 30, from: 'center' } })
```

`each` é o intervalo entre duas views, em milissegundos. `from` é `'first'` (o padrão), `'last'`, `'center'` ou um índice.

A animação que você recebe de volta resolve quando todas as views terminaram, e `stop()` para todas.
