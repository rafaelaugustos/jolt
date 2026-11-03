# Recetas de movimiento de Jolt Drive

Cuatro patrones reutilizables de [Jolt Drive](https://github.com/rafaelaugustos/jolt-drive), revisados en el commit `2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f`. Cada receta incluye el archivo fuente completo, un prompt de adaptación y una nueva grabación nativa. Los archivos usan Jolt RC.10 y NativeScript-Vue 3, con las dependencias indicadas abajo.

Las grabaciones muestran la aplicación real en un simulador iPhone 17 Pro con iOS 26.2, interacción real mediante idb y velocidad original. No son mediciones en un dispositivo físico. El build del panel de carga solo difiere en imports de tipos TypeScript que se eliminan al compilar; el código de interacción coincide.

## Panel, cámara y entrada de tarjetas {#cockpit}

[Abrir receta y copiar el código](/es/recipes/drive-cockpit) · [Código del proyecto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/useCockpitGesture.ts)

El hook conecta el arrastre vertical con el panel y copia su posición al offset compartido. Home lo usa para el encuadre; ControlSheet para la flecha, los resúmenes y la entrada escalonada de tarjetas. Al soltar, proyecta la posición con velocidad × 0,18 para elegir abierto o cerrado.

<Clip name="drive-cockpit-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interacción real mediante idb en la app nativa, velocidad original. Interfaz en inglés; no es una grabación de dispositivo físico ni una medición de rendimiento." />

**Preparación.** Usa refs de NativeScript-Vue llamadas root (GestureSurface) y scrollContent (ScrollView), un motion value offset, posiciones height/closed medidas y estado active. Home y ControlSheet conectan ese offset con la cámara y las tarjetas; el hook no crea la escena 3D.

**Ciclo de vida y adaptación.** Llama a useCockpitGesture durante setup, con root y scrollContent montados al ejecutar los hooks. Conecta active al ciclo de vida de la página. El hook pausa la entrada y libera suscripción, binding y controlador al desmontar. Consulta Home/index.vue y ControlSheet.vue para los consumidores del progreso.

## Selección mediante un resorte {#atmosphere}

[Abrir receta y copiar el código](/es/recipes/drive-atmosphere) · [Código del proyecto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/AtmosphereOption.vue)

Un objetivo cambia entre 0 y 1. Un resorte con rigidez 420, amortiguación 30 y masa 1 mueve juntos el fondo, el borde, las esquinas y el texto. El padre cambia selected y controla el tema.

<Clip name="drive-atmosphere-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interacción real mediante idb en la app nativa, velocidad original. Interfaz en inglés; no es una grabación de dispositivo físico ni una medición de rendimiento." />

**Preparación.** Proporciona name, color y selected, gestiona select e instala el plugin Vue de Jolt para v-press. Copia o sustituye springs.snap y withAlpha. El padre controla la selección; no requiere SceneKit.

**Ciclo de vida y adaptación.** Conserva el plugin Vue y useMotionScope: el resorte y sus bindings pertenecen al componente. Sustituye los imports @/themes o copia sus helpers. La selección es estado; no crees un resorte en cada toque. Se conserva la política de movimiento reducido de Jolt.

## Panel sobre un fondo desenfocado {#charge-sheet}

[Abrir receta y copiar el código](/es/recipes/drive-charge-sheet) · [Código del proyecto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/EnergyPlan.vue)

Solo el fondo del garaje recibe blur. El panel permanece nítido como elemento hermano, con puntos content y 90%, ScrollView y backdrop. Si no hay backend de blur, aumenta la opacidad del backdrop. Guardar y cerrar usan la misma salida.

<Clip name="drive-charge-sheet-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interacción real mediante idb en la app nativa, velocidad original. Interfaz en inglés; no es una grabación de dispositivo físico ni una medición de rendimiento." />

**Preparación.** Registra GestureSurface y las directivas Vue de Jolt. Proporciona accent, level, limit y la vista montada del garaje como background; el panel debe ser su hermano. Adapta Icon, safeArea y el tema. Gestiona save/close sin desmontar antes de terminar la salida.

**Ciclo de vida y adaptación.** El panel debe quedar fuera del árbol del fondo desenfocado. onDismiss espera a que desaparezca el blur antes de emitir close y comprueba si el componente sigue montado. Conserva useMotionScope y libera el blur. El host debe gestionar foco, semántica y ciclo de vida.

## De la órbita a la cabina {#cabin}

[Abrir receta y copiar el código](/es/recipes/drive-cabin) · [Código del proyecto](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/components/scene/Car3D.vue)

La cámara se alinea con la puerta y después inside va de 0 a 1 en 1900 ms; la salida dura 1400 ms. El renderizador conecta posición, foco, campo visual, luces y materiales al progreso. El trayecto usa interpolación cuadrática en las coordenadas de la cámara.

<Clip name="drive-cabin-ios" :width="320" caption="Jolt Drive · simulador iPhone 17 Pro, iOS 26.2. Interacción real mediante idb en la app nativa, velocidad original. Interfaz en inglés; no es una grabación de dispositivo físico ni una medición de rendimiento." />

**Preparación.** Solo iOS. Requiere SceneView/createCarStage, camera-path, modelo, materiales y ClimatePanel del proyecto, además de @rafaelaugusto/jolt-native. Usa las medidas de tu escena. Car3D es el archivo completo, no un helper aislado ni una implementación Web.

**Ciclo de vida y adaptación.** Lee Car3D.vue junto con car-stage.ios.ts y camera-path.ts. Ajusta puerta, ojos y foco a tu modelo. Conserva las guardas de revisión, movimiento reducido, active/foreground y los propietarios nativos separados de los bindings recreados. SceneKit es exclusivo de iOS; no es la API Web.

## Grabaciones y origen del código {#provenance}

Los archivos son copias verificadas mediante SHA-256. El enlace apunta al commit fijado, evitando cambios silenciosos desde main. Ejecuta el proyecto completo para obtener la interfaz y los assets.
