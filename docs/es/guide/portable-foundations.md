# Puntero, grupos de propiedades y superficies de dibujo

Este trabajo apunta a RC.12; todavía no forma parte de RC.11.1. NativeScript y el runtime Web experimental comparten validación y ciclo de vida, con ejecución específica por plataforma. Recompila las aplicaciones nativas con paquetes Jolt compatibles.

## Posición y presencia del puntero

NativeScript incorpora `pointerFollow`; Web añade `presence` a su implementación existente. El toque normal no genera hover. Conserva botones, toque y teclado para las acciones esenciales.

```ts
import { bind, motionScope } from '@rafaelaugusto/jolt'
const scope = motionScope()
const pointer = scope.pointerFollow(region, { spring: false })
scope.use(() => bind(dot, { x: pointer.x.to([-1, 1], [-120, 120]) }))
scope.use(() =>
  pointer.presence.subscribe((value) => {
    // 1 dentro de la región; 0 fuera.
  }),
)
scope.dispose()
```

En Web usa `runtime.scope().pointerFollow(element, options)` y `scope.bind()`. Ambos ofrecen `x`, `y`, `presence`, `active`, `available`, `disposed`, `suspended`, `update({ disabled })`, `refresh()`, `suspend()`, `resume()` y `dispose()`. `presence` es un valor numérico inmediato. En nativo, `spring: false` entrega valores sin suavizado compatibles con bindings compilados de propiedades externas. Los nodos de los resortes predeterminados no son aceptados por el sampler actual de esos bindings; usa valores sin suavizado o una suscripción JS con propietario explícito.

| Contrato       | NativeScript                                                   | Web                                               |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Píxeles        | DIPs locales, con conversión de transformaciones               | Píxeles CSS del rectángulo alineado al viewport   |
| Predeterminado | Origen central, normalizado −1…1                               | El mismo mapeo                                    |
| Capacidad      | Hover en iPadOS; ratón/lápiz en hover en Android; no en iPhone | Pointer Events y capacidad de hover del navegador |
| Coste          | Un callback JS por evento nativo entregado                     | Actualizaciones agrupadas del puntero             |

Opciones: `axis`, `coordinates`, `range`, `rest`, `spring`, `disabled`. `range` transforma valores normalizados o limita píxeles; `rest` debe estar dentro del intervalo declarado. Un tamaño cero no produce presencia activa. Pausa, background, desmontaje, desactivación y movimiento reducido restauran reposo y presencia cero. Resize se observa; llama a `refresh()` después de cambios de coordenadas del app. `available` indica soporte de API, no un accesorio conectado. Los seguidores decorativos deben ser no interactivos. La proyección de escenas y la política de superposición pertenecen al app. Android observa los eventos de ventana y los delega al callback original. No se promete avance mientras JavaScript esté bloqueado.

<Clip name="portable-pointer-ipados" :width="720" caption="Simulador iPad Pro de 11 pulgadas (M4), iPadOS 26.2, interfaz en inglés: hover continuo inyectado en el sistema mueve el elemento nativo y uniforms SceneKit, preserva un toque, redimensiona y remonta. Tiempo original; no se probaron ratón ni iPad físicos." />
<Clip name="portable-pointer-android" caption="ASUS ZenFone 3 físico, Android 8, interfaz en inglés: eventos nativos de ratón inyectados mueven el elemento, la salida restaura reposo y un toque real sigue funcionando. Tiempo original; no se probó un ratón físico." />
<Clip name="portable-pointer-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: entrada, movimiento y salida del ratón, clic preservado, resize, pausa/reanudación y remontaje. Interacción real y tiempo original; el toque no se convierte en hover." />

## Propiedades relacionadas en una operación

```ts
import { propertyGroup } from '@rafaelaugusto/jolt/native'
const group = scope.resource(() => propertyGroup({ a, b, c }))
const motion = group.animate({ a: 0.8, b: 0.4, c: 1 }, { duration: 1800 })
motion.pause()
motion.progress = 0.5
motion.play()
```

Los miembros son adapters tipados existentes. El grupo toma prestados entre 1 y 64 canales distintos; cada comando requiere exactamente todos los miembros. Valida destinos, componentes y transiciones antes de interrumpir una animación válida. Rechaza canales duplicados y backends mezclados. Ofrece `get`, `set`, `animate`, `stop`, `suspend`, `resume` y `dispose`; destruir el grupo no destruye sus adapters.

Sustituir un miembro cancela todo el grupo, conservando canales ajenos. La nueva animación usa la presentación actual y la velocidad proyectada de los resortes. `finished` se resuelve una sola vez, `false` al cancelar. Si falla `set()`, intenta restaurar los valores escritos y agrupa errores de rollback; no reinicia animaciones canceladas. Un fallo parcial de preparación nativa cancela los players creados, sin deshacer efectos externos. El reloj lógico compartido no garantiza escrituras GPU atómicas entre renderers.

Nativo requiere `@rafaelaugusto/jolt-native` y coordina players compilados con un reloj lógico, sincronizando su posición tras el setup. Web usa `scope.property(target, definition)` con `name`, `units`, `read`, `write`, `encode`, `decode` y, opcionalmente, `alive`, `spatial`, `validate`, `interpolate`; `scope.propertyGroup()` agrupa adapters de un runtime/documento. Una tarea del scheduler escribe en la thread principal; WAAPI normal conserva su ejecución. Los destinos DOM deben permanecer conectados; usa `alive()` para recursos externos y destruye primero sus adapters. Movimiento reducido lleva el grupo espacial al destino y la suspensión conserva las pausas manuales.

Cada propiedad admite hasta 64 componentes numéricos. Las animaciones muestreadas tienen un límite de 262.144 componentes por miembro y 1.048.576 por grupo; solicitudes mayores fallan antes de interrumpir una reproducción válida. Son límites de asignación, no una garantía de duración.

<Clip name="portable-groups-ios" caption="Simulador iPhone 17 Pro, iOS 26.2, interfaz en inglés: tres propiedades UIKit compiladas y tres uniforms reales de SceneKit, pausa/reanudación, sustitución y remontaje. La demanda vuelve a idle. Tiempo original; no es medición física." />
<Clip name="portable-groups-android" caption="ASUS ZenFone 3 físico, Android 8, interfaz en inglés: tres propiedades nativas compiladas con inicio, pausa/reanudación, sustitución y remontaje coordinados. Toques reales, tiempo original; esta demo Android no contiene SceneKit." />
<Clip name="portable-groups-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: tres propiedades DOM y uniforms reales de WebGL, pausa/reanudación, sustitución, demanda inactiva y remontaje. Clics reales y tiempo original." />

## Demanda del renderer

```ts
const activity = scope.renderActivity({
  change(active) {
    renderer.setContinuous(active)
  },
  redraw() {
    renderer.drawFinalFrame()
  },
})
activity.track(motion)
const child = activity.scope()
const release = child.hold()
release()
```

`track()` observa delay, pausa, seek, sustitución y finalización del reloj real. No posee la animación: quitar la observación no la detiene. Los delays reservan demanda. `hold()` cubre trabajo continuo hasta liberarlo. Propietarios hijos agregan demanda; usa `activity.scope()` en lugar de dos raíces para el mismo adapter. El máximo es de 4.096 observaciones/tokens. No añade polling ni un loop permanente.

Un dibujo estático retenido no mantiene el renderer activo. Suspensión/background suprimen demanda; `redraw()` entrega el estado final o buscado mientras está visible. La integración combina la demanda con la política propia del app, sin modificar globalmente SceneKit. Los vídeos anteriores muestran esta integración; los tests Web también verifican que el contador real de frames WebGL deja de avanzar cuando está inactivo.

## Dibujo retenido y acotado

```ts
import { drawBatch } from '@rafaelaugusto/jolt/shapes'
const drawing = scope.resource(() =>
  drawBatch(host, {
    viewBox: [0, 0, 760, 300],
    styles: { signal: { fill: '#63e3c2', strokeWidth: 0 } },
    items: [{ id: 'dot', style: 'signal', kind: 'circle', cx: 30, cy: 80, radius: 4 }],
  }),
)
drawing.update([
  { id: 'dot', style: 'signal', kind: 'circle', cx: 40, cy: 80, radius: 8 },
])
```

Web usa `scope.drawBatch(element, sameOptions)`. Admite círculos, rectángulos y paths SVG validados. IDs únicos: 1–128 letras/dígitos/puntos/guiones/guiones bajos. El orden del array es el de pintura. `set({ items, styles })` reemplaza las colecciones suministradas para insertar, quitar o reordenar. `update(items)` reemplaza elementos completos existentes por ID. Los estilos compartidos usan las opciones de relleno/trazo de `shape`; rechaza campos desconocidos antes de sustituir el dibujo válido.

El `viewBox` inmutable se ajusta proporcionalmente, centra y recorta en bounds locales; geometría y trazo usan sus unidades. Resize actualiza ese mapeo. iOS retiene paths en una layer; Android usa un drawable y primitivas Canvas para círculos/rectángulos. Web conserva un SVG decorativo con un path por elemento y reutiliza nodos sin cambios. Menos vistas nativas no implica menos DOM o CPU.

| Límite                            |                      Nativo y Web |
| --------------------------------- | --------------------------------: |
| Elementos / estilos               |                        1.024 / 64 |
| Comandos / componentes totales    |                    8.192 / 65.536 |
| Por path                          |  256 comandos / 20.000 caracteres |
| Actualización serializada         |                             2 MiB |
| Animación muestreada por elemento | No disponible; cambios inmediatos |

`snapshot()` informa conteos y bytes numéricos de geometría, no memoria del proceso. La animación del host se posee por separado y respeta movimiento reducido. `suspend()` conserva el dibujo y aplaza escrituras hasta `resume()`; background hace lo mismo. Unload nativo libera geometría y load la restaura. `dispose()` elimina la superficie permanentemente. Hit-testing y accesibilidad por elemento pertenecen al app; la superficie no intercepta entrada.

<Clip name="portable-drawing-ios" caption="Simulador iPhone, iOS 26.2, interfaz en inglés: 259 puntos e indicador segmentado en una layer, cambios dirigidos, movimiento del host, ediciones aplazadas durante pausa y remontaje. Interacción nativa real, tiempo original." />
<Clip name="portable-drawing-android" caption="ASUS ZenFone 3 físico, Android 8, interfaz en inglés: 259 puntos, cambios dirigidos, indicador segmentado, pausa/reanudación y remontaje en una superficie Canvas nativa. Toques reales, tiempo original." />
<Clip name="portable-drawing-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: receta compartida de 259 puntos e indicador SVG, cambios, pausa/reanudación y remontaje. Tiempo original; un path SVG por elemento." />

## Correcciones nativas

Las formas iOS usan `UIView.bounds` local después de layout transformado, para que escala/rotación no cambien su tamaño interno. Android y Web ya usan geometría local. El observador de presión iOS deja de reenviar toques nativos, evitando acciones duplicadas, y cancela feedback al suspender. Se reprodujo y corrigió la duplicación; el reporte original de una acción durante suspensión no se reprodujo independientemente.

<Clip name="portable-shape-ios" caption="Simulador iPhone, iOS 26.2: dibujo transformado directamente y dentro de un padre transformado mantienen geometría local bajo escala, rotación y ambas. Interfaz en inglés, toques reales, tiempo original." />
<Clip name="portable-press-ios" caption="Simulador iPhone, iOS 26.2: una acción por toque con feedback en scope, Home/background, regreso y remontaje. Interfaz en inglés, tiempo original; muestra prevención de duplicación, no una acción reproducida durante suspensión." />

Consulta [validación y datos brutos](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-foundations.md). No demuestran menor CPU/PSS total del app ni superioridad sobre Reanimated.
