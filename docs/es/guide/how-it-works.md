# Cómo funciona {#how-it-works}

Cuando comienza una animación, Jolt resuelve los valores iniciales y calcula la curva fuente. Los resortes numéricos, las caídas y las interpolaciones utilizan [fotogramas clave adaptativos](./transitions#adaptive-keyframes), concentrando los detalles donde la interpolación lineal lo necesita. Los tiempos de los fotogramas clave creados permanecen exactos y los segmentos numéricos rectos conservan solo sus puntos finales. El asentamiento del resorte, la velocidad de interrupción y la llegada de la secuencia conservan su contrato de sincronización anterior. La mezcla de colores y los mapeos compuestos de valores de movimiento mantienen sus políticas de muestreo separadas.

Las muestras van a la plataforma de una sola vez:

- **iOS**: un `CAKeyframeAnimation` por propiedad en la capa de la vista (`opacity`, `transform.translation.x`, `transform.scale.y`, `transform.rotation.z`...). Core Animation los compone, por lo que `x` y `scale` pueden pertenecer a animaciones diferentes y las reproduce en el servidor de renderizado.
- **Android**: un `ObjectAnimator` por propiedad con `Keyframe`s y un interpolador lineal, en la vista `alpha`, `translationX`, `scaleY`, `rotation`...

Solid [colores](./colors) usa fotogramas clave CGColor en iOS y fotogramas clave int a través de un destino Java nativo en Android. El texto iOS utiliza una máscara alfa UILabel para que las posiciones de los glifos permanezcan fijas mientras la capa de color se anima.

Antes de jugar, los valores finales se establecen en la vista NativeScript, como lo hace `view.animate()`, por lo que `view.translateX` ya mantiene el objetivo mientras se ejecuta la animación. Al detenerse se vuelven a escribir los valores en la pantalla.

Cada propiedad en ejecución recuerda su curva y hora de inicio. En Android, las interrupciones leen el valor mostrado y el tiempo de reproducción actual del animador, por lo que la velocidad heredada sigue la escala de duración del animador del sistema. Las llegadas a principios de resorte utilizan un marcador de tiempo nativo con devoluciones de llamada de finalización únicamente; otras secuencias avanzan al completarse de forma nativa. Los retrasos, repeticiones y animaciones deshabilitadas siguen el mismo reloj de plataforma, sin que se ejecute JavaScript por cuadro.

[`animateSize()`](./size) tiene una ruta de ejecución diferente: las dimensiones reales y el reflujo de texto requieren la medición/diseño de NativeScript en el hilo de la interfaz de usuario de cada cuadro. Su devolución de llamada de marco propiedad de la biblioteca ejecuta JavaScript; no es reproducción del servidor de renderizado. `animateLayout()` todavía mide una vez y utiliza pistas de transformación nativas. Los suscriptores de valor de movimiento, la entrada de desplazamiento y la activación de devolución de llamada en la línea de tiempo también conservan sus costos JS documentados.

[`springValue()`](./live-springs) utiliza una ruta en vivo separada: estado de resorte persistente de C/Java, una devolución de llamada de visualización nativa compartida y asignaciones nativas/composición de capas. No reconstruye animaciones de fotogramas clave en cada actualización de destino. Estas devoluciones de llamada comparten el hilo de la interfaz de usuario; no son un aislamiento del servidor de renderizado del ocupado JavaScript. Las animaciones de destino fijo mantienen la ruta de muestra descrita anteriormente.

La entrada opcional [`gestures()`](./gestures) reconoce giro/pellizco/rotación y coordina el ScrollView en código nativo. Las salidas retenidas impulsan enlaces sin una devolución de llamada JS para cada movimiento; Las devoluciones de llamada solicitadas y los oyentes Core existentes aún ejecutan JavaScript. El reconocimiento y los resortes en vivo comparten el hilo de la interfaz de usuario.

## Pruebas {#tests}

Las pruebas ejecutan el motor contra un controlador de plataforma falso ([`test/helpers.ts`](https://github.com/rafaelaugustos/jolt/blob/main/test/helpers.ts)) con su propio reloj: registra los fotogramas clave que reproduciría y los finaliza cuando el reloj pasa su fin. Los controladores iOS y Android se verifican con los tipos de plataforma.

El dispositivo CI nativo también lee los valores de vista/capa de presentación en iOS y Android, verifica las dimensiones reales y el ciclo de vida del seguidor en vivo, y verifica una falla de geometría intencional. Los kernels Spring de C y Java se compilan y comparan en pruebas de trayectoria deterministas.
