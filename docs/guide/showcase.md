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

<section class="showcase-feature" aria-labelledby="jolt-car">
  <div class="showcase-copy">
    <p class="showcase-kicker">FEATURED APP <span class="showcase-platform">iOS · SceneKit</span></p>
    <h2 id="jolt-car">Jolt Car<span>.</span></h2>
    <p class="showcase-lead">A garage you can walk into. Turn the car, explore the cabin, and feel every control respond.</p>
    <ul class="showcase-points">
      <li><a href="./rolling">Rolling numbers</a> for the miles and the percent.</li>
      <li>A <a href="./scene-camera">SceneKit</a> camera for the car, the cabin and the street.</li>
      <li><a href="./press">Press</a> and springs on the controls.</li>
    </ul>
    <p class="showcase-note">Local sample. Charge, climate and the drive stay on the phone. The detailed model is the <code>jolt-car</code> preview and stays out of this repository.</p>
  </div>
  <div class="showcase-stage">
  <Clip name="film-car-ios" :width="260" caption="Jolt Car on a dedicated iPhone 17 simulator, iOS 26.2. Actual XCTest taps and drag: entrance, camera orbit, cockpit, charging, temperature and headlights. Original timing. Local sample UI; no real vehicle or service is contacted. Haptics cannot be felt in a recording." />
</div>
</section>

## Inside the experience

From the camera to the controls: see the details in motion.

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>Step inside</h3><p>A new perspective, guided by touch.</p></div>
  <Clip name="film-impulse-cabin-ios" caption="Jolt Car on an iPhone 17 simulator, iOS 26.2. Actual XCTest interaction with the climate control moves the native SceneKit camera into the cabin and back outside. Uncut at 1×. The car is local sample UI and controls no physical vehicle. SceneKit is iOS-only; haptics cannot be felt in a recording." />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>Down Congress Avenue</h3><p>A ride through Austin, from the driver’s seat.</p></div>
  <Clip name="jolt-car-drive-ios" caption="Recording of the Jolt Car iOS app. The empty cabin follows a scripted route north on Congress Avenue in Austin and waits at 5th and Congress. Speed and the arrival clock run on screen. Local sample UI; no real vehicle or service is contacted. Not a physical-device performance measurement." />
  </article>
</div>

## Your app belongs here {#submit-app}

<ShowcaseBoard />
