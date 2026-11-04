# La receta de movimiento de Hexdrop

[Hexdrop](https://github.com/rafaelaugustos/hexdrop) convierte una tarjeta de archivo en ingrediente para una poción nativa. La receta conserva el `useIngredientDrag.ts` completo del commit `ebdc02a2652051c982779ea43ba3d76cf99bb538`, con NativeScript-Vue 3 y Jolt **0.1.0-rc.11**.

## Un arrastre con destino {#ingredient-drag}

[Obtener la receta del gesto](/es/recipes/hexdrop-drag) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)

`drag()` de Jolt sigue la tarjeta y `snap: [0]` la devuelve con un resorte si se rechaza el drop. La app aplica una escala de 0,86, inclina según el movimiento horizontal y compara el rectángulo transformado con el frasco en coordenadas de ventana. Un drop aceptado pausa el controlador y absorbe la tarjeta durante 200 ms antes de llamar a `onDrop`.

<Clip name="hexdrop-native-ios" :width="320" caption="Hexdrop · simulador iPhone 17 Pro, iOS 26.2. Arrastres reales mediante idb: retorno con resorte, drop aceptado, ignición, llenado y balanceo del tapón. Interfaz en inglés, velocidad original, captura sin audio. Demo local; no se sube ningún archivo. No mide rendimiento en dispositivo físico." />

Llama a `useIngredientDrag` durante setup. Conecta `loaded` y `tap` a la tarjeta nativa. Proporciona `disabled`, un `target()` con límites en coordenadas de ventana y los callbacks `onStart`, `onHover` y `onDrop`. Copia `transformedRect`, `intersects` y el tipo `Rect` del módulo de geometría fijado; consulta el panel para la integración completa. Jolt aporta la mecánica; la app define la regla de aceptación.

Separa el controlador del gesto del scope de animación: reiniciar el feedback visual no debe eliminar la entrada. Conserva la protección por generación, el test de posición final, la supresión de tap tras arrastrar y la limpieza al pasar a segundo plano o desmontar. Un drop cancelado no debe iniciar una poción posteriormente. El tap y el botón Brew potion son alternativas al arrastre; consérvalos.

El hook no dibuja la poción ni sube archivos. La escena nativa está en `potion-view.ts`: ignición de 540 ms, llenado de 8,4 segundos mediante un motion value, morphs del líquido, partículas y la araña transferida al pivote del tapón. El ciclo de vida y la reducción de movimiento pertenecen a esa escena. Ejecuta el proyecto completo para esta ilustración. Solo se verifica el simulador iOS; Android y Web no se demuestran.

## Una entrada con un reloj compartido {#launch}

[Un hechizo de apertura.](/es/recipes/hexdrop-launch) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/launch/launch-animation.ts)

La timeline de 1550 ms superpone la marca flotante, brillos radiales, trazado hexagonal, partículas y entrada del título y subtítulo. Tras montar el contenido real con reveal, un fade de 320 ms retira la capa. Con movimiento reducido se omiten los efectos y se utiliza una breve pausa y fade. Copia el código completo con el componente y recurso enlazados abajo.

<Clip name="hexdrop-launch-ios" :width="320" caption="Apertura de Hexdrop en iOS: fragmento de 3,8 a 7,0 segundos de la grabación del creador. Marca flotante, sello trazado, partículas, onda de luz y revelación de la app. Interfaz en inglés, velocidad original, sin audio. Dispositivo no especificado; no mide rendimiento." />

NativeScript-Vue 3 y Jolt RC.11. Proporciona el GridLayout nativo montado y medido, los IDs de LaunchScreen.vue, sus estilos y hexdrop-mark.png. Mantén las superficies de dibujo con tamaño fijo y transforma sus contenedores. reveal monta el contenido y espera nextTick antes del fade. Conserva el handle, espera finished y llama a dispose al descargar permanentemente; preserva movimiento reducido y recuperación de errores. La pantalla de inicio del sistema es estática; la timeline comienza cuando NativeScript está listo. Verificado en simulador iOS.

[LaunchScreen.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/LaunchScreen.vue) · [App.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/App.vue) · [hexdrop-mark.png](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/assets/hexdrop-mark.png)

## Código e integración

- [useIngredientDrag.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)
- [geometry.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/geometry.ts)
- [IngredientPanel.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/IngredientPanel.vue)
- [potion-view.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/potion-view.ts)
- [README](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/README.md)

## El sitio en movimiento

<Clip name="hexdrop-site-chromium" :width="960" caption="Chromium en macOS arm64. Interacción real de puntero y teclado con Hexdrop en la página principal, el showcase y la receta, incluida la copia de código y prompt. Velocidad original. Los vídeos incluyen la grabación iOS del creador (dispositivo no especificado) y la receta de arrastre en simulador iPhone 17 Pro; no son versiones Web. La lista de la comunidad, sin cambios, utiliza una respuesta vacía aislada en la prueba local." />

<Clip name="hexdrop-creator-ios" :width="320" caption="Hexdrop en iOS: grabación del creador con apertura animada, arrastre, preparación, selector de documentos y repetición. Velocidad original, sin audio; se omiten los primeros 3,8 segundos de la pantalla de inicio y transición del sistema. Dispositivo no especificado. Demo local; no se suben archivos." />
