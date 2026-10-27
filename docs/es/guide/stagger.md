# Varias vistas {#several-views}

Pasa un array para animarlos juntos, y `stagger` para iniciarlos uno tras otro:

<Clip name="stagger" caption="Filas entrando con un escalonamiento de 50 ms." />

```ts
animate(rows, 'fadeInUp', { stagger: 40 })
animate(tiles, 'popIn', { stagger: { each: 30, from: 'center' } })
```

`each` es el espacio entre dos vistas, en milisegundos. `from` es `'first'` (el valor predeterminado), `'last'`, `'center'` o un índice.

La animación que obtienes se resuelve una vez que todas las vistas han finalizado y `stop()` las detiene todas.
