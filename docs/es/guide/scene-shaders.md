# Entorno y shaders de SceneKit {#scenekit-environment-and-shader-inputs}

`sceneKitEnvironmentIntensity(scene)` anima la iluminación ambiental. `sceneKitUniform(target, name, options)` anima una entrada escalar o vectorial declarada del modificador de sombreado SceneKit de una aplicación. Ambos son adaptadores iOS opcionales de `@rafaelaugusto/jolt/native`.

Disponible desde **0.1.0-beta.17**. Instale `@rafaelaugusto/jolt@0.1.0-rc.2` y `@rafaelaugusto/jolt-native@0.1.0-rc.2` correspondientes y luego reconstruya la aplicación nativa. La actualización de JavaScript por sí sola no puede instalar los receptores compilados.

La línea base del asistente nativo es iOS 13+ con NativeScript 8.9+; La aplicación/tiempo de ejecución elegido puede requerir versiones más nuevas. Android SceneKit no se proporciona renderizado.

<Clip name="scene-shaders-ios" caption="El XCTest real aprovecha un simulador iOS: la iluminación ambiental, una combinación de cabina y un vector de sombreado siguen una fuente, con pausa/reanudación, búsqueda, reemplazo de imágenes y recreación de escenas. El tiempo de reproducción no cambia. Esta no es una prueba de rendimiento del dispositivo físico." />

## Intensidad del ambiente {#environment-intensity}

```ts
import { sceneKitEnvironmentIntensity } from '@rafaelaugusto/jolt/native'

const environment = sceneKitEnvironmentIntensity(scene)
environment.animate(0.45, { duration: 1200 })
// Later, before destroying the scene:
environment.dispose()
```

El objetivo es un `SCNScene`. Los valores son multiplicadores de iluminación finitos y no negativos; El sobreimpulso negativo del resorte se fija en cero. Este adaptador no cambia `lightingEnvironment.contents`, `background`, luces, exposición o mapeo de tonos. Reemplazar o eliminar la imagen del entorno deja intacta la propiedad de la intensidad. Sin una imagen de entorno, es posible que cambiar el multiplicador no tenga ningún efecto visible.

Apple describe la intensidad genérica de propiedad material como 0–1. SceneKit acepta multiplicadores de entorno superiores a uno, y la sonda nativa verifica 0, 0,45, 1,6 y 4 con mediciones de luminancia de imagen. Estas no son unidades de luz calibradas ni una garantía sobre rangos HDR arbitrarios. Ver [Referencia de intensidad de Apple](https://developer.apple.com/documentation/scenekit/scnmaterialproperty/intensity).

## Entradas de sombreado escritas {#typed-shader-inputs}

La aplicación posee el sombreador e inicializa sus valores antes de crear adaptadores:

```ts
material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
  `#pragma arguments
float cabinView;
#pragma body
_output.color.rgb = mix(_output.color.rgb, float3(0.03, 0.04, 0.05), cabinView);`,
  SCNShaderModifierEntryPointFragment,
)
material.setValueForKey(0, 'cabinView') // Setup only

const cabin = sceneKitUniform(material, 'cabinView', {
  type: 'float',
  range: [0, 1],
  units: ['blend fraction'],
  motion: 'appearance',
})
cabin.animate(1, 'smooth')
```

Los objetivos admitidos son `SCNMaterial` y `SCNGeometry`, utilizando declaraciones de metal literales en `#pragma arguments`.

| Tipo de sombreador | Valor Jolt     | Valor inicial de SceneKit       |
| ------------------ | -------------- | ------------------------------- |
| `float`            | número         | NSNumber / valor KVC numérico   |
| `float2`           | `[x, y]`       | NSValue que contiene CGPoint    |
| `float3`           | `[x, y, z]`    | NSValue que contiene SCNVector3 |
| `float4`           | `[x, y, z, w]` | NSValue que contiene SCNVector4 |

Declare un `range` ordenado finito, una cadena `units` por componente y una política `motion`. La gama se aplica a todos los componentes; El exceso de resorte muestreado se sujeta en sus límites. Los vectores se escriben como un valor nativo encuadrado. La lectura de punto flotante tiene la precisión flotante de la plataforma.

Un vector es **no es automáticamente un color**. No hay conversión sRGB, premultiplicación o significado alfa implícito. Si su sombreador espera RGB o RGBA lineal, inicialice y asigne esos componentes en ese espacio usted mismo. Los adaptadores de color de material existentes tienen un contrato de color diferente.

Los nombres deben ser identificadores personalizados, sin rutas KVC ni los prefijos reservados `u_`, `a_`, `v_` y `scn_` de SceneKit. El programa de instalación verifica la declaración literal, el tipo de componente y el valor nativo inicializado. No se admiten nombres no declarados, matrices, muestreadores, estructuras, esquemas condicionales/definidos por macros ni buffers `SCNProgram` personalizados. Esta verificación de declaración limitada no es un compilador Metal: la aplicación sigue siendo responsable del código de sombreado válido y de utilizar realmente su entrada. Ver [Contrato de modificador de sombreado de Apple](https://developer.apple.com/documentation/scenekit/scnshadable).

## Una fuente, reproducción nativa {#one-source-native-playback}

```ts
import { animate, motionScope, motionValue } from '@rafaelaugusto/jolt'
import { sceneKitEnvironmentIntensity, sceneKitUniform } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const inside = motionValue(0)
const environment = sceneKitEnvironmentIntensity(scene)
const cabin = sceneKitUniform(material, 'cabinView', {
  type: 'float',
  range: [0, 1],
  units: ['blend fraction'],
  motion: 'appearance',
})
const clamp = (p: number) => Math.max(0, Math.min(1, p))
scope.use(() => environment.bind(inside, (p) => 1.6 - 1.15 * clamp(p)))
scope.use(() => cabin.bind(inside, clamp))
const run = scope.add(animate(inside, 1, { duration: 1800 }))
run.pause()
run.progress = 0.5
run.play()
// Teardown:
scope.dispose()
cabin.dispose()
environment.dispose()
```

Esto reemplaza un bucle de aplicación `inside.subscribe(...)` que asigna la intensidad del entorno y el valor del sombreador en JavaScript. El consumidor del automóvil inspeccionado utiliza un modificador escalar `cabinView`; su emisión/transparencia del flujo de aire ya utiliza otros adaptadores. El ejemplo mezcla intencionalmente la cabina de forma continua. El cambio de umbral del automóvil original es una opción visual diferente: las asignaciones de muestra se pueden interpolar a través de un umbral, por lo que no son devoluciones de llamadas de eventos discretas exactas.

Los valores de movimiento normal, las derivaciones numéricas y `playbackProgress()` utilizan el puente de reproducción de propiedad externa existente. JavaScript muestra asignaciones en los límites de configuración y reproducción; el reproductor Objective-C compilado realiza escrituras de fotogramas en el hilo principal. La ejecución nativa no implica aislamiento del subproceso de procesamiento ni inmunidad a la contención del subproceso principal.

El `springValue()` retenido y las salidas de gestos nativos no se pueden muestrear como pistas fijas de propiedad externa. Se rechaza explícitamente vincular dichas fuentes; no hay ningún respaldo de suscripción oculto a JavaScript. Un puente de fuente nativa en vivo es una capacidad separada.

## Propiedad, lecturas y ciclo de vida {#ownership-reads-and-lifecycle}

Ambos adaptadores proporcionan `get`, `set`, `animate`, `bind`, `stop` y `dispose`. La reproducción admite pausa/reanudación/búsqueda, escala de tiempo y limpieza de alcance. Las lecturas utilizan los valores del modelo actual porque estos objetivos no tienen un captador de presentación pública. Las escrituras nativas desactivan las acciones implícitas de SceneKit. Elimine las animaciones de SceneKit que compitan antes de transferir la propiedad a Jolt.

La propiedad es por objetivo nativo y propiedad/nombre uniforme. Diferentes uniformes se animan de forma independiente; envoltorios del mismo uniforme interrumpen al dueño anterior. La eliminación de un envoltorio antiguo no puede anular la sustitución. Los materiales compartidos también comparten sus uniformes.

Cambiar la fuente del sombreador o asignar un programa invalida el adaptador y cancela su reproducción. Deséchelo y cree un nuevo adaptador después de inicializar el sombreador de reemplazo. La comparación de diccionarios fuente no puede detectar la asignación de una fuente idéntica o una reconstrucción del compilador con una fuente sin cambios; Vuelva a crear adaptadores explícitamente cuando su aplicación necesite ese límite. Los sumideros nativos mantienen objetivos débiles y la eliminación explícita libera propiedad/recursos.

La intensidad del entorno no es espacial y conserva la sincronización bajo movimiento reducido. Cada uniforme declara `motion: 'appearance'` (conserva el tiempo) o `'spatial'` (se asienta inmediatamente bajo Movimiento Reducido). Jolt no puede inferir el efecto visual de un sombreador arbitrario a partir de su nombre. Utilice la suspensión/reanudación del alcance para el fondo y deséchelo antes de destruir la escena. El informe de validación nativo separa el comportamiento real del simulador de las afirmaciones de rendimiento del dispositivo físico.
