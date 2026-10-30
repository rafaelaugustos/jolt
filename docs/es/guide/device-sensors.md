# Sensores del dispositivo {#motion-from-your-phone}

`sensor()` proporciona rotación y gravedad al gráfico de valores nativos existente de Jolt. Una fuente puede inclinar una tarjeta, mover su resaltado y compensar un fondo, con resortes nativos suavizando el resultado. Importe el punto de entrada opcional `@rafaelaugusto/jolt/sensors`. Disponible desde **0.1.0-rc.1**; reconstruir la aplicación nativa.

<Clip name="device-sensors-physical-ios" caption="iPhone 17 Pro físico, iOS 27.2, demo Release: la rotación y la gravedad reales de Core Motion mueven la tarjeta, el reflejo y el paralaje con suavizado mediante springs nativos. Interfaz en inglés, captura de pantalla por USB a velocidad original. Muestra la respuesta al movimiento; no mide la precisión de los ejes ni el rendimiento." />

<Clip name="device-sensors-ios" caption="iOS 26.2 simulator: real native views driven by explicitly simulated sensor inputs, with actual taps to pause, resume, recenter and reduce motion. Velocidad original. El simulador no tiene hardware de movimiento; Este no es un sensor de dispositivo físico ni evidencia de rendimiento." />
<Clip name="device-sensors-ios-pt" caption="Simulador iOS, portugués: la misma vista previa de entrada nativa y controles de ciclo de vida. La pantalla identifica la entrada simulada." />
<Clip name="device-sensors-android" caption="Emulador Android 16: la tarjeta nativa, la luz y el paralaje siguen muestras de prueba explícitas. El ADB real toca pausar, reanudar y reducir movimiento el ejercicio. Velocidad original; El hardware emulado y las muestras de prueba no establecen el rendimiento del dispositivo físico." />
<Clip name="device-sensors-android-pt" caption="Emulador Android, portugués: reproducción nativa con entradas simuladas visiblemente etiquetadas y controles traducidos." />

## Segundo plano y reentrada en la pantalla {#background-and-reentry}

La auditoría del ciclo de vida ejecuta cinco ciclos reales de inicio y retorno a la aplicación en tres instancias separadas de **Move the light**. Verifica que los valores y las poses nativas de la tarjeta y su reflejo se conserven al reanudar, que las actualizaciones continúen, que una pausa explícita se mantenga y que los registros de sensores, las fuentes y los nodos de valores nativos vuelvan a cero al liberar cada ruta.

El primer ciclo utiliza la adquisición de la plataforma: el emulador Android elimina sus dos registros de sensores en segundo plano y los restaura al volver; el simulador iOS conserva correctamente la alternativa para hardware no disponible. Los ciclos siguientes utilizan la vista previa nativa con entradas simuladas, identificadas en pantalla. Esto valida el ciclo de vida, sin medir precisión física, latencia ni batería. La auditoría confirmó la implementación existente sin cambiar la API pública de sensores. Consulte el [registro, verificador y procedimiento de reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#background-and-reentry-audit-2026-10-29).

<Clip name="sensor-lifecycle-ios" caption="Simulador iOS 26.2, demo en inglés: inicio y retorno reales, pausa explícita y tres entradas en la pantalla con reproducción nativa de entradas de sensores identificadas como simuladas. Tiempo original. Core Motion no está disponible en el simulador; evidencia del ciclo de vida, no del rendimiento físico." />
<Clip name="sensor-lifecycle-android" caption="Emulador Android 16 / API 36, demo en inglés: inicio y retorno reales y navegación repetida. El primer ciclo comprueba las suscripciones a sensores emulados; los ciclos de movimiento usan entradas identificadas como simuladas. Tiempo original; sin afirmar precisión o rendimiento en dispositivos físicos." />

## Intervalos de muestreo en el dispositivo físico {#physical-sampling-intervals}

Una segunda auditoría en el iPhone físico verifica doce ventanas: `auto`, 16/33/100 ms, fuentes con distintas frecuencias solicitadas, eliminación de enlaces individuales y del consumidor más rápido, reconexión y liberación de recursos. La adquisición compartida baja de unas 66 a 10 muestras/s al retirar el consumidor rápido y se detiene al eliminar el último enlace. Todas las ventanas medidas tienen cero callbacks JavaScript. Consulte las [tasas capturadas y el procedimiento de reproducción](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#physical-sampling-intervals-2026-10-29). Son comprobaciones breves de corrección en un dispositivo; los commits nativos no equivalen a FPS presentados.

<Clip name="sensor-intervals-physical-ios" caption="iPhone 17 Pro físico, iOS 27.2, demo Release con diagnóstico en inglés: doce ventanas reales de muestreo de Core Motion, adquisición compartida, eliminación de enlaces y liberación de recursos. Captura USB con tiempo original; sin entradas simuladas ni necesidad de inclinar el dispositivo. Los contadores muestran muestreo y commits nativos, no FPS presentados." />

## Conectar una fuente {#connect-a-source}

```ts
import { bind, motionScope, springValue } from '@rafaelaugusto/jolt'
import { sensor } from '@rafaelaugusto/jolt/sensors'

const scope = motionScope()
const rotation = sensor('rotation', { scope })
const gravity = sensor('gravity', { scope, interval: 'auto' })
const tilt = scope.add(springValue(rotation.y, { stiffness: 155, damping: 23 }))

// use() recreates bindings after suspension; add(cleanup) would remove them permanently.
scope.use(() => bind(card, { rotateY: tilt.to([-0.6, 0.6], [-20, 20]) }))
scope.use(() => bind(highlight, { x: tilt.to([-0.6, 0.6], [-90, 90]) }))
scope.use(() => bind(background, { x: gravity.x.to([-6, 6], [-35, 35]) }))

// Optional explicit actions:
rotation.recenter()
scope.suspend()
scope.resume()
// When the screen is permanently released:
scope.dispose()
```

Las fuentes permanecen inactivas hasta que un enlace de vista cargado o una suscripción JS explícita las necesite. La demanda se propaga a través de cadenas de resortes nativas; pausar al último seguidor, descargar la última vista vinculada o eliminar su vinculación detiene la suscripción de hardware. Mantenga la fuente en un alcance y deséchela cuando haya terminado. `get()` y `snapshot()` leen el último valor sin iniciar el muestreo.

## Valores y coordenadas {#values-and-coordinates}

| Fuente                | Valores            | Contrato                                                                                                                                                                            |
| --------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rotation`            | `x`, `y`, `z`      | Ángulos de Euler XYZ extrínsecos relativos, radianes; ZYX equivalentemente intrínseco. La identidad es la primera lectura válida. Asigne radianes a los grados de rotación de Jolt. |
| `rotation.quaternion` | `x`, `y`, `z`, `w` | Cuaternión de Hamilton normalizado, con continuidad de signo entre muestras. En relación con la postura inicial del dispositivo, no con el norte magnético.                         |
| `gravity`             | `x`, `y`, `z`      | Aceleración gravitacional hacia abajo en m/s². Un teléfono plano boca arriba tiene z aproximadamente −9,80665. Esto no es aceleración total ni aceleración lineal.                  |

El `coordinates: 'interface'` predeterminado usa x hacia la derecha, y hacia arriba y z fuera de la pantalla visible. El código nativo reasigna los ejes después de la rotación de la pantalla. `'device'` mantiene los ejes hardware del dispositivo, independientemente de la orientación de la interfaz; en Android, siguen la orientación natural del dispositivo, incluidas las tabletas nativas en formato horizontal. La base de rotación se transforma junto con los ejes, por lo que cambiar la orientación de la interfaz no convierte una pose de identidad en una rotación artificial de 90°.

La rotación utiliza una referencia arbitraria y no magnética: Core Motion de `XArbitraryZVertical` en iOS y `TYPE_GAME_ROTATION_VECTOR` en Android. La guiñada puede desviarse. `recenter()` hace que la siguiente pose válida sea la identidad. Reanudar la rotación relativa del reanclaje para preservar su postura anterior; la gravedad reanuda la medición real. Utilice `springValue()` para cambios de gravedad suaves. Los ángulos de Euler tienen límites de envoltura y bloqueo de cardán: use rangos de inclinación modestos para vinculaciones escalares. La interpolación 3D completa necesita una interpolación con reconocimiento de cuaterniones; Hacer surgir de forma independiente cuatro componentes de cuaterniones no es un problema.

## Muestreo y propiedad {#sampling-and-ownership}

`interval` acepta `'auto'` (el intervalo informado de la pantalla) o de 5 a 1000 milisegundos. La solicitud respeta los límites del hardware y no promete una cadencia exacta. iOS comparte una suscripción Core Motion; Android comparte un oyente nativo por tipo de sensor disponible. Los consumidores compatibles utilizan el intervalo solicitado más rápido, y cada fuente fusiona lecturas en su propio intervalo y marcos de visualización. Varios enlaces utilizan los mismos valores retenidos.

La puesta en segundo plano de la aplicación detiene la recopilación de hardware de forma nativa y a través de los enlaces del ciclo de vida de Jolt. `pause()` retiene valores y detiene la recopilación para esa fuente; `play()` reanuda y vuelve a intentar una suscripción fallida. `dispose()` es idempotente, desconecta enlaces, elimina valores nativos y libera suscripciones. Otra fuente activa puede mantener en funcionamiento el hardware compartido.

Reducir los valores predeterminados de movimiento a `reducedMotion: 'pause'`: la recolección del sensor decorativo se detiene y la pose actual permanece quieta. Una aplicación que necesita lecturas para una función no decorativa puede seleccionar explícitamente `'continue'`. La demostración **Mover la luz** utiliza el valor predeterminado y ofrece controles de pausa, centrado y reducción de movimiento en inglés, portugués, español y chino simplificado.

## Disponibilidad y configuración {#availability-and-configuration}

En iOS, agregue un `NSMotionUsageDescription` significativo al Info.plist de la aplicación. Una descripción faltante produce `error: 'missing-motion-usage-description'` antes de iniciar Core Motion. En Android, esta implementación limita las solicitudes a 200 Hz y no requiere permiso de alta frecuencia de muestreo. No existe un retroceso basado en un acelerómetro que se haga pasar por un sensor de gravedad o de rotación.

`available` informa si existe la fuente de hardware necesaria. `status` distingue a `idle`, `starting`, `active`, `paused`, `unavailable`, `error`, `replaying` y `disposed`. `snapshot().error` informa fallas de acceso/inicio o `no-data` si no llega ninguna medición válida durante tres segundos (o tres intervalos solicitados). Se ignoran los valores no válidos y las marcas de tiempo de hardware fuera de servicio. El hardware faltante mantiene un respaldo estático de cero/identidad. La aplicación puede ofrecer un diseño estático normal sin una acción dependiente del movimiento.

`onStatus` es opcional y se ejecuta solo en los límites estatales. `snapshot()` devuelve los últimos valores, la marca de tiempo del hardware en milisegundos monótonos desde el inicio, el recuento de muestras recibidas, el recuento de fotogramas comprometidos, el recuento de devoluciones de llamadas nativas y los milisegundos de procesamiento de confirmación acumulados. Es una lectura de diagnóstico explícita, no una suscripción ni una medición del rendimiento de un extremo a otro. El uso de `.subscribe()` opta explícitamente por la observación JS en el reloj del cuadro; El `bind()` ordinario no necesita una llamada JS por lectura.

## Vista previa reproducible y validación restante {#reproducible-preview-and-remaining-validation}

El botón **Vista previa del movimiento** de la demostración usa `replaySensor()` de `@rafaelaugusto/jolt/testing`. Una secuencia finita de muestras canónicas de cuaterniones/gravedad se pasa al código nativo una vez; La colección de hardware se separa para la reproducción, y las mismas matemáticas, fusión, gráfico de valores y resortes la representan. La pantalla etiqueta la entrada como simulada. Esta es una instalación de prueba, no una disponibilidad de hardware falsa.

La ruta nativa aún necesita el hilo de la interfaz de usuario de la plataforma. Una tarea JavaScript sincrónica en ese subproceso puede detener las actualizaciones de visualización; evitar llamadas JS por muestra no hace que la interfaz de usuario sea inmune al bloqueo.

La auditoría en un iPhone 17 Pro físico confirma adquisición real de Core Motion, suscripciones compartidas, pausa/reducción de movimiento, retorno del segundo plano y liberación de recursos en tres instancias de pantalla. Las ventanas medidas de adquisición nativa no tuvieron callbacks JavaScript. Consulte el [registro físico y sus límites](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md#physical-iphone-audit-2026-10-29). La #114 sigue abierta para evidencia en Android físico, calibración de ejes y orientaciones, fallos de acceso y recuperación y medición de CPU y presentación. Acelerómetro con gravedad, aceleración lineal, giroscopio y campo magnético siguen aplazados explícitamente.

Contratos de plataforma: [Movimiento del dispositivo Apple](https://developer.apple.com/documentation/coremotion/getting-processed-device-motion-data), [Sensores de movimiento Android](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion) y [Coordenadas y límites del sensor Android](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview).
