# Pulsación {#press}

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

<Clip name="press" caption="Tres efectos de pulsación en Android." />

Anima a los valores dados mientras un dedo está hacia abajo, y regresa a donde estaba la vista una vez que se levanta, o una vez que el toque se cancela al tomar el control un desplazamiento. Las vistas con `isEnabled` configurado en `false` no reaccionan. Devuelve una función que elimina el efecto.

## Pulsación en su propia capa {#layered-press}

**Corrección aún no publicada:** reserve un nombre de capa para que la pulsación conviva con una entrada u otro movimiento. Las contribuciones de traslación y rotación vuelven a `0`; escala y opacidad vuelven a `1`. Soltar o cancelar el toque restaura la base actual, incluso con traslación distinta de cero o escala distinta de uno. Eliminar el efecto también limpia una contribución de pulsación ya estabilizada.

```ts
set(card, { x: 24, scale: 1.5 })
const remove = press(card, { x: 8, scale: 0.88 }, { layer: 'press' })
animate(card, { x: 80 }, 'snappy')
// Al terminar: remove()
```

Reserve ese nombre para el efecto de pulsación. Las demás capas permanecen independientes. Sin `layer`, press conserva su comportamiento de animar la base y volver a los valores de reposo capturados.

<Clip name="motion-rfc-ios" caption="Simulador iOS 26.2, demo Layers en inglés con la auditoría opcional del RFC: toque real sostenido, eliminación de shake durante la entrada, liberación que conserva la base, dos capas infinitas y cambio de ventana de composición. Reproducción nativa a velocidad original; sin medición en dispositivo físico." />
<Clip name="motion-rfc-android" caption="Emulador Android 16 / API 36, demo Layers en inglés con la auditoría opcional del RFC: toques reales mediante ADB comprueban pulsación, capas independientes, cambio de ventana y limpieza. Velocidad original; evidencia de corrección en el emulador." />
