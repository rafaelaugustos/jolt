---
pageClass: showcase-page
sidebar: false
aside: false
prev: false
next: false
---

<div class="showcase-intro">
  <p class="showcase-kicker">MADE WITH JOLT</p>

# Small details. Standout apps.

Explore motion in native apps built with Jolt. Watch the recordings, discover the features, and share what you’ve made.

<a class="showcase-submit-link" href="#submit-app">Submit your app <span aria-hidden="true">↗</span></a>
</div>

<section class="showcase-feature" aria-labelledby="morrow">
  <div class="showcase-copy">
    <p class="showcase-kicker">FEATURED PROJECT <span class="showcase-platform">iOS · NativeScript + Jolt</span></p>
    <h2 id="morrow">Morrow<span>.</span></h2>
    <p class="showcase-lead">Music, with feeling. A tactile vinyl player, an expressive artist page and a transition into video.</p>
    <p class="showcase-note">Built by Rafael Augusto with NativeScript and Jolt. The creator supplied this recording of the real application. Capture device and public availability are not specified.</p>
  </div>
  <div class="showcase-stage showcase-morrow-stage">
    <Clip name="morrow-native-ios" :width="280" caption="Morrow on iOS: creator-provided recording of the animated opening, artist page, vinyl player, track seeking and video transition. Original playback timing, encoded at 60 fps; the first 2.4 seconds showing the system home screen are omitted. Capture device is unspecified; not a physical-device performance measurement." />
  </div>
</section>

<section class="showcase-feature" aria-labelledby="jolt-drive">
  <div class="showcase-copy">
    <p class="showcase-kicker">FEATURED APP <span class="showcase-platform">iOS · SceneKit</span></p>
    <span id="jolt-car" aria-hidden="true"></span>
    <h2 id="jolt-drive">Jolt Drive<span>.</span></h2>
    <p class="showcase-lead">A garage you can walk into. Turn the car, explore the cabin, and feel every control respond.</p>
    <ul class="showcase-points">
      <li><a href="./rolling">Rolling numbers</a> for the miles and the percent.</li>
      <li>A <a href="./scene-camera">SceneKit</a> camera for the car, the cabin and the street.</li>
      <li><a href="./press">Press</a> and springs on the controls.</li>
    </ul>
    <p class="showcase-note">Built by Rafael Augusto with NativeScript-Vue, Jolt and Vue Router NS. A SceneKit garage, native controls and a MapKit route. Battery, climate and pickup are simulated; the app does not connect to a real vehicle.</p>
    <div class="showcase-project-links"><a href="https://github.com/rafaelaugustos/jolt-drive">View on GitHub ↗</a><a href="https://github.com/rafaelaugustos/jolt-drive#run-it">Run the project ↗</a></div>
  </div>
  <div class="showcase-stage">
  <Clip name="jolt-drive-entrance-ios" :width="280" caption="Jolt Drive on iOS: the garage entrance from the project’s published GIF, converted to MP4 with every frame timestamp preserved. Capture device unspecified; this preview does not measure rendering performance." />
</div>
</section>

<div class="drive-screens">
  <figure><img src="/media/jolt-drive-garage.png" width="368" height="800" loading="lazy" alt="Jolt Drive garage with a 3D car, range and quick controls" /><figcaption><span>01</span>The garage</figcaption></figure>
  <figure><img src="/media/jolt-drive-cockpit.png" width="368" height="800" loading="lazy" alt="Jolt Drive cockpit with charge targets, climate and atmosphere controls" /><figcaption><span>02</span>The cockpit</figcaption></figure>
  <figure><img src="/media/jolt-drive-pickup.png" width="368" height="800" loading="lazy" alt="Jolt Drive simulated pickup through Austin, with pause and route controls" /><figcaption><span>03</span>Through Austin</figcaption></figure>
</div>
<p class="showcase-note">Screens from the published project. <a href="https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/README.md">Source and setup ↗</a></p>

## Inside the experience

These preserved recordings show earlier Jolt Car builds. The entrance and screenshots above come from the published Jolt Drive project.

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>Garage and controls</h3><p>Orbit the car and try the native controls.</p></div>
    <Clip name="film-car-ios" :width="260" caption="Jolt Car on a dedicated iPhone 17 simulator, iOS 26.2. Actual XCTest taps and drag: entrance, camera orbit, cockpit, charging, temperature and headlights. Original timing. Local sample UI; no real vehicle or service is contacted. Haptics cannot be felt in a recording." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>Step inside</h3><p>A new perspective, guided by touch.</p></div>
  <Clip name="film-impulse-cabin-ios" caption="Jolt Car on an iPhone 17 simulator, iOS 26.2. Actual XCTest interaction with the climate control moves the native SceneKit camera into the cabin and back outside. Uncut at 1×. The car is local sample UI and controls no physical vehicle. SceneKit is iOS-only; haptics cannot be felt in a recording." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>03</span><h3>Down Congress Avenue</h3><p>A ride through Austin, from the driver’s seat.</p></div>
  <Clip name="jolt-car-drive-ios" caption="Recording of the Jolt Car iOS app. The empty cabin follows a scripted route north on Congress Avenue in Austin and waits at 5th and Congress. Speed and the arrival clock run on screen. Local sample UI; no real vehicle or service is contacted. Not a physical-device performance measurement." />
  </article>
</div>

## Your app belongs here {#submit-app}

<ShowcaseBoard />
