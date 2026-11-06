# Recetas de movimiento de Vena

Un corazón hecho de luz. Doscientos mil puntos forman un cuerpo que responde, late y te invita a acercarte.

Creado por Rafael Augusto con NativeScript-Vue y Jolt RC.11. SceneKit dibuja 160 mil puntos del torso y 40 mil del corazón, con una capa extra de brillo. Jolt controla uniforms, enfoque y movimiento de la interfaz. La escena de partículas es exclusiva de iOS. Ritmos de ejemplo; sin medición cardíaca ni conexión con HealthKit.

[Explora las dos recetas](/es/recipes/?q=Vena) · [Ver el proyecto](https://github.com/rafaelaugustos/vena-ns)

<Clip name="vena-native-ios" :autoplay="false" poster="/media/vena-native-ios.jpg" :width="320" caption="Vena en iOS: grabación del creador, con interfaz en inglés, apertura, corazón de partículas, colección de ritmos y enfoque del corazón. Velocidad original, exportación a 60 fps, sin audio; se omiten los primeros 3,25 segundos del inicio del sistema. Dispositivo no especificado; no mide rendimiento. Valores de BPM ilustrativos." />

## Un ritmo propio. {#opening}

[Un ritmo propio.](/es/recipes/vena-opening) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/motion/entrance.ts)

opening coordina título, subtítulo, opción de saltar y strokeEnd de una señal vectorial. revealInterface presenta cabecera, tarjeta, pie e indicación en una timeline. WelcomeOverlay espera vistas cargadas, ignora la finalización tras liberar recursos y permite saltar. App.vue coordina por separado la formación del corazón. El vídeo muestra la apertura normal; movimiento reducido y limpieza se describen desde el código.

NativeScript-Vue 3 y Jolt RC.11. Llama a opening con cuatro vistas nativas cargadas; title, caption y skip comienzan con opacity 0. rule aloja un trazado de 190×30. WelcomeOverlay.vue muestra la protección al terminar/saltar y la limpieza. revealInterface recibe un MotionScope propio y cuatro vistas montadas. Libera el handle de opening y el scope al salir. Este archivo anima texto, trazado y entrada; el corazón necesita HeartScene y sus recursos. Conserva el movimiento reducido. Grabación en iOS.

## Un corazón hecho de luz. {#heart}

[Un corazón hecho de luz.](/es/recipes/vena-heart) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/scene-view.ios.ts)

Un motionValue repite de 0 a 1 en 60000 / bpm milisegundos y se vincula al uniform beat. ripple y heartTap mantienen las ondas de toque independientes del latido automático. Springs animan enfoque, posición del puntero y órbita. El shader de GPU deforma la nube; JavaScript no actualiza cada punto en cada frame. El vídeo muestra pulsación y cambios de enfoque. Suspensión/reanudación, movimiento reducido y helper del puntero se revisaron en código, sin casos de prueba específicos en el vídeo.

Solo iOS: NativeScript-Vue 3, Jolt RC.11, su paquete nativo y SceneKit. HeartScene depende de shaders.ts, anatomy.ts, cloud-data.ts, heart-space.ts, pointer.ios.ts, simulator-pointer.ios.ts y torso.bin/heart.bin. Consulta el repositorio fijado para registrar la vista y conectar sceneReady. Jolt controla uniforms float/float2/float3; SceneKit renderiza la nube. Conserva detección en la pose animada, relojes separados de latido/toque, condiciones de renderizado, movimiento reducido, suspensión/reanudación y limpieza de listeners, propiedades y scopes. Hover en simulador usa un helper Swift de desarrollo; no es entrada táctil de teléfono. Conserva BodyParts3D © DBCLS CC BY 4.0 y MakeHuman CC0. La receta no incluye renderizador Android ni Web.

## Código e integración

- [src/App.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/App.vue)
- [src/components/WelcomeOverlay.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/components/WelcomeOverlay.vue)
- [src/scene/shaders.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/shaders.ts)
- [src/scene/anatomy.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/anatomy.ts)
- [src/scene/cloud-data.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/cloud-data.ts)
- [src/scene/heart-space.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/heart-space.ts)
- [src/scene/pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/pointer.ios.ts)
- [src/scene/simulator-pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/simulator-pointer.ios.ts)
- [src/assets/anatomy](https://github.com/rafaelaugustos/vena-ns/tree/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/assets/anatomy)
- [README.md](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/README.md)

## Créditos {#credits}

Corazón: BodyParts3D © The Database Center for Life Science (DBCLS), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), preparado por OrganUI. Vena muestreó el exterior en 40 mil puntos, omitió cavidades, cambió escala, posición y colores y añadió deformación e iluminación artísticas. Torso: MakeHuman hm08, CC0; posado, recortado y muestreado en 160 mil puntos. El sitio recorta y comprime la grabación y recorta fotogramas; no modifica recursos anatómicos. [Créditos completos, fuentes y cambios](/media/vena-attribution.txt). DBCLS no respalda esta demo.

## El sitio en movimiento

<Clip name="vena-site-chromium" :width="960" caption="Chromium en macOS arm64: movimiento al desplazar el destaque Vena, reproducción nativa, showcase y dos recetas con copia de código y prompt. Grabación del navegador a velocidad original; el vídeo iOS integrado es del creador, en inglés, con dispositivo no especificado. La lista comunitaria usa una respuesta local vacía para la revisión." />
