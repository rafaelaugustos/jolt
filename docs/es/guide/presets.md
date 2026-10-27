# Efectos predefinidos {#presets}

```ts
animate(card, 'popIn')
animate(card, 'shake', { delay: 200 })
animate(spinner, 'spin', { repeat: Infinity })
```

<Clip name="presets" caption="fadeInUp, popIn y sacudido del patio de recreo." />

|          |                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Ingresar | `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY` |
| Salir    | `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`, `popOut`                |
| Atención | `pulse`, `bounce`, `shake`, `wiggle`, `heartbeat`, `jelly`, `flash`, `tada`, `spin`                      |

Las instrucciones siguen animate.css: `fadeInUp` sube desde abajo, `fadeOutUp` sale hacia arriba. Cada ajuste preestablecido integrado consta de fotogramas clave simples y una transición, enumerados en [`src/presets.ts`](https://github.com/rafaelaugustos/jolt/blob/main/src/presets.ts) y exportados como `presets`.

Los ajustes preestablecidos de atención utilizan [fotogramas clave relativos](./animating#relative-keyframes). Una tarjeta en `x: 40` oscila alrededor de 40 y regresa allí. `pulse`, `heartbeat`, `jelly` y `tada` conservan la escala actual de cada eje; `flash` vuelve a la opacidad original. `spin` agrega un giro completo a la rotación actual.

Pase `{ relative: false }` para usar los fotogramas clave absolutos originales. Los ajustes preestablecidos de entrada y salida permanecen absolutos.

## Cambiar el tiempo o la curva de un preset {#changing-a-preset-s-timing-or-curve}

Las opciones con temporización únicamente (`delay`, `repeat`, `stagger`) mantienen las curvas preestablecidas. Las opciones con curva (`duration`, `ease`, resorte) las reemplazan:

```ts
animate(card, 'fadeInUp', { delay: 100 }) // the preset's spring, 100ms later
animate(card, 'fadeInUp', { duration: 600 }) // a 600ms tween instead
animate(card, 'fadeInUp', 'bouncy') // a bouncy spring instead
```

## Preajustes personalizados {#custom-presets}

Registra fotogramas clave y una transición bajo un nombre con `definePreset`:

```ts
import { animate, definePreset, sequence } from '@rafaelaugusto/jolt'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    cardIn: true
  }
}

definePreset('cardIn', {
  keyframes: { opacity: [0, 1], y: [40, 0] },
  transition: { type: 'spring', bounce: 0.2, opacity: { duration: 150 } },
})

animate(card, 'cardIn')
animate(cards, 'cardIn', { stagger: 40 })
sequence([
  [logo, 'popIn'],
  [card, 'cardIn'],
])
```

Coloque el registro en un módulo importado durante el inicio de la aplicación, antes de que cualquier animación use el nombre. La declaración `Presets` amplía `PresetName` para TypeScript; no registra nada en tiempo de ejecución. El uso de un nombre no registrado genera un error.

La definición tiene el tipo `Preset` exportado. Su `transition` tiene las mismas opciones que `animate()`, incluidas transiciones por propiedad y `stagger`. Las opciones pasadas a `animate()` anulan esos valores predeterminados utilizando las reglas anteriores.

Al registrar nuevamente un nombre personalizado se reemplaza su definición para futuras animaciones; Las animaciones en ejecución mantienen sus pistas existentes. Los nombres integrados no se pueden reemplazar mediante `definePreset`. El objeto `presets` exportado sigue conteniendo solo las funciones integradas.
