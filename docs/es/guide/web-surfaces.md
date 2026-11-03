# Partículas, superficies y efectos de imagen Web

**Disponible desde 0.1.0-rc.10.** Las issues #359–#364 añaden seis métodos al runtime y sus ámbitos. Importar `/web` es seguro durante SSR; cree el runtime tras montar y use imágenes HTML decodificadas con dimensiones positivas. La adopción en Mavis sigue separada.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const snow = scope.particles(scene, { source: 'top', angle: 90, rate: 30 })
scope.confetti(button, { count: 80 })
const soft = scope.blur(panel, { radius: 24 })
await soft.animate(0.7, 'smooth')
const line = scope.shape(canvasHost, {
  d: 'M10 10 L90 10 L90 90 L10 90 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#6851c9',
  stroke: '#b9fff1',
})
await line.animate({ d: 'M50 0 L100 50 L50 100 L0 50 Z' })
await photo.decode()
const flow = scope.liquid(photo, { intensity: 0.8 })
flow.pause()
flow.resume()
flow.stop()
await nextPhoto.decode()
const swap = scope.imageEffect(photo, 'dissolve', { to: nextPhoto, paused: true })
swap.progress = 0.4
swap.play()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## Control y ciclo de vida {#lifecycle}

Los seis métodos funcionan en motion.scope() y /web/vue. Suspender congela, reanudar continúa y dispose libera capas, listeners, tareas y estilos. El tiempo oculto no cuenta. Las opciones inválidas preservan el propietario anterior y otro runtime no puede tomar el destino. Las capas decorativas no interceptan entrada ni accesibilidad. Use scope.use() con refs reemplazables y KeepAlive.

Blur de contenido, liquid e imageEffect comparten un propietario de filter; backdrop blur es independiente. La limpieza conserva filtros anteriores y escrituras posteriores de la aplicación. Coloque bordes/fondos en un contenedor externo si solo debe filtrar la imagen. Canvas/CSS/SVG y el planificador JavaScript compartido no prometen ejecución fuera del hilo principal ni píxeles idénticos a los nativos.

## Partículas y confeti {#particles}

particles() acepta las [opciones nativas](./particles) en píxeles CSS, con un máximo de 10.000 partículas vivas y 4.194.304 píxeles de Canvas (DPR máximo 2). Cambiar tamaño afecta nuevos nacimientos; se omiten nacimientos expirados tras un cuadro lento. duration termina la emisión y deja expirar las partículas.

confetti() emite durante 200 ms con vida de 2200 ms, desde el centro capturado hacia una capa fija del viewport fuera del recorte de ancestros, por debajo de diálogos top-layer. Ambos devuelven limpieza invocable, pause/play, suspend/resume, dispose, finished y snapshot. Fin natural devuelve true, cancelación false. Movimiento reducido suprime ráfagas y limpia partículas continuas; se reanudan sin emisiones atrasadas.

<Clip name="web-particles-surfaces-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: interacción real, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador, no de dispositivo físico." />

<Clip name="web-confetti-surfaces-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: interacción real, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador, no de dispositivo físico." />

<Clip name="particles-ios" caption="Simulador iOS, interfaz inglesa: reproducción e interacción nativas reales revisadas y reutilizadas como referencia. Velocidad original; no es un dispositivo físico." />

## Desenfoque controlado {#blur}

blur() usa filtro CSS de contenido, amount 0–1 y radius 1–64 (24 por defecto). mode: backdrop usa backdrop-filter o informa backend none. style acepta system/light/dark sin emular el material iOS. animate conserva intensidad y velocidad de resorte al interrumpir; admite pausa y seek. set aplica, stop mantiene y dispose restaura. Movimiento reducido aplica el destino. El vídeo iOS usa material; Android usa desenfoque de contenido.

<Clip name="web-blur-surfaces-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: interacción real, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador, no de dispositivo físico." />

<Clip name="blur-ios" caption="Simulador iOS, interfaz inglesa: reproducción e interacción nativas reales revisadas y reutilizadas como referencia. Velocidad original; no es un dispositivo físico." />

## Formas y morphing {#shape}

shape() crea SVG decorativo con relleno, trazo, viewBox y reglas de extremos/uniones. Comparte el parser portátil. animate requiere comandos normalizados/subrutas compatibles; set admite otra topología. strokeStart/End usa 0–1 y recorta solo el trazo; el recorte parcial requiere un contorno. Pausa, seek e interrupción están disponibles; la nueva curva comienza desde la geometría actual. stop mantiene y dispose elimina. drawPath sigue controlando SVG propiedad de la aplicación.

<Clip name="web-shape-surfaces-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: interacción real, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador, no de dispositivo físico." />

<Clip name="shapes-ios" caption="Simulador iOS, interfaz inglesa: reproducción e interacción nativas reales revisadas y reutilizadas como referencia. Velocidad original; no es un dispositivo físico." />

## Imágenes líquidas {#liquid}

liquid(image, { intensity: 0.7, duration: 8000 }) comparte el campo periódico de iOS mediante un mapa SVG 48 × 48. intensity va de 0 a 1; duration es un ciclo positivo en ms. pause/resume/stop conservan su significado; también existen play/suspend/dispose y diagnostics. Movimiento reducido conserva la imagen y pausa el reloj. Cambiar src o desmontar dispone el efecto; recréelo tras cargar. Resize actualiza liquid; los efectos finitos se cancelan. Android nativo conserva la imagen sin deformar. Imágenes Web no listas o incompatibles devuelven un control terminado con motivo explícito.

<Clip name="web-liquid-surfaces-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: interacción real, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador, no de dispositivo físico." />

<Clip name="liquid-ios" caption="Simulador iOS, interfaz inglesa: reproducción e interacción nativas reales revisadas y reutilizadas como referencia. Velocidad original; no es un dispositivo físico." />

## Ondas, distorsión y disolución {#image}

imageEffect acepta ripple, distortion y dissolve. Origen, amplitud 0–64 (8 por defecto) y radio positivo (96) usan píxeles locales. Duración predeterminada 650 ms; seed entero 0–65535. distortion captura puntero y controla touch-action; se asienta al soltar y rechaza seek/reverse finitos. Use imágenes alineadas a los ejes, sin rotación/skew.

Los controles finitos ofrecen finished, progress, pause/play, reverse y finish. Seek conserva pausa; finish termina en el extremo de la dirección actual. Cancelación restaura la fuente y devuelve false. Disolución hacia adelante aplica el to: HTMLImageElement decodificado y elimina srcset/sizes; reversa conserva la fuente. El framework debe actualizar su modelo tras el éxito.

Solo raster estático cargado, con layout positivo y hasta 4.194.304 píxeles físicos de salida. Disolución admite fill/contain/cover/none/scale-down con object-position porcentual y destino legible por Canvas (CORS si corresponde). La CSP debe permitir imágenes data. Renderer no disponible, posición incompatible o movimiento reducido conserva decoraciones (false), pero aplica disolución inmediatamente (true), incluso pausada. diagnostics informa backend/reason. Movimiento reducido activado durante playback finito termina en su extremo direccional. Cambios de src, fuente responsiva o tamaño cancelan. Preserve alt y estados de carga/error.

<Clip name="web-image-surfaces-chromium" :width="900" caption="Chromium en macOS, interfaz inglesa: interacción real, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador, no de dispositivo físico." />

<Clip name="image-effects-ios" caption="Simulador iOS, interfaz inglesa: reproducción e interacción nativas reales revisadas y reutilizadas como referencia. Velocidad original; no es un dispositivo físico." />

## Validación y reproducción

Ejecute npm run web:surfaces:typecheck y npm run web:surfaces:test. Chromium, Firefox y WebKit verifican píxeles, puntero, finalización, propiedad, tiempo oculto, cambios de fuente, Shadow DOM/base URL y limpieza. Capture con node benchmarks/web-surfaces/record.mjs. Se preservan los vídeos nativos. Consulte el [informe](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-surfaces.md).
