# Lo que falta {#not-there-yet}

- [Transiciones reales de ancho/alto/auto](./size) están disponibles para StackLayout/GridLayout, incluido el interior de ScrollView. Ejecutan diseño JS por cuadro; La asignación flexible, las celdas recicladas y los elementos compartidos están fuera de esa API.

- [Cambios de diseño](./layout), [restricciones de arrastre](./drag), [valores de movimiento](./motion-values), [reproducción observable](./playback) y [controles de cronograma conjunto](./sequences) están disponibles. Tienen diferentes contratos nativos de ejecución y ciclo de vida; ver sus guías.
- [Navegación compartida](./shared-navigation), [gestos compartidos](./shared-gestures), [devuelve la celda actual](./return-targets) y [galería conectada](./gallery) están disponibles en rc.1 dentro de sus combinaciones documentadas de Frame/ListView/imagen estática. La aceptación de la galería de dispositivos físicos sigue registrada en [#117](https://github.com/rafaelaugustos/jolt/issues/117).
- La composición de gestos de uso general con varios dedos permanece fuera de `drag()`; [zoom de foto](./photo-zoom) proporciona su propio controlador de pellizco, desplazamiento y despido.
- [Adaptadores de propiedades externos](./native-properties) requiere un complemento nativo opcional. La pose de la cámara y [adaptadores de material ligero/sólido](./scene-lighting) usan SceneKit en iOS; no se incluye ningún adaptador de renderizado 3D Android. Las unidades de cámara MapKit y MapLibre son distintas.
- [Cámara SceneKit FOV](./scene-camera) está disponible para cámaras de perspectiva automática en iOS. Los controles de lentes arbitrarios y de escala ortográfica permanecen fuera de ese adaptador.
- Las líneas de tiempo pausan y reanudan a sus participantes, pero no ofrecen depuración agregada arbitraria de devoluciones de llamada o efectos de una sola vez. Las escrituras nativas no aíslan un renderizador del hilo principal JavaScript.

El [problemas](https://github.com/rafaelaugustos/jolt/issues) realiza un seguimiento de los próximos trabajos e integraciones.

## De RC a 0.1.0 {#from-rc-to-0-1-0}

El alcance documentado de rc.1 queda congelado para 0.1.0. Los siguientes candidatos se centran en corrección, compatibilidad, accesibilidad, limpieza del ciclo de vida y documentación. Las capacidades nuevas quedan para después de 0.1.0; las issues de funciones futuras no amplían las combinaciones admitidas por la versión estable.

Antes de la aceptación estable:

- Validar el flujo de galería admitido en iOS y Android físicos: zoom/retorno interrumpido, objetivos reciclados o eliminados, rotación, accesibilidad y navegación repetida sin superposiciones retenidas ([#117](https://github.com/rafaelaugustos/jolt/issues/117)).
- Valide la composición de desplazamiento del Core ListView en dispositivos físicos, incluida la inversión/lanzamiento, los cambios de diseño tardíos, la preservación y limpieza del anclaje ([#116](https://github.com/rafaelaugustos/jolt/issues/116)).
- Valide el hardware de rotación/gravedad en vivo, el mapeo de orientación, el costo de muestreo y la limpieza de suscripción en un dispositivo físico iPhone y Android ([#114](https://github.com/rafaelaugustos/jolt/issues/114)). Las entradas de prueba del simulador validan el procesamiento, no el hardware del sensor.
- Mantenga las comprobaciones de regresión generales, iOS y Android y sus controles negativos en verde en la confirmación de lanzamiento; verifique la instalación del paquete coincidente y una reconstrucción nativa limpia. Registre y resuelva las regresiones de bloqueo de versiones antes de etiquetarlas como estables.

La regularidad de los fotogramas, la respuesta a la interacción y la memoria retenida aún necesitan pruebas en dispositivos físicos. El [proyecto comparativo](https://github.com/rafaelaugustos/jolt/issues/65) es independiente de la entrega de este alcance. Otros adaptadores de frameworks, shaders arbitrarios de vistas, tipos de sensores, uniones físicas entre cuerpos y navegación modal general quedan para más adelante. Las alternativas por plataforma y los costes de JavaScript por fotograma siguen siendo los documentados; la RC no amplía esos contratos.
