# Física de círculos {#circle-physics}

Deje que un puñado de vistas choquen entre sí, reboten en su contenedor y sigan un dedo. `physicsWorld()` es una entrada opcional disponible desde **0.1.0-rc.1**. Reconstruya la aplicación nativa después de la actualización.

<Clip name="circle-physics-ios" caption="Simulador iOS: Bump Club con arrastre/liberación nativa real, colisiones circulares y de pared, impulsos, pausa/reanudación y reducción de movimiento. UI en inglés, velocidad original." />
<Clip name="circle-physics-android" caption="Emulador Android: la misma interacción nativa, usando toques reales de ADB. UI en inglés, velocidad original; Las grabaciones del simulador/emulador no son medidas de rendimiento del dispositivo físico." />

Crea el mundo **después del diseño**, usando un `AbsoluteLayout` dedicado y hijos directos cuadrados. El ancho y alto de cada vista deben ser iguales al diámetro de su círculo. Las posiciones son centros en el contenedor local DIPs, con x a la derecha y y hacia abajo.

```ts
import { physicsWorld } from '@rafaelaugusto/jolt/physics'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
// board is at least 240 × 300; red and blue are 48 × 48 direct children.
const world = physicsWorld(
  board,
  [
    { id: 'red', view: red, radius: 24, x: 70, y: 60 },
    { id: 'blue', view: blue, radius: 24, x: 170, y: 80, mass: 2 },
  ],
  { scope, restitution: 0.7 },
)

world.impulse('blue', { x: 180, y: -700 })
world.pause()
world.play()
world.reset()
// Read diagnostics on demand; no observer is required.
console.log(world.snapshot())
// On permanent screen teardown:
scope.dispose()
```

## Cuerpos y opciones {#bodies-and-options}

| Entrada         | Contrato                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuerpos         | 1–16 círculos no superpuestos, ID únicos no vacíos, radio 12–256 DIPs, masa 0,1–100 (predeterminado 1). Todo debe comenzar dentro del contenedor.    |
| Área            | El área del círculo combinado es como máximo el 40% del área del contenedor. Cada diámetro debe ajustarse a ambas dimensiones.                       |
| `velocity`      | `{ x, y }` inicial en DIPs/s, cero por defecto; magnitud como máximo 1200.                                                                           |
| `gravity`       | `{ x: 0, y: 750 }` DIPs/s² por defecto; cada componente entre −2000 y 2000.                                                                          |
| `restitution`   | 0–1, valor predeterminado 0,65. Los contactos normales por debajo de 40 DIPs/s se estabilizan sin rebote.                                            |
| `damping`       | Amortiguación de velocidad exponencial por segundo, 0–20; predeterminado 0,5.                                                                        |
| `reducedMotion` | `'pause'` por defecto. `'continue'` es una opción explícita para una interacción esencial.                                                           |
| `scope`         | Alcance de movimiento activo opcional; la suspensión se detiene, la reanudación restaura la reproducción anterior y la eliminación elimina el mundo. |

`impulse(id, {x,y})` usa masa × DIPs/s y agrega impulso/masa a la velocidad. Los componentes están limitados a ±120000; La velocidad resultante tiene un límite de 1200. Los cuerpos en pausa, desapegados, reducidos y retenidos ignoran los impulsos. `reset()` restaura las posiciones iniciales proporcionalmente a los límites actuales y las velocidades iniciales, incluso mientras está en pausa. `paused` informa una pausa explícita; `snapshot().status` también informa suspensión automática, suspensión y límites no válidos.

## Interacción y propiedad nativa {#native-interaction-and-ownership}

El kernel C de producción en iOS y el kernel de Java en Android realizan pasos fijos de 1/240 segundos. Las devoluciones de llamada de pantalla nativa mejoran la física y escriben traducciones de vistas nativas; Los controladores nativos de panorámica/táctil impulsan la velocidad de arrastre y liberación. No hay devolución de llamada JavaScript para cada cuadro, movimiento del puntero o colisión. JavaScript crea la escena, envía comandos, maneja los límites del diseño/ciclo de vida y lee instantáneas opcionales. NativeScript comparte su hilo de interfaz de usuario con JavaScript; esta API **no** promete movimiento a través de un hilo de interfaz de usuario bloqueado.

Un círculo sostenido actúa como un cuerpo cinemático y empuja otros círculos. Se puede mantener un puntero/cuerpo a la vez; la cancelación lo libera con velocidad cero. La versión utiliza la velocidad del puntero de la plataforma, limitada a 1200 DIPs/s. Los cuerpos no tienen rotación, fricción, articulaciones, formas arbitrarias, detección continua de colisiones o devoluciones de llamadas de contacto. Este es un pequeño solucionador de juegos de interfaz de usuario, no un motor de cuerpo rígido general o una integración Box2D.

Otorga al mundo la propiedad exclusiva de sus vistas de contenedor y cuerpo. No anime/vincule sus transformaciones, no adjunte otros gestos/oyentes táctiles nativos, reparente cuerpos ni transforme/desplace su espacio de coordenadas mientras esté activo. Se rechazan los observadores de gestos NativeScript existentes, las transformaciones iniciales y la propiedad del mundo duplicado. Mantenga a los elementos hijos decorativos no interactivos. La eliminación elimina los enlaces nativos de entrada/ciclo de vida, detiene su reloj y restaura las traslaciones originales y los indicadores de interacción.

## Límites, descanso y ciclo de vida. {#bounds-rest-and-lifecycle}

Cambiar el tamaño de las escalas se centra en los nuevos límites, cancela un arrastre, borra la velocidad y separa los contactos. Un contenedor demasiado pequeño para sus círculos detiene el reloj nativo hasta que vuelve a encajar. Los acuerdos densos o contradictorios están fuera del contrato de círculo disperso; el solucionador iterativo acotado es aproximado.

Pausar, poner en segundo plano la aplicación, descargar y reducir el movimiento, detener las actualizaciones y cancelar un arrastre activo. Las velocidades dinámicas restantes se conservan para su reanudación. Un mundo en reposo duerme y elimina la devolución de llamada de su pantalla; tocar un círculo o aplicar un impulso lo despierta. Cada cuadro de visualización ejecuta como máximo 16 subpasos (1/15 de segundo). El tiempo más allá de ese límite se descarta y se informa como `droppedMs`, lo que evita un trabajo de recuperación ilimitado después de una parada de la interfaz de usuario.

La vista previa de **Mejor juntos**, con la marca Bump Club, tiene controles en inglés, portugués, español y chino simplificado. Consulte [validación nativa](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/circle-physics.md) para pruebas y límites reproducibles. Este es el segundo hito de [#39](https://github.com/rafaelaugustos/jolt/issues/39); Punto fijo [archivos adjuntos y capturas](./physics-attachments) están disponibles en el próximo hito. Las limitaciones generales y la física más amplia siguen siendo un seguimiento. [Gravedad y rebote](./gravity) sigue siendo la API de animación de propiedad única finita.

Si NativeScript reconstruye las vistas nativas, el mundo las elimina automáticamente. Crea un mundo nuevo después del nuevo diseño. La descarga/carga que conserva las mismas vistas nativas solo se suspende y se reanuda.
