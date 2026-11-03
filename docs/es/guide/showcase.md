---
pageClass: showcase-page
sidebar: false
aside: false
prev: false
next: false
---

<div class="showcase-intro">
  <p class="showcase-kicker">HECHO CON JOLT</p>

# Pequeños detalles. Apps que destacan.

Explora el movimiento en apps nativas hechas con Jolt. Mira las grabaciones, descubre los recursos y comparte lo que has creado.

<a class="showcase-submit-link" href="#submit-app">Envía tu app <span aria-hidden="true">↗</span></a>
</div>

<section class="showcase-feature" aria-labelledby="morrow">
  <div class="showcase-copy">
    <p class="showcase-kicker">PROYECTO DESTACADO <span class="showcase-platform">iOS · NativeScript + Jolt</span></p>
    <h2 id="morrow">Morrow<span>.</span></h2>
    <p class="showcase-lead">Música para sentir. Un reproductor de vinilo táctil, una página de artista expresiva y una transición hacia el vídeo.</p>
    <p class="showcase-note">Creado por Rafael Augusto con NativeScript y Jolt. El creador proporcionó esta grabación de la aplicación real. Dispositivo y disponibilidad pública no especificados.</p>
  </div>
  <div class="showcase-stage showcase-morrow-stage">
    <Clip name="morrow-native-ios" :width="280" caption="Morrow en iOS: grabación del creador con apertura animada, página de artista, reproductor de vinilo, búsqueda en la pista y transición a vídeo. Tiempo original, codificado a 60 fps; se omiten los primeros 2,4 segundos de la pantalla de inicio. Dispositivo no especificado; no mide el rendimiento de un dispositivo físico." />
  </div>
</section>

<section class="showcase-feature" aria-labelledby="jolt-car">
  <div class="showcase-copy">
    <p class="showcase-kicker">APP DESTACADA <span class="showcase-platform">iOS · SceneKit</span></p>
    <h2 id="jolt-car">Jolt Car<span>.</span></h2>
    <p class="showcase-lead">Un garaje en el que puedes entrar. Gira el coche, explora la cabina y siente cómo responde cada control.</p>
    <ul class="showcase-points">
      <li><a href="./rolling">Números animados</a> para las millas y el porcentaje.</li>
      <li>Una cámara <a href="./scene-camera">SceneKit</a> para el coche, la cabina y la calle.</li>
      <li><a href="./press">Pulsación</a> y resortes en los controles.</li>
    </ul>
    <p class="showcase-note">Ejemplo local. La carga, el clima y el recorrido se ejecutan en el teléfono. El modelo detallado pertenece a la vista previa de <code>jolt-car</code> y no está incluido en este repositorio.</p>
  </div>
  <div class="showcase-stage">
    <Clip name="film-car-ios" :width="260" caption="Jolt Car en un simulador dedicado de iPhone 17, iOS 26.2. Toques y arrastre reales mediante XCTest: entrada, órbita de cámara, cabina, carga, temperatura y faros. Velocidad original. Interfaz de ejemplo local; no se contacta con ningún vehículo ni servicio real. La vibración no se puede sentir en una grabación." />
  </div>
</section>

## Dentro de la experiencia

De la cámara a los controles: mira los detalles en movimiento.

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>Entra en la cabina</h3><p>Una nueva perspectiva, guiada por el tacto.</p></div>
    <Clip name="film-impulse-cabin-ios" caption="Jolt Car en un simulador de iPhone 17, iOS 26.2. La interacción real de XCTest con el control del clima mueve la cámara nativa SceneKit al interior de la cabina y luego al exterior. Sin cortes, a velocidad original. El coche es una interfaz de ejemplo local y no controla ningún vehículo físico. SceneKit solo está disponible en iOS; la vibración no se puede sentir en una grabación." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>Por Congress Avenue</h3><p>Un paseo por Austin desde el asiento del conductor.</p></div>
    <Clip name="jolt-car-drive-ios" caption="Grabación de la app iOS Jolt Car. La cabina vacía sigue una ruta programada hacia el norte por Congress Avenue, en Austin, y espera en 5th and Congress. La velocidad y la hora de llegada avanzan en pantalla. Interfaz de ejemplo local; no se contacta con ningún vehículo ni servicio real. No es una medición de rendimiento en un dispositivo físico." />
  </article>
</div>

## Tu app puede estar aquí {#submit-app}

<ShowcaseBoard />
