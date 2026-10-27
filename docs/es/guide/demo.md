# Aplicación de demostración {#demo-app}

La aplicación NativeScript-Vue en [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) utiliza la compilación local Jolt. Se abre un lanzamiento normal **Jolt Estudio de movimiento**: una presentación animada de la marca, una casa en movimiento y una colección con capacidad de búsqueda de 73 experimentos agrupados por movimiento, tacto, visual, tipo, diseño, estado y SceneKit.

<Clip name="showcase-splash-ios" caption="Lanzamiento en frío del simulador real iOS 26: la pantalla de inicio del sistema conduce a la presentación animada nativa de la marca y a Studio. Capturado sin sincronización de lanzamiento XCTest; velocidad original. No evidencia de rendimiento del dispositivo físico." />

<Clip name="showcase-ios" caption="Grabación en simulador real iOS 26: resortes, gestos nativos, filtrado de categorías, búsqueda, reproducción de SceneKit y navegación de retorno. Entrada real XCTest; velocidad original. El reinicio en frío y el ícono instalado también se verifican fuera de este clip." />

[Vue Router NS](https://vue-router-ns.rafaelaugusto.dev/guide/splash) controla las páginas de inicio, colección y ejemplo a través de pilas de páginas nativas. Atrás regresa al estado de búsqueda/filtro existente. La primera página se monta debajo del protector; el splash nunca ingresa al historial de navegación. Jolt anima su logotipo, marca denominativa y salida, y omite esas animaciones para movimiento reducido. La pantalla de inicio del sistema iOS utiliza el mismo fondo sólido antes de que se inicie JavaScript.

Las animaciones de inicio se detienen cuando se navega. Las páginas de detalles montan solo el experimento seleccionado y lo liberan al salir. Los controles de tiempo específicos de la demostración se restablecen al dejar un detalle, y los experimentos exclusivos de SceneKit muestran un mensaje de disponibilidad en Android. Este tutorial valida el nuevo shell en iOS; no es evidencia de validación nativa Android.

Los recursos de la aplicación iOS ahora se encuentran en el repositorio, incluido el nombre para mostrar y el icono de **Jolt**. Al iniciar desde el ícono instalado, se abre Studio sin argumentos especiales. La aplicación requiere Core 9.1.3+ e instala `vue-router-ns@0.1.0-rc.2` para esta vista previa.

## Claro, oscuro o tu dispositivo {#light-dark-or-your-device}

Toque **◐** en el encabezado de Studio para elegir **Luz**, **Oscuro** o **Sistema**. La opción actualiza los controles de bienvenida, Studio, colección, búsqueda, página de idioma y experimento inmediatamente y permanece guardada después de cerrar la aplicación. **Sistema** sigue la apariencia del dispositivo, incluidos los cambios mientras la aplicación está abierta.

En iOS, una revelación circular Jolt abre el nuevo tema del control seleccionado, con la apariencia anterior debajo. Los cambios del sistema se revelan desde el centro de la página visible. Movimiento reducido aplica el tema final inmediatamente; Actualmente, Android cambia inmediatamente porque la revelación circular es solo para iOS.

Las etapas nativas de arte y animación conservan sus propias paletas; cambiar el tema de la interfaz no reinicia un experimento en ejecución ni cambia su configuración de animación.

<Clip name="showcase-appearance-ios" caption="Simulador iOS 26.2: los toques reales de XCTest revelan claro → oscuro desde el control seleccionado, navegan y buscan en la colección, juegan con resortes, regresan a la luz y luego siguen los cambios de apariencia del sistema en vivo. Velocidad original. Verificaciones nativas adicionales verifican la persistencia después del relanzamiento y las etiquetas portuguesas. Esto no establece Android ni la validación del dispositivo físico." />

## Idioma {#language}

Studio sigue el idioma del teléfono de forma predeterminada: el portugués usa el portugués brasileño, las variantes en español usan el español y las variantes en chino usan el chino simplificado; Los idiomas no admitidos utilizan el inglés. Toque **Idioma** en la parte superior de Studio para elegir **Seguir dispositivo**, **Inglés**, **Português**, **English** o **简体中文**. Los cambios se aplican inmediatamente y la elección persiste después de cerrar la aplicación. Al elegir **Seguir dispositivo** se elimina la anulación; el idioma preferido se vuelve a leer cuando se reanuda la aplicación.

La presentación, la colección, las 73 presentaciones de experimentos, los controles, los mensajes de estado y las etiquetas de accesibilidad están localizados. La búsqueda acepta nombres traducidos o en inglés, con o sin acentos. Los números de cuenta móviles utilizan los separadores del idioma seleccionado. Los identificadores de API de animación como `popIn` permanecen sin cambios; el aislado campo de juego técnico conserva sus partidos ingleses.

<Clip name="showcase-language-ios" caption="Simulador iOS 26: los toques reales de XCTest cambian de inglés a portugués, buscan una cámara sin acento, operan la lente nativa de la cámara y vuelven al inglés. Velocidad original. Comprobaciones nativas independientes verifican la persistencia y la selección automática de idioma mediante la configuración de inicio del idioma preferido iOS; esto no valida Android ni un dispositivo físico." />

<Clip name="showcase-portuguese-ios" caption="Las 54 entradas de la colección en portugués brasileño en el simulador iOS 26, con interacciones nativas representativas. Un montaje de capturas separadas a su velocidad original, incluido el modelo de coche local opcional. No se ejercen todos los controles técnicos." />

<Clip name="showcase-splash-pt-ios" caption="Lanzamiento en frío real en portugués en el simulador iOS 26, incluyendo el splash animado y el Studio localizado. Temporización original, capturada por separado de la sincronización de inicio XCTest." />

## Interiores de Motion Studio {#motion-studio-interiors}

La colección ahora presenta cada experimento como una composición interactiva: una lista de reproducción para escalonar, una cuenta para dígitos rodantes, un tocadiscos para valores de arrastre, tarjetas táctiles para retroalimentación de pulsación y señales coordinadas para vinculaciones de valores. Los cuatro participantes automovilísticos conservan su estudio SceneKit. El escaparate tiene un conjunto de controles enfocados; El patio de recreo aislado todavía expone las sondas detalladas y las opciones técnicas.

La presentación se abre con anillos en expansión, un acento orbital, la marca Jolt y una marca denominativa escalonada antes de revelar Studio. Respeta el Movimiento Reducido y espera el recorrido inicial. Las imágenes de la galería y la tarjeta de gestos son obras de arte editorial generadas incluidas con la aplicación; las pruebas de imagen todavía usan sus accesorios de cuadrícula originales. Estas son demostraciones de movimiento, no un servicio bancario, de música o de viajes.

<div class="clips">
<Clip name="showcase-springs-ios" caption="iOS 26 simulador: los toques interrumpen el resorte y pasan a otra respuesta. Velocidad original." />
<Clip name="showcase-presets-ios" caption="Simulador iOS 26: pop, shake, rebote y pulso en el cartel nativo. Grifos reales; velocidad original." />
<Clip name="showcase-colors-ios" caption="Simulador iOS 26: fondo, letras y bordes interpolados a través de tres paletas. Velocidad original." />
<Clip name="showcase-forms-ios" caption="iOS 26 simulador: esquinas, borde, rotación y sombra, incluyendo parada en mitad de la transición. Velocidad original." />
</div>

Los siguientes montajes unen capturas nativas separadas entre ejemplos. Todas las interacciones utilizan entrada XCTest real en el simulador iOS 26; el tiempo de reproducción no cambia. No establecen el rendimiento del dispositivo físico ni el comportamiento de Android.

<Clip name="showcase-motion-ios" caption="Momento, escalonamiento, rutas, líneas de tiempo, reproducción, bucles, pausas, sincronización orgánica, suavización de pistas, suavización de curvas y configuraciones de movimiento. El ejemplo de configuración selecciona explícitamente la mitad de la velocidad y el movimiento reducido." />
<Clip name="showcase-touch-ios" caption="Retroalimentación al mantener presionado, resortes en vivo, una partitura que se puede arrastrar, solicitudes hápticas, gestos fotográficos, transferencia de carrusel/desplazamiento, arrastrar/ajustar y un compositor que sigue el teclado. Un simulador muestra solicitudes hápticas, no vibraciones físicas." />
<Clip name="showcase-visual-ios" caption="Degradados lineales/radiales/cónicos, estados de ánimo y valores de gradientes reactivos, brillo, partículas, cargadores, revelaciones, desvanecimiento/desbordamiento y estelas de luz. Revelar selecciona explícitamente 1600 ms; Light Trails selecciona explícitamente el modo de cámara lenta de la aplicación." />
<Clip name="showcase-type-ios" caption="Letras y palabras animadas, cantidades variables, cambios en el recuento de dígitos y el tamaño de letra, y efectos nativos SF Symbol." />
<Clip name="showcase-layout-ios" caption="Insertar/reordenar/cambiar el tamaño de tarjetas, dimensiones de diseño reales, remontar, filas de lista animadas y un encabezado de álbum vinculado al desplazamiento nativo." />
<Clip name="showcase-state-ios" caption="Una hoja/telón de fondo coordinado, observadores, capas de valores, movimiento en capas, estados de carga, transiciones por objetivo, directivas Vue y comparación de resortes. Ocupado JavaScript muestra únicamente su mensaje de disponibilidad Android." />
<Clip name="showcase-images-ios" caption="Efectos reales de ondulación y disolución en la obra de arte incluida, seguidos de zoom y reinicio de la foto nativa. Simulador iOS 26; velocidad original." />

### Taller de automoción · iOS {#automotive-studio-·-ios}

Los tres experimentos SceneKit comparten un estudio reflexivo. **Lente de la cámara** anima el campo de visión mientras la cámara permanece en su lugar. **Luces y materiales** cambia iluminación y acabado de carrocería. **Entorno y sombreadores** vincula un valor de movimiento a la intensidad ambiental, la intensidad de la luz principal, un uniforme de sombreado de vidrio y un uniforme de color de faro. Estos son adaptadores nativos Jolt; JavaScript selecciona el destino e intercambia la imagen del entorno con un toque, sin que un observador configure las propiedades de SceneKit en cada fotograma.

<div class="clips">
<Clip name="showcase-atelier-ios" caption="iOS 26 Simulador: transiciones de lentes, búsqueda de la mitad, reanudación y cambio de acabado del cuerpo. Representación nativa real de SceneKit y entrada de XCTest; modelo detallado local; velocidad original." />
<Clip name="showcase-lighting-ios" caption="Simulador iOS 26: luz diurna, luz cálida de estudio, pintura cobre e iluminación nocturna. Modelo detallado local; velocidad original." />
<Clip name="showcase-shaders-ios" caption="Simulador iOS 26: uniformes de entorno y sombreado de vidrio/faro impulsados ​​por un valor de movimiento compartido. Modelo detallado local; velocidad original. Esto demuestra sombreado, no un interior de cabina o una simulación de fluidos." />
</div>

**Mapas y 3D → Línea de tiempo** sigue una ruta curva a través de un paseo marítimo ilustrado. El viaje, el pulso del destino, el progreso y el punto de control retrasado comparten la línea de tiempo y se detienen juntos. La pestaña Mapa nativo todavía anima el adaptador de mapa real.

<Clip name="showcase-journey-ios" caption="Simulador iOS 26: el viaje coordinado rediseñado, pausa/reanudación, el mapa nativo y regreso a la cámara del automóvil. Entrada real XCTest; velocidad original; El coche utiliza el modelo local opcional." />

**Mapas y 3D → Cámara 3D** utiliza el mismo estudio automotriz en Motion Studio. Su adaptador de pose nativo mueve la cámara entre dos vistas del automóvil, con pausa, reanudación, parada y reproducción. Al cambiar de pestaña, se restablece el progreso mostrado y se recrean los enlaces de escena al regresar.

<Clip name="showcase-camera-orbit-ios" caption="Simulador iOS 26: la pestaña Mapas reales y cámara 3D, moviéndose por el automóvil detallado, pausando/reanudando, reproduciendo, deteniendo y regresando desde la línea de tiempo. Entrada real XCTest; velocidad original; Modelo local opcional. No evidencia de rendimiento del dispositivo físico." />

<Clip name="showcase-native-reentry-ios" caption="Simulador iOS 26: abrir y reabrir las cuatro entradas automotrices en una sesión de aplicación. Cada regreso vuelve a montar el estudio nativo, incluida la pestaña de la cámara 3D. Navegación auténtica XCTest; modelo detallado local; velocidad original." />

El automóvil detallado en estas grabaciones es un activo de vista previa local del proyecto independiente `jolt-car`. Es **no distribuido en este repositorio** mientras que sus términos de fuente/redistribución no están registrados. Para utilizar un modelo autorizado con la misma disposición de materiales localmente, colóquelo en `demo/App_Resources/iOS/preview-car.usdz`; de lo contrario, la demostración utiliza su vehículo procesal. El entorno del estudio está dibujado en código. Estos clips del simulador no son evidencia del rendimiento del dispositivo físico.

## Ejemplo de asistente {#assistant-example}

El asistente anterior todavía está disponible con `--screen=home` (iOS) o `--es screen home` (Android). Tiene tres pantallas:

<div class="clips">
<Clip name="assistant-flow" caption="El asistente reproduciendo su flujo en el simulador iOS." />
<Clip name="assistant-flow-android" caption="El mismo flujo en el emulador Android." />
</div>

<div class="clips">
<Clip name="assistant-chat" caption="La burbuja de audio cuenta atrás con rollTo() en iOS." />
<Clip name="assistant-chat-android" caption="La cuenta atrás en Android." />
</div>

- **Hogar:** un saludo letra por letra, tarjetas de documentos accionadas por resorte y un botón de búsqueda pulsante. Toque una tarjeta o deslícela por el ventilador para cambiar la selección. El botón de búsqueda abre Voz.
- **Voz:** un orbe flotante, una transcripción escalonada y controles de pausa/reanudación. Toque el micrófono para abrir Chat.
- **Charla:** mensajes y tarjetas de documentos ingresan por etapas. Abra una vista previa de un documento, reproduzca la vista previa de la forma de onda y observe cómo avanza el tiempo segundo a segundo, o envíe un mensaje. Los mensajes enviados permanecen en la memoria mientras cambias de pantalla.

Las pantallas cambian a través de un breve fundido cruzado, una sale antes de que entre la siguiente. Abra el botón del signo de interrogación en Inicio, luego **Ver demostración**, para reproducir Voz → Chat → Inicio → Voz. La navegación, el deslizamiento, el envío de un mensaje o la apertura de una vista previa interrumpen la reproducción.

## Ejecutar {#run}

Instale el [CLI NativeScript](https://docs.nativescript.org/setup/), luego ejecute:

```sh
# Repository root, in one terminal
npm install
npm run dev

# In another terminal
cd demo
npm install
ns run ios
```

`ns run android` abre la colección. En el ejemplo del asistente, los íconos provienen de la fuente Material Icons en lugar de SF Symbols, el sistema ajusta la ventana para el teclado en lugar de un observador de teclado y el orbe mantiene su movimiento respiratorio sin la deformación del líquido.

El área de juegos de animación se abre con `--playground` en iOS y `--es playground true` en Android. Esto conserva la galería anterior de una sola página para sondas y grabaciones aisladas; Los lanzamientos normales utilizan Motion Studio.

Abra **Efectos de imagen y zoom de fotos.** en el patio de juegos para ondulación, distorsión, disolución y el visor de fotos nativo. Ejecútelo directamente con `--image-lab=effects` o `--image-lab=zoom` en iOS; utilice `--es image-lab effects` o `--es image-lab zoom` en Android. El dispositivo tiene una cuadrícula de color y una esquina de destino transparente para que el desplazamiento, el recorte y el alfa sean visibles. El visor incluye botones de zoom/restablecimiento/cierre, controles de cancelación y reconexión repetida.

Para una compilación del simulador iOS instalada, pase un argumento de vista previa al iniciar:

```sh
xcrun simctl launch booted org.nativescript.jolt --autoplay
xcrun simctl launch booted org.nativescript.jolt --screen=voice
xcrun simctl launch booted org.nativescript.jolt --screen=chat
xcrun simctl launch booted org.nativescript.jolt --playground
```

En Android los mismos nombres van como cadenas extras de la intención inicial:

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es autoplay true
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es screen chat
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true
```

Finalice la aplicación en ejecución antes de iniciarla con diferentes argumentos. Sin argumentos, la aplicación abre Motion Studio. Utilice `--screen=home` para el asistente.

Dos argumentos más ayudan a que una reseña o una grabación lleguen a un punto sin tocar la pantalla. `--tap=<text>[,<text>...]` funciona en ambas demostraciones: activa el toque de la primera vista cuyo texto o etiqueta de accesibilidad es igual a cada entrada, subiendo al ancestro más cercano con un controlador de toque, uno cada milisegundos `--every` (1200 por defecto). `--section=<heading>` es para el patio de juegos y se desplaza a la primera sección cuyo encabezado comienza con ese texto, ignorando mayúsculas y minúsculas:

```sh
xcrun simctl launch booted org.nativescript.jolt --playground --section=text --tap=Letters
xcrun simctl launch booted org.nativescript.jolt --playground --section=rolling "--tap=+ 1.10,Random" --every=2000
xcrun simctl launch booted org.nativescript.jolt --screen=home "--tap=Help,Watch demo" --every=2000
```

El formulario Android agrega `playground`:

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true --es section text --es tap Letters
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es tap "Help,Watch demo"
```

## Movimiento {#motion}

El asistente utiliza API públicas Jolt: `animate()` para transformaciones y opacidad, `animateText()` para el saludo y transcripción, [`rollTo()`](./rolling) para la cuenta regresiva de audio y [Entrada Vue](./vue) para el resto: `v-press` en cada botón y `JoltTransition` para los cambios de pantalla. (`mode="out-in"`) y para la hoja del documento, que se desvanece antes de que Vue la elimine. La selección de tarjetas se ajusta al soltarla; no vincula el progreso de la animación al gesto.

Los controladores de animación nativos y los temporizadores de escenario pertenecen a cada pantalla montada. Desmontar o suspender la aplicación cancela su trabajo. Al regresar al primer plano se reconstruye la pantalla actual. Reducir el movimiento es el trabajo de Jolt a través del [`reducedMotion: 'user'`](./configure) predeterminado: el texto aparece inmediatamente, se transforma, salta y se desvanece mientras se reproduce. La demostración solo agrega decisiones de contenido en la parte superior, mostrando el chat preparado a la vez y omitiendo sus bucles decorativos; un cambio de configuración actualiza la pantalla actual.

## Contenido de muestra {#sample-content}

Esta es una demostración de UI local. No graba voz, no busca archivos, no reproduce audio ni contacta con un servicio. Se simulan vistas previas de documentos y la forma de onda de 37 segundos; Los mensajes escritos duran solo durante la sesión actual de la aplicación.

El orbe utiliza un mapa de bits transparente. En iOS, [`liquid()`](./liquid) deforma su textura con una deformación repetitiva nativa mientras que `animate()` controla su escala, rotación, posición y opacidad; en Android solo se reproduce el movimiento `animate()`. La pausa congela ambos movimientos. Los pliegues de colores provienen de la obra de arte; se trata de una deformación de la textura en lugar de una simulación de fluido.

Los íconos iOS son SF Symbols. En Android, `Icon.vue` dibuja el glifo de iconos de materiales con el mismo significado de una fuente incluida con la demostración (licencia Apache 2.0).

La sección de sintonización en la parte superior del patio de juegos establece el [escala de tiempo y preferencia de movimiento reducido](./configure) global, por lo que cada sección a continuación se puede ver en cámara lenta o con transformaciones saltando hasta el final.

El patio de juegos también incluye [controles de reproducción](./playback): pausa una tarjeta, elige un cuadro con un control deslizante y continúa, con un pulso independiente corriendo al lado.

El [encabezado con enlace de desplazamiento](./scroll-linked) se mueve y desvanece el título grande a medida que avanza el ScrollView principal, revelando un título compacto fijo. Al desplazarse hacia atrás se restaura.

La sección Teclado muestra a un compositor clavado en la parte inferior del patio de juegos; [`followKeyboard()`](./keyboard) lo levanta con el teclado del software y lo baja cuando el teclado se esconde.

El [demostración de línea de tiempo](./sequences) compara entradas superpuestas, llegadas una a la vez y horas de inicio fijas, con controles de repetición y parada.

El [demostración de filas de lista](./lists) desplaza sesenta filas que aparecen gradualmente a medida que aparecen, con un interruptor para animar cada elemento una vez y un botón que intercambia elementos nuevos.

El [camino patio de recreo](./paths) sigue una curva cúbica o una órbita basada en arco, con controles de orientación, reproducción, pausa/reanudación y parada.

<Clip name="reorder-pt-ios" caption="Nuevo en este checkout: el experimento número 55, reordenamiento de listas, en portugués en el simulador iOS. Arrastre real, movimiento de vecino nativo y la alternativa del botón." />

[Diseños compartidos](./shared-layout) es el experimento 56 en esta compra: mover un indicador de pestaña y la portada de un álbum entre diferentes árboles de vista.

[Repetición de la interacción](./interaction-replay) es el experimento 57: registrar un resorte o una resistencia cancelada, aceptar una línea de base del motor congelada, reproducir a través de la sonda nativa y detectar un punto de control deliberadamente incorrecto.

[Precisión de curva](./transitions#adaptive-keyframes) es el experimento 58: compara la reproducción nativa adaptativa y de velocidad fija, inspecciona los recuentos de puntos y ejecuta las comprobaciones de precisión nativas.

[Inspector de movimiento](./motion-inspector) es el experimento 59: seleccione una vista sin cambiarla, compare observaciones nativas, identifique propietarios, sintonice/reproduzca un resorte y copie TypeScript.

[Navegación compartida](./shared-navigation) es el experimento 60: abre una foto o una tarjeta de pase de un día en otra ruta, luego regresa a su fuente actual con el movimiento nativo Jolt.

[Navegación interactiva](./interactive-navigation) es el experimento 61: mira hacia atrás arrastrando el borde, cancela y luego confirma el retorno en iOS.

[Espalda predictiva](./predictive-back) es el experimento 62: progreso de borde nativo Android, cancelación, regreso vigilado y una escena de anochecer bilingüe.

[Gestos compartidos](./shared-gestures) es el experimento 63: imagen y tarjeta siguen gestos nativos de retroceso, con cancelación y un botón accesible.

<Clip name="showcase-languages-ios" caption="Simulador iOS 26.2: toques reales seleccionan español y chino simplificado, abren la colección traducida y la composición de desplazamiento nativo, luego regresan al selector de idioma. Las comprobaciones independientes cubren las opciones guardadas y la selección del idioma del dispositivo. Velocidad original; sin reclamo de dispositivo físico." />
