# Experimento de composición Web

Este [experimento interno de #280](https://github.com/rafaelaugustos/jolt/issues/280) usa el compilador portátil para reproducir transforms mediante Web Animations API sobre elementos DOM, sin framework. El [runtime Web](./web-runtime) público experimental está disponible desde **0.1.0-rc.5**. La migración de press/reveal de Mavis y el ejemplo compartido de la aplicación siguen en [#236](https://github.com/rafaelaugustos/jolt/issues/236).

<Clip name="web-composition-chromium" :width="720" caption="Chromium 156 en macOS arm64, reproducción real del navegador a velocidad normal. Los botones inician x/y, cambian el destino de x, fijan la escala de la aplicación en 1.1, aplican una contribución de presión de 0.96, cambian la base a 1.2 y sueltan conservando 1.2. Los botones prueban la composición; el reconocimiento completo de presión por puntero/teclado es otra entrega." />

## Qué demuestra la prueba {#what-the-proof-establishes}

Un efecto visual de `transform` combina canales con relojes independientes del navegador. Sustituir `x` conserva los relojes de `y` y de escala. La curva original proporciona posición y velocidad al interrumpir; los tokens de ownership impiden que un callback antiguo modifique a su reemplazo. Pausa, reanudación, seek, delay y descarte se prueban por separado.

La escala de la aplicación y la contribución de presión se multiplican: `1.1 × 0.96 = 1.056`. Cambiar la base durante la presión produce `1.2 × 0.96 = 1.152`; soltar solamente la presión conserva `1.2`. Dos efectos individuales de `translate` con sustitución pierden un eje. La escala aditiva funciona en los navegadores probados, pero las listas de transforms aditivos necesitan un orden explícito. Agrupar es la elección inicial del experimento, sin descartar todas las alternativas.

Las 42 comprobaciones se ejecutan en Chromium, Firefox y WebKit de Playwright. Las muestras con tiempo local explícito comprueban los errores de posición y escala por separado de la velocidad de la curva original. Otra comprobación confirma el avance sin escrituras de estilo por frame en JavaScript. Son pruebas de comportamiento, no mediciones de FPS ni de aceleración del compositor. Las lecturas de estilo en movimiento de WebKit pueden diferir del instante de la timeline; las aserciones precisas usan tiempos alineados explícitamente. Consulta las versiones y límites en la [decisión y evidencias](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-composition.md).

## Política inicial de CSS {#initial-css-policy}

La superficie controla `transform` con el orden fijo `baseline × translate × rotate × scale`, manteniendo el `transform-origin` original. La base puede contener una matriz 2D estática. Se excluyen `translate`, `rotate` y `scale` individuales de CSS, transforms 3D, animaciones/transiciones existentes y transforms inline con `!important`. Los cambios externos de CSS requieren descarte y recreación; no se supervisan cambios arbitrarios de hojas de estilo o variables CSS.

Este ejemplo limitado admite `x`, `y`, `rotate`, `scaleX` y `scaleY`, dos contribuciones y trayectorias finitas de hasta 15 segundos. Los controles públicos, preferencias de accesibilidad, keyframes arbitrarios, opacidad, empaquetado e integración con el lifecycle de frameworks pertenecen al siguiente trabajo del runtime. Aquí no cambia ninguna ruta de ejecución nativa.

## Referencia de composición nativa {#native-composition-reference}

La demostración nativa existente muestra el comportamiento de composición que orienta el trabajo del navegador. Estos vídeos revisados se conservan; no muestran una pantalla Mavis compartida ni el ejemplo Web ejecutándose de forma nativa.

<Clip name="layers-ios" caption="Simulador iOS, demostración nativa existente de Layers en inglés. Movimiento y capas de feedback coexisten en la tarjeta. Es una referencia de composición nativa, no una grabación en dispositivo físico ni el nuevo ejemplo Web." />

<Clip name="layers-android" caption="Emulador Android, demostración nativa existente de Layers en inglés. Movimiento y capas de feedback coexisten en la tarjeta. Es una referencia de composición nativa, no una grabación en dispositivo físico ni el nuevo ejemplo Web." />

## Ejecutar el experimento {#run-the-experiment}

Desde el repositorio, con Node 22:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run web:proof:typecheck
npm run web:proof:test
npm run web:proof
```

Abre `http://127.0.0.1:4280`. Detén ese servidor antes de ejecutar los tests, que inician su propio servidor. El código y las instrucciones de grabación están en `benchmarks/web-composition/`.
