# Iluminación de SceneKit {#scenekit-lights-and-materials}

Anima la intensidad/color de la luz, la transparencia del material y los colores sólidos difusos/de emisión a través del [contrato de propiedad nativa](./native-properties) existente. Estos adaptadores son **iOS-solo** y requieren el complemento opcional `@rafaelaugusto/jolt-native` más una reconstrucción nativa. No agregan un renderizador 3D Android, combinación de texturas ni compatibilidad con sombreadores uniformes.

Disponible desde **0.1.0-beta.14**. Instale las versiones de tiempo de ejecución nativas principales y opcionales coincidentes y luego reconstruya la aplicación iOS:

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.1 @rafaelaugusto/jolt-native@0.1.0-rc.1
```

<Clip name="scene-lighting-ios" caption="Simulador de iPhone 17, iOS 26: renderizado real de SceneKit y taps de XCTest. La cámara, la pintura, el vidrio y la iluminación comparten vínculos nativos; una capa de carga escalar agrega un pulso mientras la base continúa. Incluye pausa/reanudación, búsqueda de reproducción infantil y eliminación/recreación de escenas. Reproducción en tiempo real del hilo principal; sin reclamo de dispositivo físico." />

## Propiedades y unidades {#properties-and-units}

```ts
import {
  sceneKitLightIntensity,
  sceneKitLightColor,
  sceneKitMaterialTransparency,
  sceneKitMaterialDiffuse,
  sceneKitMaterialEmission,
} from '@rafaelaugusto/jolt/native'

const brightness = sceneKitLightIntensity(light) // SCNLight
const tint = sceneKitLightColor(light)
const opacity = sceneKitMaterialTransparency(material) // SCNMaterial
const paint = sceneKitMaterialDiffuse(material)
const glow = sceneKitMaterialEmission(material)

brightness.animate(1800, { duration: 800, ease: 'sineInOut' })
paint.animate('#14b8a6', 'smooth')
opacity.set(0.6)
```

| Adaptador                                | Propiedad de destino            | Valores aceptados                                                                                                             |
| ---------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `sceneKitLightIntensity(light)`          | `SCNLight.intensity`            | Números finitos ≥ 0. Lúmenes con iluminación de base física; en caso contrario intensidad/1000 multiplica el color de la luz. |
| `sceneKitLightColor(light)`              | `SCNLight.color`                | Cadena de colores NativeScript o `Color`.                                                                                     |
| `sceneKitMaterialTransparency(material)` | `SCNMaterial.transparency`      | Números finitos en 0–1; 1 es el multiplicador opaco predeterminado.                                                           |
| `sceneKitMaterialDiffuse(material)`      | `SCNMaterial.diffuse.contents`  | Solo color sólido: cadena o `Color`.                                                                                          |
| `sceneKitMaterialEmission(material)`     | `SCNMaterial.emission.contents` | Solo color sólido: cadena o `Color`.                                                                                          |

Los objetivos nativos deben ser `SCNLight` o `SCNMaterial` respectivamente. El contenido de color existente debe ser un `UIColor` o `CGColor` sólido convertible. Los colores de escala de grises y pantalla P3 se convierten a sRGB; Los colores dinámicos UIKit se resuelven con la colección de rasgos actual cuando se leen. Los patrones, imágenes, texturas, rutas/URL de archivos, capas, números y `nil` se rechazan antes de cambiar de propiedad. El adaptador nunca reemplaza silenciosamente una textura con un color. Si la aplicación luego asigna contenidos no compatibles, la reproducción nativa se detiene y deja esos contenidos intactos; Se necesita una nueva encuadernación después de restaurar un color sólido.

El color `get()` devuelve un NativeScript `Color`, normalizado a sRGB/alfa de 8 bits. Las muestras de animación reutilizan el [interpolación OKLab premultiplicada](./colors) de Jolt, recortado a la gama sRGB. El sumidero nativo recibe vectores RGBA sRGB premultiplicados normalizados (RGB en 0–alfa, alfa en 0–1); interpola entre vectores muestreados, los despremultiplica y asigna un `UIColor` completo. Esto preserva los puntos finales transparentes sin devoluciones de llamadas de configuradores separadas por canal. Las lecturas nativas se redondean en el límite de color público, por lo que la precisión de la interrupción es un componente de 8 bits. No se conserva la salida HDR/de gama amplia más allá de sRGB. El exceso de resorte está limitado para rangos numéricos y de color; las asignaciones vinculantes deben devolver valores válidos.

El alfa se conserva en el valor del color; Las reglas materiales y de iluminación de SceneKit deciden su contribución visual. Utilice la intensidad de la luz para obtener brillo y la transparencia del material como multiplicador de opacidad. Estos adaptadores no cambian `transparent`, `transparencyMode`, `blendMode`, configuraciones de profundidad, metalidad, rugosidad o código de sombreado. Un color alfa de cero no es un reemplazo general para configurar la geometría transparente.

Con `physicallyBased`, `lambert`, `phong` o `blinn`, la apariencia difusa depende de la iluminación y otras propiedades del material; una superficie negra en una escena sin iluminación puede ocultar un cambio de color. `constant` muestra colores difusos independientemente de la iluminación directa. La emisión añade una apariencia independiente de la iluminación; **no ilumina los objetos cercanos**. `shadowOnly` y los sombreadores personalizados pueden ignorar la contribución normal de difusión/emisión. Utilice una luz real para la iluminación y configure la floración por separado si lo desea. Estas son las reglas de renderizado SceneKit, descritas en las referencias [intensidad](https://developer.apple.com/documentation/scenekit/scnlight/intensity), [emisión](https://developer.apple.com/documentation/scenekit/scnmaterial/emission) y [transparencia](https://developer.apple.com/documentation/scenekit/scnmaterial/transparency) de Apple.

## Valores compartidos y capas de carga. {#shared-values-and-charge-layers}

```ts
import { Color, Application } from '@nativescript/core'
import { animate, motionValue, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const charge = motionValue(0)
const brightness = sceneKitLightIntensity(light)
const glow = sceneKitMaterialEmission(material)

scope.use(() => brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600))
scope.use(() =>
  glow.bind(
    charge,
    (n) => new Color(255, 0, Math.round(Math.min(1, Math.max(0, n)) * 255), 180),
  ),
)
scope.add(animate(charge, 0.6, { duration: 10000, ease: 'linear' }))
scope.animate(charge, [0, 0.5, 0], {
  duration: 1100,
  ease: 'sineInOut',
  repeat: Infinity,
  layer: 'charge',
})
```

El pulso es una capa en un **valor de movimiento escalar**; la base continúa por debajo. Esto no agrega colores, materiales o poses de cuaterniones arbitrarios. Utilice `stop(charge, { layer: 'charge' })` para eliminar solo el pulso. Un valor derivado o `playbackProgress(animation)` también puede alimentar a `bind()`. La demostración utiliza las mismas fuentes para la pose de la cámara, la luz y los materiales sin sondeo ni un configurador JS por cuadro.

Las asignaciones se ejecutan mientras Jolt prepara muestras o reconstruye una pista fuente, así que manténgalas puras. La composición de capas escalares puede reconstruir ventanas de muestreo en JS; Los eventos de gesto/fuente también siguen siendo límites de JS. Las escrituras nativas se ejecutan en Objective-C compilado a través del reproductor nativo existente en el hilo principal. JS ocupado en ese hilo puede retrasarlos. Una devolución de llamada `subscribe(value => sceneKitSetter(value))` todavía se ejecuta en JS y no es un enlace nativo.

`animate()` devuelve el controlador de reproducción común: pausa/reproducción, búsqueda de progreso finito, parada y finalización. `timeline()` coordina estos controles para pausar/reanudar/detener; busque un identificador individual cuando sea compatible, ya que la línea de tiempo en sí no tiene un definidor de progreso. Los objetivos, colores, rangos numéricos y muestras mapeadas no válidos se verifican antes de reemplazar al propietario actual.

## Interrupción, propiedad y ciclo de vida {#interruption-ownership-and-lifecycle}

Dos nodos que hacen referencia al mismo `SCNMaterial` o `SCNLight` comparten su estado. Los contenedores para la misma instancia nativa y propiedad comparten la propiedad de interrupción. Las diferentes propiedades siguen siendo independientes; desechar un envoltorio viejo no puede detener el trabajo de un envoltorio más nuevo. Copie el material/luz en la aplicación si las instancias deben animarse de forma independiente.

`sceneKitPose` lee el nodo de presentación en caso de interrupción. Las luces y materiales independientes no tienen un captador de presentación público equivalente, por lo que estos adaptadores leen su **propiedad del modelo actual**. Jolt escribe con acciones implícitas de SceneKit deshabilitadas; durante la reproducción propiedad de Jolt, ese modelo es la última muestra escrita y la reorientación comienza allí, sin una segunda curva de relajación. Puede retrasar la presentación de la pantalla en un marco de renderizado. Jolt no puede recuperar el valor intermedio mostrado de una animación propiedad de una aplicación en una luz/material independiente. Elimine las animaciones/acciones/restricciones competidoras de SceneKit y confirme el valor de transferencia deseado antes de otorgar el control a Jolt. Detenga/libere Jolt antes de devolver la propiedad. La propiedad de SceneKit es exclusiva, no una combinación aditiva con animaciones del SDK.

Mangos jugables propios y fábricas de encuadernación en un ámbito de movimiento. Mantenga los contenedores de propiedades fuera del alcance que desea suspender: `scope.add(property)` adopta un recurso desechable, por lo que la suspensión lo elimina permanentemente. Deseche explícitamente los envoltorios en el límite de destrucción escena/objetivo:

```ts
const suspend = () => scope.suspend()
Application.on(Application.suspendEvent, suspend)
// On an intentional return to the scene:
scope.resume()

// Before removing/replacing the scene:
Application.off(Application.suspendEvent, suspend)
scope.dispose()
brightness.dispose()
glow.dispose()
```

La suspensión pausa los controles reproducibles, desconecta las ataduras y elimina los reproductores nativos. El reanudación explícito reinicia las fábricas vinculantes y reanuda los identificadores que se ejecutaban anteriormente; no reinicia un identificador pausado manualmente. La demostración se suspende en segundo plano y requiere un reanudación explícito. Los adaptadores sin formato no instalan su propia política de ciclo de vida de la aplicación: sin una pausa/detención del alcance, su reloj de pared avanza mientras el enlace de visualización está suspendido y el regreso puede ponerse al día o finalizar inmediatamente. No confíe en la ejecución en segundo plano para la representación nativa.

Los adaptadores de iluminación/color/transparencia no son espaciales y conservan su sincronización bajo movimiento reducido, incluida la sincronización de pulsos. `sceneKitPose` es espacial y salta a su destino cuando se habilita el movimiento reducido en la configuración/reconstrucción de la fuente. Para evitar el parpadeo decorativo, suprima el pulso de carga cuando su aplicación aplique movimiento reducido. Un cambio de política no reconstruye retroactivamente todas las animaciones independientes existentes. Ambos tipos siguen el `timeScale` de Jolt al crear pistas.

El tiempo de ejecución opcional utiliza objetivos nativos débiles; los contenedores conservan la identidad de destino hasta `dispose()`. Deseche antes de la destrucción, incluso para enlaces en pausa, y no confíe en GC. Las escrituras y lecturas compiladas utilizan el hilo principal; no llame a la API JS desde una devolución de llamada del renderizador en otra cola. Los mínimos siguen siendo NativeScript 8,9 y iOS 13; esta implementación se validó con NativeScript Core 9.1.3/runtime 9.1.0 y iOS 26. Reconstrucción con paquetes principales/nativos compatibles que contengan estos adaptadores; Los archivos binarios del complemento beta.13 más antiguos no los contienen.

## Migrando el bucle de fotograma de un modelo {#migrating-a-model-s-frame-loop}

Reemplazar sondeo o una suscripción por cuadro:

```ts
// Before: app-owned JS write on every observed frame.
const unsubscribe = charge.subscribe((n) => {
  light.intensity = 400 + n * 1600
})

// After: sample the mapping at setup/source boundaries, write natively.
const brightness = sceneKitLightIntensity(light)
const release = brightness.bind(charge, (n) => 400 + Math.max(0, n) * 1600)
// At destruction: release(); brightness.dispose()
```

Para una cámara, sigue usando `sceneKitPose(cameraNode)`. Elimine la suscripción/temporizador anterior al instalar el enlace. El [informe de validación](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scene-appearance.md) registra la conformidad nativa, la continuidad, la composición de capas, los contadores del ciclo de vida, las tolerancias de color y el límite de JS ocupado.
