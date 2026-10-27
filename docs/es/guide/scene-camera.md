# Campo de visión de SceneKit {#scenekit-camera-field-of-view}

`sceneKitFieldOfView(camera)` anima el ángulo de visión de una cámara en perspectiva mientras su posición permanece fija. Vincúlelo al mismo valor de movimiento que la pintura, la iluminación o la pose de la cámara para coordinar una escena sin un bucle de fotograma de la aplicación. Este adaptador es **iOS-solo**, a través del complemento opcional `@rafaelaugusto/jolt-native`.

<Clip name="scene-camera-ios" caption="Simulador de iPhone 17, iOS 26: reproducción real de SceneKit y taps de XCTest. Una cámara fija hace un zoom de 70° a 32° mientras la pintura y la luz cambian; pausa/reanudación, inversión, reemplazo de fuente, búsqueda de elementos hijos y recreación de escenas. En tiempo real, en el hilo principal; metraje del simulador." />

Disponible desde **0.1.0-beta.15**. Instale versiones principales/nativas coincidentes y reconstruya la aplicación nativa:

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.1 @rafaelaugusto/jolt-native@0.1.0-rc.1
```

El mínimo de plataforma sigue siendo NativeScript 8.9 y iOS 13; La validación nativa utilizó Core 9.1.3, runtime 9.1.0 y un simulador iOS 26.

## Un ángulo de cámara en grados {#a-camera-angle-in-degrees}

```ts
import { sceneKitFieldOfView } from '@rafaelaugusto/jolt/native'

const fov = sceneKitFieldOfView(cameraNode.camera!) // SCNCamera, not SCNNode
const zoom = fov.animate(32, 'smooth')
zoom.pause()
zoom.progress = 0.5
zoom.play()

fov.get() // current native model angle in degrees
fov.set(70) // stops the current Jolt owner and applies immediately
// Before destroying the scene:
fov.dispose()
```

El rango admitido es **1–179 grados, inclusive**. Este es el rango de perspectiva conservador de Jolt, evitando proyecciones degeneradas cercanas a cero/180°. Los ángulos iniciales, los destinos explícitos y cada muestra vinculante deben ser finitos y estar dentro de un rango. Las entradas no válidas fallan antes de reemplazar a un propietario que trabaja. Los resortes sujetan el exceso en ese rango; Las asignaciones personalizadas deben producir ángulos válidos por sí mismos. La interpolación entre interpolaciones es lineal en grados antes de aplicar la flexibilización elegida, no lineal en ampliación.

El `projectionDirection` del objetivo selecciona el ángulo vertical u horizontal; Jolt lo conserva. SceneKit deriva el otro eje de la relación de aspecto de la ventana gráfica. Por lo tanto, cambiar el tamaño de la ventana gráfica cambia el ángulo de visión complementario, no el valor vinculado. Hacer zoom de esta manera cambia la perspectiva; Mover la cámara con `sceneKitPose(cameraNode)` es una operación separada.

Solo se admite **proyección automática en perspectiva**. Las cámaras ortográficas utilizan `orthographicScale` y una `projectionTransform` personalizada posee su propia proyección. La fábrica rechaza ambas configuraciones sin modificarlas. Si alguno de ellos se instala durante la reproducción, el reproductor nativo se detiene y deja intacta la configuración de propiedad de la aplicación. Libere cualquier enlace de origen y deseche el envoltorio antes de configurar/reemplazar la cámara. Recree un enlace después de restaurar una cámara de perspectiva automática compatible.

El receptor compilado verifica los resultados de la proyección pública en dos relaciones de aspecto de ventana gráfica. No lee indicadores de cámaras privadas ni sobrescribe una matriz personalizada para probar si el FOV funciona. Una matriz personalizada fija se rechaza incluso cuando coincide numéricamente con la proyección de una ventana gráfica estándar.

## Movimiento y reproducción compartidos {#shared-motion-and-playback}

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
import { sceneKitFieldOfView, sceneKitLightIntensity } from '@rafaelaugusto/jolt/native'

const progress = motionValue(0)
const scope = motionScope()
const fov = sceneKitFieldOfView(cameraNode.camera!)
const light = sceneKitLightIntensity(keyLight)

scope.use(() => fov.bind(progress, (p) => 70 - p * 38))
scope.use(() => light.bind(progress, (p) => 550 + p * 350))
scope.add(animate(progress, 1, { duration: 2000, ease: 'sineInOut' }))

scope.suspend() // holds the source and releases its bindings
scope.resume() // reattaches bindings and resumes previously running work

// Before destroying camera/light targets:
scope.dispose()
fov.dispose()
light.dispose()
```

Los valores derivados numéricos y `playbackProgress(animation)` funcionan con el mismo contrato `bind()`. Las funciones de mapeo se ejecutan mientras se preparan/reconstruyen muestras, así que manténgalas puras. Los comandos fuente y los eventos de gestos aún ingresan a JS; La interpolación/escritura nativa autónoma no solicita marcos de observación JS. NativeScript JS y estas escrituras de SceneKit comparten el hilo principal, por lo que JS ocupado puede detener las actualizaciones de la cámara.

Utilice `timeline()` para coordinar controles de reproducción de cámara, luz y material separados. Admite pausa/reanudación/parada conjuntas; Busque manijas finitas individuales donde se admitan. La demostración mantiene deliberadamente fija la posición de la cámara para que el cambio de tamaño visible provenga del FOV y vincula la pintura a la misma fuente mientras un segundo participante de la línea de tiempo controla la iluminación.

## Propiedad e interrupción de la lente {#lens-ownership-and-interruption}

SceneKit combina `fieldOfView`, `focalLength` y `sensorHeight`: una escritura de FOV recalcula la distancia focal, y cambiar cualquiera de las propiedades de la lente puede recalcular el FOV. Esos efectos secundarios son parte del modelo de cámara de SceneKit, documentado por Apple en [fieldOfView](https://developer.apple.com/documentation/scenekit/scncamera/fieldofview) y [projectionDirection](https://developer.apple.com/documentation/scenekit/scncamera/projectiondirection).

Detenga/libere la animación FOV o el enlace antes de que una aplicación cambie la distancia focal, la altura del sensor, la dirección de proyección o el modo de proyección. Establezca la configuración de cámara deseada y luego regrese el control manual. La animación de aplicaciones independientes de estas propiedades acopladas compite con Jolt; Los cambios válidos de lentes externos no se tratan automáticamente como un nuevo propietario y pueden sobrescribirse con la siguiente muestra de FOV. Jolt no cambia los planos cercano/lejano, la distancia de enfoque, la profundidad de campo ni la pose de la cámara.

Un `SCNCamera` independiente no tiene captador de presentación pública. `get()` y la interrupción leen el **ángulo del modelo actual**, que es la última escritura inmediata de Jolt durante la reproducción propiedad de Jolt y puede retrasar la presentación renderizada en un fotograma. Las escrituras utilizan una transacción SceneKit con acciones implícitas deshabilitadas, incluso dentro de una transacción animada externa. Jolt no recupera el campo de visión intermedio mostrado de una animación SceneKit propiedad de la aplicación: elimine las animaciones competidoras y establezca primero el valor de transferencia.

Los envoltorios para la misma cámara FOV comparten la propiedad, incluso cuando varios nodos hacen referencia a esa cámara. Desechar un envoltorio viejo no detiene la animación del nuevo propietario. Los adaptadores de postura, luz y material mantienen sus propiedades independientes. Los objetivos de sumideros nativos son débiles; Los envoltorios JS conservan la identidad de la cámara hasta `dispose()`, por lo tanto, libérelos explícitamente antes de la destrucción de la escena.

## Ciclo de vida y movimiento reducido {#lifecycle-and-reduced-motion}

El campo de visión es **movimiento espacial**. En movimiento reducido, las nuevas animaciones directas se establecen inmediatamente y los enlaces utilizan el destino de la pista de origen al preparar una nueva pista activa. Cambiar la preferencia no reconstruye retroactivamente cada animación nativa enviada. Para reaccionar inmediatamente, deténgase y aplique el ángulo deseado o inicie el comando de fuente de reemplazo después de actualizar la preferencia. Pausar una fuente mantiene su valor actual. Los adaptadores de iluminación y color conservan su política no espacial.

Las pistas siguen la `timeScale` de Jolt cuando están preparadas. Los adaptadores de propiedades sin formato no instalan una política automática en segundo plano: su reloj de pared puede avanzar mientras la entrega del enlace de visualización está suspendida. Para una escena retenida, suspenda el alcance en `Application.suspendEvent` y reanude intencionalmente. Un controlador pausado manualmente permanece en pausa. Mantener los envoltorios de propiedad fuera del alcance que debe sobrevivir a la suspensión; Utilice el alcance para mangos y fábricas de encuadernación, como se indica arriba.

Reemplace la suscripción por cuadro de una aplicación con un enlace nativo:

```ts
// Remove the old subscription that assigned camera.fieldOfView on each callback.
const fov = sceneKitFieldOfView(camera)
const release = fov.bind(progress, (p) => 70 - p * 38)
// At teardown:
release()
fov.dispose()
```

El [informe de validación nativo](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-camera.md) cubre geometría proyectada, cambios de ventana gráfica, acoplamiento de lentes, interrupción, proyecciones no admitidas, alcances y contención del hilo principal. La animación a escala ortográfica, los controles de lentes arbitrarios y la integración del renderizador 3D Android son trabajos separados.
