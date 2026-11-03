---
pageClass: showcase-page
motionSite: true
title: Showcase
sidebar: false
aside: false
prev: false
next: false
---

<ShowcaseExperience>

<div class="showcase-intro">
  <p class="showcase-kicker">HECHO CON JOLT</p>

<h1>Apps reales.<br /><em>Para sentir.</em></h1>

Explora el movimiento en apps nativas hechas con Jolt. Mira las grabaciones, descubre los recursos y comparte lo que has creado.

<a class="showcase-submit-link" href="#submit-app">Envía tu app <span aria-hidden="true">↗</span></a>
<nav class="showcase-index" aria-label="Showcase"><a href="#morrow"><span>01</span>Morrow ↗</a><a href="#jolt-drive"><span>02</span>Jolt Drive ↗</a><a href="#hexdrop"><span>03</span>Hexdrop ↗</a><a href="#submit-app"><span>04</span>Tu proyecto ↗</a></nav>
</div>

<section class="showcase-feature" aria-labelledby="morrow">
  <h2 id="morrow">Morrow<span>.</span></h2>
  <div class="showcase-copy">
    <p class="showcase-kicker">PROYECTO DESTACADO <span class="showcase-platform">iOS · NativeScript + Jolt</span></p>
    <p class="showcase-lead">Música para sentir. Un reproductor de vinilo táctil, una página de artista expresiva y una transición hacia el vídeo.</p>
    <p class="showcase-note">Creado por Rafael Augusto con NativeScript y Jolt. El creador proporcionó esta grabación de la aplicación real. Dispositivo y disponibilidad pública no especificados.</p>
    <button type="button" class="showcase-watch" data-watch="morrow">Mira la película <span aria-hidden="true">↗</span></button>
  </div>
  <div class="showcase-stage showcase-morrow-stage">
    <div class="showcase-art" aria-hidden="true"><img src="/media/morrow-artist-ios.jpg" alt="" width="300" height="650" /></div>
    <Clip name="morrow-native-ios" :autoplay="false" poster="/media/morrow-native-ios.jpg" :width="280" caption="Morrow en iOS: grabación del creador con apertura animada, página de artista, reproductor de vinilo, búsqueda en la pista y transición a vídeo. Tiempo original, codificado a 60 fps; se omiten los primeros 2,4 segundos de la pantalla de inicio. Dispositivo no especificado; no mide el rendimiento de un dispositivo físico." />
  </div>
</section>

<section class="showcase-feature" aria-labelledby="jolt-drive">
  <h2 id="jolt-drive">Jolt Drive<span>.</span></h2>
  <div class="showcase-copy">
    <p class="showcase-kicker">APP DESTACADA <span class="showcase-platform">iOS · SceneKit</span></p>
    <span id="jolt-car" aria-hidden="true"></span>
    <p class="showcase-lead">Un garaje en el que puedes entrar. Gira el coche, explora la cabina y siente cómo responde cada control.</p>
    <ul class="showcase-points">
      <li><a href="./rolling">Números animados</a> para las millas y el porcentaje.</li>
      <li>Una cámara <a href="./scene-camera">SceneKit</a> para el coche, la cabina y la calle.</li>
      <li><a href="./press">Pulsación</a> y resortes en los controles.</li>
    </ul>
    <p class="showcase-note">Creado por Rafael Augusto con NativeScript-Vue, Jolt y Vue Router NS. Garaje en SceneKit, controles nativos y ruta en MapKit. La batería, el clima y la recogida son simulados; la app no se conecta a un vehículo real.</p>
    <div class="showcase-project-links"><a href="https://github.com/rafaelaugustos/jolt-drive">Ver en GitHub ↗</a><a href="https://github.com/rafaelaugustos/jolt-drive#run-it">Ejecutar el proyecto ↗</a></div>
    <button type="button" class="showcase-watch" data-watch="jolt-drive">Mira la película <span aria-hidden="true">↗</span></button>
  </div>
  <div class="showcase-stage">
    <Clip name="jolt-drive-entrance-ios" :autoplay="false" poster="/media/jolt-drive-entrance-ios.jpg" :width="280" caption="Jolt Drive en iOS: entrada del garaje del GIF publicado por el proyecto, convertido a MP4 conservando el tiempo de cada fotograma. Dispositivo no especificado; esta vista previa no mide rendimiento." />
  </div>
</section>

<section class="showcase-recipes">

## Lleva el movimiento a tu app

Cuatro recetas del proyecto real: cockpit coordinado, selección de ambiente con resorte, panel de carga con fondo desenfocado y cámara hacia la cabina. Cada una incluye vídeo nativo, código revisado y un prompt de adaptación.

[Explora las 4 recetas](/es/recipes/?q=Jolt%20Drive) · [Lee la guía de integración](./drive-recipes)

</section>

<div class="drive-screens">
  <figure><img src="/media/jolt-drive-garage.png" width="368" height="800" loading="lazy" alt="Garaje de Jolt Drive con coche 3D, autonomía y controles rápidos" /><figcaption><span>01</span>El garaje</figcaption></figure>
  <figure><img src="/media/jolt-drive-cockpit.png" width="368" height="800" loading="lazy" alt="Cockpit de Jolt Drive con carga, climatización y opciones de ambiente" /><figcaption><span>02</span>El cockpit</figcaption></figure>
  <figure><img src="/media/jolt-drive-pickup.png" width="368" height="800" loading="lazy" alt="Recogida simulada de Jolt Drive por Austin, con controles de pausa y ruta" /><figcaption><span>03</span>Por Austin</figcaption></figure>
</div>
<p class="showcase-note">Pantallas del proyecto publicado. <a href="https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/README.md">Fuente e instalación ↗</a></p>

<section class="showcase-feature" aria-labelledby="hexdrop">
  <h2 id="hexdrop"><img class="hexdrop-app-icon" src="/media/hexdrop-icon.png" width="72" height="72" alt="" />Hexdrop<span>.</span></h2>
  <div class="showcase-copy">
    <p class="showcase-kicker">NATIVESCRIPT-VUE + JOLT RC.11 <span class="showcase-platform">iOS</span></p>
    <p class="showcase-lead">Un archivo. Un poco de magia. Suelta un ingrediente, despierta la poción verde y mira cómo una arañita viaja en el tapón.</p>
    <p class="showcase-note">Creado por Rafael Augusto con NativeScript-Vue y Jolt RC.11. Vistas nativas, trazados vectoriales, gradientes y partículas. Es una demo local; no se sube ningún archivo. La ejecución en Android no se ha verificado.</p>
    <div class="showcase-project-links"><a href="https://github.com/rafaelaugustos/hexdrop">Ver el proyecto ↗</a><a href="/es/recipes/hexdrop-drag">Obtener la receta del gesto ↗</a><a href="/es/recipes/hexdrop-launch">Un hechizo de apertura. ↗</a></div>
    <button type="button" class="showcase-watch" data-watch="hexdrop">Ver la magia <span aria-hidden="true">↗</span></button>
  </div>
  <div class="showcase-stage">
    <Clip name="hexdrop-creator-ios" :autoplay="false" poster="/media/hexdrop-creator-ios.jpg" :width="280" caption="Hexdrop en iOS: grabación del creador con apertura animada, arrastre, preparación, selector de documentos y repetición. Velocidad original, sin audio; se omiten los primeros 3,8 segundos de la pantalla de inicio y transición del sistema. Dispositivo no especificado. Demo local; no se suben archivos." />
  </div>
</section>

<section class="showcase-archive">

## Dentro de la experiencia

Estas grabaciones conservadas muestran versiones anteriores de Jolt Car. La entrada y las pantallas de arriba pertenecen al proyecto publicado como Jolt Drive.

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>Garaje y controles</h3><p>Gira el coche y prueba los controles nativos.</p></div>
    <Clip name="film-car-ios" :autoplay="false" poster="/media/film-car-ios.jpg" :width="260" caption="Jolt Car en un simulador dedicado de iPhone 17, iOS 26.2. Toques y arrastre reales mediante XCTest: entrada, órbita de cámara, cabina, carga, temperatura y faros. Velocidad original. Interfaz de ejemplo local; no se contacta con ningún vehículo ni servicio real. La vibración no se puede sentir en una grabación." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>Entra en la cabina</h3><p>Una nueva perspectiva, guiada por el tacto.</p></div>
    <Clip name="film-impulse-cabin-ios" :autoplay="false" poster="/media/film-impulse-cabin-ios.jpg" caption="Jolt Car en un simulador de iPhone 17, iOS 26.2. La interacción real de XCTest con el control del clima mueve la cámara nativa SceneKit al interior de la cabina y luego al exterior. Sin cortes, a velocidad original. El coche es una interfaz de ejemplo local y no controla ningún vehículo físico. SceneKit solo está disponible en iOS; la vibración no se puede sentir en una grabación." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>03</span><h3>Por Congress Avenue</h3><p>Un paseo por Austin desde el asiento del conductor.</p></div>
    <Clip name="jolt-car-drive-ios" :autoplay="false" poster="/media/jolt-car-drive-ios.jpg" caption="Grabación de la app iOS Jolt Car. La cabina vacía sigue una ruta programada hacia el norte por Congress Avenue, en Austin, y espera en 5th and Congress. La velocidad y la hora de llegada avanzan en pantalla. Interfaz de ejemplo local; no se contacta con ningún vehículo ni servicio real. No es una medición de rendimiento en un dispositivo físico." />
  </article>
</div>

</section>

<section class="showcase-community">

## Tu app puede estar aquí {#submit-app}

<ShowcaseBoard />

</section>
</ShowcaseExperience>
