# Gradientes, carga y texto en la Web

**Build de desarrollo, todavía fuera de RC.9.** Las issues #352–#357 añaden `gradient`, `shimmer`, `loader`, `reveal`/`conceal`, `animateText` y `rollTo` al runtime experimental `/web` y sus ámbitos hijos. `/web/vue` gestiona estos recursos mediante `useWebMotion().use()`. La adopción en Mavis sigue siendo un trabajo separado.

## Gradientes {#gradients}

Los gradientes lineales, radiales y cónicos admiten 2–8 colores CSS, conservando su cantidad. Las paradas son fracciones ordenadas entre 0 y 1; el centro usa fracciones de la caja y el radio radial una fracción no negativa de su dimensión menor. Los ángulos usan grados. Color, paradas y geometría se sustituyen de forma independiente. Los colores usan interpolación OKLab premultiplicada compartida; las paradas que sobrepasan límites se ordenan sin intercambiar colores. `bind()` utiliza valores numéricos/de color del mismo runtime y devuelve una limpieza que respeta sustituciones. Con movimiento reducido, la geometría mantiene su posición y los colores siguen activos.

Los gradientes se dibujan sobre las imágenes de fondo existentes y restauran solo los estilos que aún controlan. Los gradientes finitos y valores continuos usan el planificador del runtime porque las cadenas CSS de gradiente no interpolan como canales numéricos WAAPI. No se crea otro bucle de cuadros.

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const paint = scope.gradient(card, {
  type: 'radial',
  colors: ['#4135c2', '#f5cf8e'],
  center: { x: 0.3, y: 0.4 },
  radius: 0.7,
})
await paint.animate({ center: { x: 0.7 }, colors: ['#087e8b', '#ffe1b2'] }, 'snappy')
const centerX = scope.motionValue(0.3)
const unbind = paint.bind({ center: { x: centerX } })
// unbind(); paint.stop(); paint.suspend(); paint.resume(); paint.dispose()
```

<Clip name="web-gradient-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics reales muestran reproducción, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador; sin afirmaciones de rendimiento en dispositivos físicos." />

## Carga {#loading}

`shimmer()` añade un barrido decorativo recortado. `loader()` admite `dots`, `bars` y `ring`; el tamaño usa píxeles CSS. Ambos devuelven funciones de limpieza con `pause`, `play`, `suspend`, `resume` y `dispose`. Las capas temporales son inertes y están ocultas para accesibilidad. Preservan contenido, transformaciones y fondo. La aplicación proporciona etiquetas de carga y `aria-busy`. El movimiento reducido oculta el barrido y mantiene un indicador estático; ocultar el documento pausa la reproducción.

```ts
const shimmer = scope.shimmer(placeholder, { duration: 1500 })
const loader = scope.loader(indicator, { style: 'ring', color: '#f3be7c', size: 48 })
shimmer.pause()
shimmer.play()
loader.pause()
loader.play()
// shimmer(); loader.dispose()
```

<Clip name="web-loading-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics reales muestran reproducción, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador; sin afirmaciones de rendimiento en dispositivos físicos." />

## Revelado circular {#reveal}

Los orígenes usan píxeles CSS locales. La inversión comienza en el círculo visible. Conceal termina con `visibility: hidden`, preservando layout y DOM; reveal restaura la visibilidad. Mueve el foco antes de ocultar contenido interactivo enfocado. Un clip path existente se intersecta mediante una máscara temporal, conservando el recorte de la aplicación. Redimensionar cancela el círculo anterior y restaura sus estilos.

```ts
const hiding = scope.conceal(panel, { to: { x: 24, y: 24 }, duration: 600 })
const showing = scope.reveal(panel, { from: { x: 24, y: 24 }, duration: 600 })
showing.pause()
showing.progress = 0.5
showing.play()
await showing
```

<Clip name="web-reveal-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics reales muestran reproducción, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador; sin afirmaciones de rendimiento en dispositivos físicos." />

## Texto y números rodantes {#text}

`animateText()` agrupa grafemas Unicode o palabras. `rollTo()` recibe un número finito o una cadena formateada; la dirección automática compara destinos numéricos. Los dígitos modificados ruedan y los demás permanecen. Las copias temporales conservan la composición del texto y no son accesibles; el Text original sigue siendo el contenido semántico del framework. La sustitución captura los fragmentos visibles antes de cancelar.

Usa una hoja de texto simple block o inline-block con un máximo de un nodo Text y 256 grafemas. Se rechazan markup interno, controles editables, escritura vertical y transformaciones rotadas, sesgadas o negativas. Se admiten transformaciones positivas alineadas con los ejes. El cambio de tamaño, fuente o texto de la aplicación cancela de forma segura. Los snapshots se aplanan y limitan a 2048 fragmentos visibles; superar el límite rechaza el próximo destino antes de sustituir la animación actual. Las cifras tabulares son temporales; usa CSS `font-variant-numeric: tabular-nums` para mantenerlas en reposo.

```ts
await scope.animateText(label, { by: 'word', duration: 400, stagger: 60, y: 12 })
await scope.rollTo(amount, 12980.6, {
  format: (value) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  direction: 'auto',
  duration: 600,
  bounce: 0.2,
  stagger: 20,
  tabular: true,
})
```

<Clip name="web-text-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics reales muestran reproducción, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador; sin afirmaciones de rendimiento en dispositivos físicos." />

<Clip name="web-roll-chromium" :width="900" caption="Chromium en macOS, interfaz en inglés: clics reales muestran reproducción, pausa/reanudación, sustitución, movimiento reducido y limpieza a velocidad original. Captura de navegador; sin afirmaciones de rendimiento en dispositivos físicos." />

## Propiedad de recursos y Vue {#lifecycle}

Un destino admite un controlador por tipo de efecto. Sustituirlo en el mismo runtime limpia el anterior; se rechaza otro runtime. Las animaciones ofrecen pause/play, progreso y un resultado booleano. Suspender el ámbito pausa la reproducción y desecharlo libera sus recursos. La desconexión y sustitución de refs limpian los efectos; desactivar KeepAlive libera los recursos del setup y activarlo los recrea. La limpieza conserva escrituras posteriores de estilos de la aplicación. Gradientes y máscaras usan el planificador compartido; texto, reveal sin clip propio y carga usan WAAPI. Esto no garantiza ejecución fuera del hilo principal.

```ts
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'
const motion = useWebMotion(elementRef)
motion.use((scope, element) => {
  scope.shimmer(element)
  scope.gradient(element, { type: 'linear', colors: ['#4135c2', '#087e8b'] })
})
```

## Referencias nativas y verificación {#verification}

Las nuevas grabaciones siguientes muestran las implementaciones nativas equivalentes en el demo Vue normal. Son referencias visuales; los vídeos de navegador anteriores ejecutan el nuevo backend Web. Las APIs nativas existentes conservan su comportamiento.

<Clip name="web-native-gradients-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal en inglés: interacción real mediante XCTest muestra el efecto nativo equivalente a velocidad original. Grabación de simulador." />

<Clip name="web-native-shimmer-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal en inglés: interacción real mediante XCTest muestra el efecto nativo equivalente a velocidad original. Grabación de simulador." />

<Clip name="web-native-loaders-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal en inglés: interacción real mediante XCTest muestra el efecto nativo equivalente a velocidad original. Grabación de simulador." />

<Clip name="web-native-reveal-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal en inglés: interacción real mediante XCTest muestra el efecto nativo equivalente a velocidad original. Grabación de simulador." />

<Clip name="web-native-text-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal en inglés: interacción real mediante XCTest muestra el efecto nativo equivalente a velocidad original. Grabación de simulador." />

<Clip name="web-native-rolling-ios" caption="Simulador iPhone 17, iOS 26, demo Vue normal en inglés: interacción real mediante XCTest muestra el efecto nativo equivalente a velocidad original. Grabación de simulador." />

Ejecuta `npm run web:effects:typecheck` y `npm run web:effects:test`. La suite cubre Chromium, Firefox y WebKit, bindings continuos, sustitución, Unicode, identidad del Text original, movimiento reducido, limpieza y ciclo de refs/KeepAlive de Vue. Los consumidores empaquetados prueban las seis APIs públicas con tipos estrictos NodeNext/Bundler e importación segura en SSR.
