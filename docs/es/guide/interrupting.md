# Interrumpir y detener {#interrupting-and-stopping}

Iniciar una animación en una propiedad que ya se está animando toma el control: la nueva comienza desde el valor en pantalla, con la misma velocidad, por lo que una carta puede cambiar de opinión a mitad de camino sin saltar. Otras propiedades de la animación anterior continúan.

<Clip name="interrupting-ios" caption="Golpes repetidos invierten un resorte en vuelo. Reproducción del simulador iOS real a una quinta parte de la velocidad para que el traspaso sea visible." />

`animate()` devuelve una animación que puedes `await`. Se resuelve con `true` cuando se reprodujo hasta el final y `false` cuando se detuvo o se hizo cargo. Nunca rechaza.

```ts
const animation = animate(card, { x: 300 })
animation.stop() // the card stays where it is

stop(card) // stops everything running on the card
stop(card, ['x', 'scale']) // stops translation on x and both scale axes
```

Las propiedades seleccionadas permanecen en sus valores actuales; los demás siguen animando. `scaleX` y `scaleY` también se pueden detener por separado. Pase una matriz vacía para no detener nada u omítala para detener todo. Esto también funciona con conjuntos de objetivos.

Si se detiene parte de una animación, su promesa `finished` se resuelve con `false` una vez que finalizan sus propiedades restantes.

## Establecer valores sin animar {#setting-values-without-animating}

`set()` coloca una vista sin animarla, para un diseño de movimiento reducido, un reinicio antes de un bucle o un estado que simplemente debería estar ahí:

```ts
set(logo, { opacity: 1, scale: 1, y: 0 })
set(card, { backgroundColor: '#fff' })
```

Toma un valor por propiedad, con las mismas propiedades que `animate()`, incluyendo colores y decoraciones. Todo lo que anima esas propiedades se detiene y su `finished` se resuelve con `false`; otras propiedades siguen animando. El siguiente `animate()` comienza desde el valor establecido sin velocidad. Una vista que aún no está cargada obtiene los valores de inmediato y estos ganan sobre una animación que todavía está esperando que se cargue esa vista.

## Bucles y el fondo {#loops-and-the-background}

Las repeticiones infinitas siguen reproduciéndose de forma nativa. En iOS, Core Animation elimina animaciones cuando la aplicación pasa a segundo plano; Jolt los inicia nuevamente cuando regresa.

Para mantener una animación y elegir su marco, consulte [pausar, reproducir y desplazarse](./playback).
