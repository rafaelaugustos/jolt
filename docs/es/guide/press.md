# Pulsación {#press}

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

<Clip name="press" caption="Tres efectos de pulsación en Android." />

Anima a los valores dados mientras un dedo está hacia abajo, y regresa a donde estaba la vista una vez que se levanta, o una vez que el toque se cancela al tomar el control un desplazamiento. Las vistas con `isEnabled` configurado en `false` no reaccionan. Devuelve una función que elimina el efecto.
