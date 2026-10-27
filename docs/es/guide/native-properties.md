# Propiedades nativas {#external-native-properties}

Consulte [entradas de entorno y sombreador](./scene-shaders) para conocer la iluminación beta.17 y los adaptadores uniformes tipificados.

Animar una coordenada de mapa, una cámara SceneKit, un material claro o de color sólido sin escribir un bucle de fotograma JavaScript. La entrada opcional `@rafaelaugusto/jolt/native` proporciona un registro de propiedades, reproducción nativa compilada y adaptadores de referencia. La importación de la entrada principal JavaScript no inicializa este registro ni carga un SDK de mapas.

<Clip name="native-map-ios" caption="Anotación MapKit y cámara, pausadas y reanudadas juntas en un simulador iOS. Escrituras de propiedad nativa; reproducción en tiempo real." />
<Clip name="native-map-android" caption="Marcador y cámara MapLibre 11.8.0 en un emulador Android. El SDK de mapas es una dependencia de demostración; escrituras de propiedades nativas, reproducción en tiempo real." />
<Clip name="native-camera-ios" caption="Una cámara SceneKit real cambia de posición y orientación, se detiene y continúa en un simulador iOS. Este adaptador es solo para iOS." />

Consulte [SceneKit luces y materiales](./scene-lighting) para adaptadores escritos de intensidad, color, transparencia, difusión y emisión, incluida una demostración nativa y la migración desde un bucle de marco JS.

## Instalación opcional {#optional-installation}

Los adaptadores de registro, mapa y pose de cámara están disponibles desde Jolt **0.1.0-beta.13**. [SceneKit luces y materiales](./scene-lighting) requiere **0.1.0-beta.14** o más reciente. Utilice versiones de tiempo de ejecución nativas principales y opcionales coincidentes.

Instale `@rafaelaugusto/jolt-native` junto con Jolt y reconstruya la aplicación nativa. El registro JavaScript se encuentra en la entrada `/native`; Las fuentes compiladas y el enlace del marco MapKit/SceneKit se encuentran exclusivamente en este complemento opcional. Las aplicaciones que solo tienen el paquete principal no incluyen esos ayudantes. La creación de una propiedad sin el complemento informa un error explícito.

```sh
npm install @rafaelaugusto/jolt @rafaelaugusto/jolt-native
```

MapLibre sigue siendo una dependencia de la aplicación Android separada. La demostración utiliza un complemento de desarrollo local para fijar el SDK 11.8.0; `npm install` en `demo` instala ambos complementos locales.

## Usando un adaptador {#using-an-adapter}

```ts
import { timeline } from '@rafaelaugusto/jolt'
import { mapKitCoordinate, mapKitCamera } from '@rafaelaugusto/jolt/native'

const marker = mapKitCoordinate(annotation) // MKAnnotation with a writable coordinate
const camera = mapKitCamera(mapView) // MKMapView
const scene = timeline([
  {
    at: 0,
    run: () =>
      marker.animate(
        { latitude: 37.78, longitude: -122.415 },
        { duration: 4000, ease: 'linear' },
      ),
  },
  {
    at: 0,
    run: () =>
      camera.animate(
        {
          latitude: 37.78,
          longitude: -122.415,
          altitude: 1300,
          pitch: 45,
          heading: 50,
        },
        { duration: 4000, ease: 'sineInOut' },
      ),
  },
])
scene.pause()
scene.play()
// Before destroying/replacing the native targets:
scene.stop()
marker.dispose()
camera.dispose()
```

Cada propiedad tiene `get()`, `set(value)`, `animate(to, transition)`, `bind(value, map)`, `stop()` y `dispose()`. `animate()` devuelve un `PlaybackAnimation`, que incluye pausa, reproducción, progreso finito y finalización. Los envoltorios de un mismo objeto nativo y la propiedad registrada comparten la interrupción de la propiedad. Detener o desechar un envoltorio viejo no detiene el trabajo de un envoltorio más nuevo. La eliminación de un contenedor es terminal y debe realizarse antes de que se destruya su destino SDK.

```ts
const release = marker.bind(progress, (p) => ({
  latitude: 37.772 + p * 0.008,
  longitude: -122.423 + p * 0.008,
}))
// progress can be a motion value or playbackProgress(animation).
// map runs while sampling a track, not on every native frame.
release()
```

Los mapeos deben ser puros: no realizar efectos secundarios ni leer cambios de estado de la aplicación dentro de ellos. Jolt los muestrea durante los cambios de configuración y fuente, utilizando hasta 60 muestras por segundo (con un límite de 6000 intervalos uniformes, más fotogramas clave existentes). Los cambios en el código fuente reconstruyen su enlace nativo. Los eventos de gestos y las reconstrucciones de ventanas de composición conservan el [límites de ejecución del valor de movimiento](./motion-values); esto no convierte una entrada arbitraria de JavaScript en una fuente nativa.

## Objetivos y unidades soportados {#supported-targets-and-units}

| Adaptador            | Objetivo                              | Valor                                                         | Plataforma |
| -------------------- | ------------------------------------- | ------------------------------------------------------------- | ---------- |
| `mapKitCoordinate`   | `MKAnnotation` grabable               | `{ latitude, longitude }`, grados                             | iOS        |
| `mapKitCamera`       | `MKMapView`                           | Coordenada, `altitude` en metros, `pitch`/`heading` en grados | iOS        |
| `mapLibreCoordinate` | MapLibre `Marker`                     | `{ latitude, longitude }`, grados                             | Android    |
| `mapLibreCamera`     | MapLibre `MapLibreMap`                | Coordenada, nivel `zoom`, `tilt`/`bearing` en grados          | Android    |
| `sceneKitPose`       | `SCNNode`, incluido un nodo de cámara | `{ position: [x,y,z], orientation: [x,y,z,w] }`               | iOS        |

Para el zoom de la cámara en perspectiva, utilice [`sceneKitFieldOfView(camera)`](./scene-camera): un ángulo `SCNCamera` de 1 a 179 grados, con reproducción nativa y vinculación de valores de movimiento. Este adaptador requiere versiones centrales/nativas compatibles **0.1.0-beta.15** o más recientes y una reconstrucción nativa.

Los cinco [Adaptadores de apariencia SceneKit](./scene-lighting#properties-and-units) aceptan `SCNLight` o `SCNMaterial`: `sceneKitLightIntensity`, `sceneKitLightColor`, `sceneKitMaterialTransparency`, `sceneKitMaterialDiffuse` y `sceneKitMaterialEmission`. Todos son solo iOS.

El paquete principal conserva su mínimo NativeScript 8.9+; Las demostraciones de referencia se verifican con NativeScript 9.1 en iOS 26 y Android 16. MapLibre es opcional y debe agregarse a la aplicación por separado; los pines de demostración `org.maplibre.gl:android-sdk:11.8.0`. Esto no es un reclamo de soporte para cada versión o complemento de mapa. SceneKit no tiene adaptador Android. Una integración de renderizador Android compilada puede implementar el mismo contrato de propiedad.

Las coordenadas utilizan latitud lineal y interpolación de longitud más corta, incluido el cruce de ±180°. Esta es una aproximación de ruta local, no una velocidad geodésica o de avance constante. Los rumbos toman el ángulo más corto. La altitud de MapKit y el zoom de MapLibre son unidades diferentes. La inclinación de MapKit es de 0 a 80°, la inclinación de MapLibre de 0 a 60° y el zoom de 0 a 24; el SDK puede limitar aún más la cámara. MapLibre limita la latitud a su límite de proyección de Mercator. Las coordenadas compuestas y el estado de la cámara se escriben juntos.

Las poses de escena utilizan la interpolación de ruta más corta del cuaternión unitario y la normalización nativa entre fotogramas clave muestreados. La posición utiliza unidades de escena. El adaptador lee el [nodo de presentación](https://developer.apple.com/documentation/scenekit/scnnode/presentation) cuando se interrumpe y escribe con acciones implícitas deshabilitadas. Elimine las restricciones/acciones competitivas de SceneKit de las propiedades que posee Jolt. MapKit usa [`setCamera(..., animated: false)`](<https://developer.apple.com/documentation/mapkit/mkmapview/setcamera(_:animated:)>) y MapLibre usa una actualización inmediata de la cámara, evitando una segunda curva de flexibilización del SDK. Detenga la propiedad al devolver el control al gesto del mapa de un usuario u otro controlador de renderizado.

## Registrar una propiedad {#registering-a-property}

```ts
const reveal = registerNativeProperty<number>({
  name: 'acme.chart/reveal',
  units: ['fraction'],
  platforms: ['ios', 'android'],
  encode: (n) => [n],
  decode: (components) => components[0],
  create: (chart) => createCompiledChartSink(chart),
})
const amount = reveal(nativeChart)
amount.animate(1, 'snappy')
```

`createCompiledChartSink` lo proporciona el complemento. Implemente `JoltPropertySink` en Objective-C/Swift o `org.rafaelaugusto.jolt.PropertySink` en Java/Kotlin. Su `read()`/`write()` nativo utiliza vectores numéricos finitos que coinciden con `units`; el sumidero posee un objetivo débil e informa si está vivo. Implementar escritura compuesta de forma atómica. Las fábricas escalares incluidas admiten una ruta de clave numérica Objective-C o un captador/definidor de JavaBean flotante/doble. El registro rechaza nombres duplicados, plataformas no compatibles, vectores no válidos e implementaciones de receptores generados por JavaScript. Las funciones personalizadas `validate` y `interpolate` se ejecutan mientras se preparan muestras.

El reproductor proporcionado escribe en el hilo principal/UI nativo. Un renderizador que requiera una cola diferente debe agruparse de forma segura en su receptor compilado y definir cómo se sincronizan las lecturas de la presentación; no debe enviar un configurador JavaScript por cuadro. Esta API no ofrece ningún respaldo implícito para JavaScript. Las fuentes de ayuda nativas se empaquetan por separado en `@rafaelaugusto/jolt-native`; Las dependencias del SDK de la aplicación siguen siendo opcionales.

Los adaptadores espaciales declaran `spatial: true` y saltan al destino en movimiento reducido. Las propiedades escalares genéricas conservan la sincronización. No se admiten capas de adaptadores adicionales; vincular un [valor de movimiento escalar en capas](./motion-values#layers-on-a-value) cuando sea apropiado. Una pose de cuaternión no adquiere semántica aditiva escalar.

## Validación y limpieza {#validation-and-cleanup}

El **Ejecutar comprobaciones nativas** de la demostración nativa ejecuta el dispositivo de vista personalizada `reveal` compilado a través de interpolación, resorte, pausa/búsqueda/reanudación, enlaces de valor compartido, capas, observación de progreso, programación de línea de tiempo, interrupción y eliminación en ambas plataformas. Comprueba el recuento de jugadores nativos y verifica que los enlaces nativos no soliciten marcos de observación JavaScript. Las pruebas unitarias cubren la validación de registros, muestreo de compuestos, ángulos y comportamiento de cuaterniones. Los autores de complementos deben ejecutar los mismos escenarios en su propio receptor y SDK, incluida la destrucción del SDK y el fondo/primer plano de la aplicación.

Utilice `scope.add(property.animate(...))` y `scope.use(() => property.bind(...))` para propiedad. Disponer la propiedad en el límite de destrucción real del objetivo. Las devoluciones de llamada de escena entregadas por `subscribe()` aún se ejecutan en JavaScript. Las escrituras de propiedades nativas se ejecutan en el subproceso de la interfaz de usuario, por lo que el subproceso principal JavaScript puede retrasarlas; ver [Rendimiento de Android](./android-performance). La reproducción nativa no es una promesa de aislamiento de un hilo de interfaz de usuario ocupado.

El ejemplo compilado se encuentra en `demo/native-fixture` y su suite reutilizable en `benchmarks/playback-adapters.ts`. También verifica la propiedad del alcance, la invalidación del objetivo, la cámara lenta y el muestreo mientras JavaScript está ocupado.

Para migrar desde `value.subscribe(n => nativeTarget.setValue(n))`, registre un receptor compilado y use `property.bind(value, n => n)`. Mantenga y llame a la función de lanzamiento en el mismo límite del ciclo de vida que la cancelación de suscripción anterior.

El contenedor conserva la identidad del objetivo hasta `dispose()`, que también publica su referencia JavaScript. El sumidero nativo utiliza una referencia débil. Deseche antes de destruir el objeto SDK; la recolección de basura no reemplaza la propiedad explícita del ciclo de vida.
