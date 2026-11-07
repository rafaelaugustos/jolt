# Gravedad, háptica, sensores, vidrio y galería Web

La [composición portable candidata a la próxima versión](./portable-composition) incorpora equivalentes Web viables y conserva estos contratos nativos publicados. Las incorporaciones no están en RC.12.

Disponible en RC.12: [interacción y profundidad](./interaction-depth) añade drop zones, audio/cues opcionales, inspección y contratos Web de paths, 3D y sombras.

## Auditoría de RC.10 {#rc10-audit}

La RC.10 publicada incluye los PR #358, #365, #372 y #379. La [matriz completa de exports](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/capability-matrix.json) y la [auditoría de contratos](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-web-audit.md) distinguen disponibilidad de paridad funcional. `npm run parity:check` comprueba todos los exports de ejecución y las propiedades de keyframes. Quedan diferencias en movimiento por trayectorias, rotación 3D, sombras/profundidad, replay/inspector y validación del hardware en navegadores móviles reales. Las grabaciones de escritorio siguientes no acreditan esa aceptación física.

**Disponible desde 0.1.0-rc.10.** El lote cubre [#373–#378](https://github.com/rafaelaugustos/jolt/issues/373) bajo [#236](https://github.com/rafaelaugustos/jolt/issues/236) y avanza la parte Web de [#117](https://github.com/rafaelaugustos/jolt/issues/117). Importe `/web` durante SSR y cree el runtime y sus elementos montados en el cliente. Los recursos del ámbito se suspenden, reanudan y eliminan con él.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## Gravedad finita {#gravity}

`animate()` admite `type: 'gravity'` para `x`, `y` y valores numéricos. Comparte el compilador balístico finito nativo: aceleración positiva hacia el destino, restitución en `[0, 1)`, velocidad explícita o heredada con signo, un destino, retrasos/repeticiones y capas independientes. Pausa, reproducción, búsqueda, interrupción, movimiento reducido y validación transaccional conservan las reglas existentes. Una animación pausada transmite velocidad cero. Es independiente de `physicsWorld()`.

```ts
const fall = scope.animate(
  card,
  { y: 280 },
  {
    type: 'gravity',
    acceleration: 1800,
    restitution: 0.6,
  },
)
fall.pause()
fall.progress = 0.3
fall.play()
const height = scope.motionValue(0)
scope.animate(height, 280, { type: 'gravity', velocity: -600 })
```

<Clip name="web-gravity-parity-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: clics reales para caída, pausa/reanudación, lanzamiento e interrupción. Velocidad original." />
<Clip name="gravity-ios" caption="Simulador iOS, demo inglesa: toques reales para caída, lanzamiento, interrupción y pausa/reanudación. Grabación existente revisada, velocidad original; sin medición física de rendimiento." />

## Háptica opcional {#haptics}

`haptic()` devuelve `backend: 'vibration' | 'none'` y `status: 'requested' | 'unavailable' | 'blocked' | 'disabled'`. `requested` confirma la solicitud del navegador, no la vibración física. La [Vibration API](https://www.w3.org/TR/vibration/) ofrece duraciones de 10/20/30 ms, sin equivalencia con intensidades nativas. Requiere documento visible y activación previa del usuario; el movimiento reducido suprime las solicitudes. No se fuerza una alternativa. Press emite una vez por contacto/tecla aceptados y respeta disabled/loading. Las animaciones usan la llegada o `times` crecientes en `(0, 1]`, sin contar el retraso inicial. Pausar reprograma; buscar consume puntos omitidos; interrumpir cancela; se descartan señales con más de 100 ms de retraso.

```ts
const result = motion.haptic('light')
scope.press(button, { scale: 0.96 }, { haptic: 'light' })
scope.animate(
  card,
  { x: 240 },
  {
    duration: 800,
    haptic: { style: 'medium', times: [0.5, 1] },
  },
)
```

<Clip name="web-haptics-parity-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: solicitudes reales por botón/animación y pausa/reanudación. El vídeo de escritorio no demuestra vibración ni intensidad nativa." />
<Clip name="haptics-android-device" caption="ASUS_Z017DC físico, Android 8, interfaz inglesa: toques reales solicitan feedback nativo. Destellos indican solicitudes; el vídeo no transmite sensación táctil. Grabación revisada." />

## Sensores de rotación y gravedad {#sensors}

`sensor('rotation')` expone XYZ relativos en **radianes**, un cuaternión Hamilton normalizado (`xyzw`) y `recenter()`. `sensor('gravity')` expone gravedad hacia abajo en **m/s²**; un teléfono horizontal boca arriba tiene Z negativo. Se resta la aceleración incluyendo gravedad de la aceleración lineal; no se sustituye una lectura ausente por aceleración total. Las coordenadas siguen la interfaz por defecto; `device` conserva los ejes del dispositivo. La [Device Orientation and Motion API](https://www.w3.org/TR/orientation-event/) exige contexto seguro y puede requerir permiso. Llame a `requestPermission()` directamente desde una acción del usuario; construcción y reanudación nunca solicitan permiso automáticamente. `available` solo se activa tras una muestra válida. Dos segundos sin datos útiles producen `unavailable` / `no-data`; también existen `permission-required`, `denied`, `idle`, `starting`, `active`, `paused` y `disposed`. Los timestamps son del evento monotónico del navegador, no se prometen timestamps físicos. `interval: 'auto' | 5–1000` limita entregas, no la frecuencia del hardware. Bindings/suscripciones activan adquisición compartida por evento/documento; sin consumidores, al suspender, ocultar, reducir movimiento o eliminar se detiene. La rotación conserva la pose relativa tras reiniciar. Reserve `reducedMotion: 'continue'` para entrada intencionada no decorativa.

```ts
const rotation = scope.sensor('rotation')
const gravity = scope.sensor('gravity', { coordinates: 'interface' })
scope.bind(card, {
  rotate: scope.map(rotation.z, [-Math.PI, Math.PI], [-180, 180]),
  x: scope.map(gravity.x, [-10, 10], [-80, 80]),
})
enableButton.onclick = () => {
  void rotation.requestPermission()
  void gravity.requestPermission()
}
rotation.recenter()
console.log(gravity.snapshot())
```

<Clip name="web-sensors-parity-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: habilitación, pausa/reanudación y recentrado reales con estado sin datos. Sin muestras físicas ni movimiento sintético en la grabación." />
<Clip name="device-sensors-physical-ios" caption="iPhone 17 Pro físico, iOS 27.2, demo Release inglesa: Core Motion real mueve vistas nativas. Captura USB revisada a velocidad original; no demuestra sensores Web ni calibración." />

## Vidrio controlado {#glass}

`glass()` ofrece `set`, `animate`, `stop`, `suspend`, `resume`, `dispose` y `snapshot`. El backend es `css-backdrop-filter` o `solid`. Sin soporte, con transparencia reducida o colores forzados se usa una superficie sólida. No se promete refracción ni fusión UIKit Liquid Glass. El fondo se filtra sin bloquear controles hijos. Intensidad `[0, 1]`, radio `1–64` píxeles CSS. Eliminar restaura solo estilos todavía propios y conserva escrituras de la aplicación. No asigne dos propietarios de blur/glass al mismo canal.

```ts
const surface = scope.glass(panel, {
  amount: 0.7,
  radius: 24,
  tint: 'rgba(30, 38, 58, 0.35)',
  fallbackColor: '#202638',
})
scope.add(surface.animate(1, { duration: 400 }))
console.log(surface.snapshot().backend)
```

<Clip name="web-glass-parity-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: filtro real del fondo, intensidad pausada y botón hijo interactivo. CSS, sin Liquid Glass nativo." />
<Clip name="glass-legacy-ios" caption="Simulador iOS 18.6, interfaz inglesa: toques reales controlan superficies nativas de blur y movimiento. Grabación revisada; sin fusión Liquid Glass ni dispositivo físico." />

## Retorno de ruta interactivo {#navigation}

`interactiveNavigation()` reutiliza gestos y una capa de traslación independiente. El gesto horizontal comienza en los primeros 32 píxeles CSS del borde; el vertical usa toda la superficie. Posición y velocidad deciden cancelar o salir. Un resorte parte de la pose/velocidad actuales; después `commit` llama al router una vez. `false`, rechazo o timeout revierten la vista. `cancel()` invierte una salida activa; `back()` sirve a botones/teclado. El router debe respetar la señal de cancelación y resolver tras confirmar la ruta. Jolt no deshace rutas ya cambiadas, no intercepta historial, no implementa retorno predictivo del sistema y no gestiona automáticamente el foco de la ruta. Eliminar libera su contribución y listeners.

```ts
const backGesture = scope.interactiveNavigation(page, {
  axis: 'x',
  edgeWidth: 32,
  canBegin: () => !editorIsBusy(),
  commit: ({ animated, signal }) => routerBack({ animated, signal }),
})
backButton.onclick = () => backGesture.back()
// backGesture.cancel()
```

<Clip name="web-navigation-parity-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: arrastres reales cancelan un retorno corto y confirman el largo una vez. Router de la aplicación, sin gesto del sistema." />
<Clip name="interactive-navigation-ios" caption="Simulador iOS 26.2, interfaz inglesa: toques y arrastres reales cancelan/confirman retornos nativos. Grabación revisada a velocidad original; no es dispositivo físico." />

## Galería y retorno por identidad {#gallery}

`sharedNavigationEntry()` coordina una entrada y retorno, con las restricciones de snapshots de shared-layout. `returnFrom(intent)` captura la pose retenida de zoom/arrastre antes del cambio de ruta y transfiere velocidad vertical. Un rechazo llama a `intent.cancel()` y conserva el visor. Retornos repetidos comparten operación. `resolveListTarget()` vuelve a consultar índice, solicita materialización al virtualizador, valida la clave viva y exige rectángulo estable durante dos frames. Nunca guarda una celda/índice obsoletos. El resolver recibe cancelación; plazo predeterminado 1500 ms, máximo 5000 ms. Si falta el elemento, fue eliminado o vence el plazo, la ruta termina sin vuelo compartido y usa `fallbackFocus`, que debe ser enfocable. Una miniatura actual enfoca su botón/enlace contenedor. La aplicación conserva callbacks de ruta y debe respetar cancelación; cancelar lo visual no revierte navegación confirmada. Materialización y decodificación corresponden a la aplicación. Los vídeos muestran zoom focal, retorno por botón, cancelación, confirmación, reciclaje y eliminación. Avanza #117 sin declarar completa su aceptación nativa pendiente de accesibilidad/dispositivos.

```ts
import { resolveListTarget } from '@rafaelaugusto/jolt/web'
const entry = scope.sharedNavigationEntry(region, {
  tag: photoKey,
  source: () => thumbnailForKey(photoKey),
  detail: () => detailImage,
  back: ({ animated, signal }) => showCollection({ animated, signal }),
  returnTarget: {
    key: photoKey,
    resolve: (context) =>
      resolveListTarget(context, {
        container: list,
        indexOf: (key) => photos.findIndex((photo) => photo.id === key),
        scrollToIndex: (index, { signal }) => realizeRow(index, signal),
        viewForKey: thumbnailForKey,
        keyOf: (element) => element.dataset.key,
      }),
    fallbackFocus: () => collectionHeading,
  },
})
await entry.open(({ animated, signal }) => showPhoto({ animated, signal }))
scope.zoomable(detailImage, {
  viewport,
  onDismiss: (intent) => {
    void entry.returnFrom(intent)
  },
})
backButton.onclick = () => {
  void entry.back()
}
```

<Clip name="web-gallery-parity-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: miniatura, zoom focal, pan, arrastre cancelado/confirmado, desplazamiento virtual y foco tras eliminación. Velocidad original." />
<Clip name="gallery-ios" caption="Simulador iOS 26.2, interfaz inglesa: multitoque real, doble toque interrumpido, arrastre cancelado, retorno tras reordenación y alternativa por eliminación. Grabación revisada a velocidad original." />

## Validación y reproducción {#validation}

Ejecute `npm run web:parity:typecheck`, `npm run web:parity:test`, `npm run build`, `npm run core:check`, `npm run package:check`, `python3 benchmarks/verify-sensor-math.py --web`, `npm run docs:check-media` y `npm run docs:build`. La suite cubre Chromium, Firefox y WebKit. Permisos/sensores/vibración inyectados son fixtures de prueba, no evidencia física. Reproduzca vídeos reales con `node benchmarks/web-parity/record.mjs`; la captura nativa sigue `CONTRIBUTING.md`. La adopción Mavis continúa por separado.

[Validación Web móvil](mobile-web.md)
