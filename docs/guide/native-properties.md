# External native properties

Animate a map coordinate or a SceneKit camera without writing a JavaScript frame loop. The optional `@rafaelaugusto/jolt/native` entry supplies a property registry, compiled native playback and reference adapters. Importing the main JavaScript entry does not initialize this registry or load a map SDK.

<Clip name="native-map-ios" caption="MapKit annotation and camera, paused and resumed together on an iOS simulator. Native property writes; real-time playback." />
<Clip name="native-map-android" caption="MapLibre 11.8.0 marker and camera on an Android emulator. The map SDK is a demo dependency; native property writes, real-time playback." />
<Clip name="native-camera-ios" caption="A real SceneKit camera changes position and orientation, pauses and continues on an iOS simulator. This adapter is iOS-only." />

## Optional installation

Install `@rafaelaugusto/jolt-native` alongside Jolt and rebuild the native application. The JavaScript registry lives in the `/native` entry; compiled sources and MapKit/SceneKit framework linkage live exclusively in this optional plugin. Apps with only the main package do not include those helpers. Creating a property without the plugin reports an explicit error.

```sh
npm install @rafaelaugusto/jolt @rafaelaugusto/jolt-native
```

MapLibre remains a separate Android app dependency. The demo uses a local development plugin to pin SDK 11.8.0; `npm install` in `demo` installs both local plugins.

## Using an adapter

```ts
import { timeline } from '@rafaelaugusto/jolt'
import { mapKitCoordinate, mapKitCamera } from '@rafaelaugusto/jolt/native'

const marker = mapKitCoordinate(annotation) // MKAnnotation with a writable coordinate
const camera = mapKitCamera(mapView) // MKMapView
const scene = timeline([
  {
    at: 0,
    run: () =>
      marker.animate(
        { latitude: 37.78, longitude: -122.415 },
        { duration: 4000, ease: 'linear' },
      ),
  },
  {
    at: 0,
    run: () =>
      camera.animate(
        {
          latitude: 37.78,
          longitude: -122.415,
          altitude: 1300,
          pitch: 45,
          heading: 50,
        },
        { duration: 4000, ease: 'sineInOut' },
      ),
  },
])
scene.pause()
scene.play()
// Before destroying/replacing the native targets:
scene.stop()
marker.dispose()
camera.dispose()
```

Each property has `get()`, `set(value)`, `animate(to, transition)`, `bind(value, map)`, `stop()` and `dispose()`. `animate()` returns a `PlaybackAnimation`, including pause, play, finite progress and completion. Wrappers for the same native object and registered property share interruption ownership. Stopping or disposing an older wrapper does not stop a newer wrapper's work. Disposing a wrapper is terminal and must happen before its SDK target is destroyed.

```ts
const release = marker.bind(progress, (p) => ({
  latitude: 37.772 + p * 0.008,
  longitude: -122.423 + p * 0.008,
}))
// progress can be a motion value or playbackProgress(animation).
// map runs while sampling a track, not on every native frame.
release()
```

Mappings must be pure: do not perform side effects or read changing application state inside them. Jolt samples them at setup and source changes, using up to 60 samples per second (capped at 6000 uniform intervals, plus existing keyframes). Changes to the source rebuild its native binding. Gesture events and composition-window rebuilds retain the [motion value execution limits](./motion-values); this does not turn arbitrary JavaScript input into a native source.

## Supported targets and units

| Adapter              | Target                             | Value                                                          | Platform |
| -------------------- | ---------------------------------- | -------------------------------------------------------------- | -------- |
| `mapKitCoordinate`   | Writable `MKAnnotation`            | `{ latitude, longitude }`, degrees                             | iOS      |
| `mapKitCamera`       | `MKMapView`                        | Coordinate, `altitude` in meters, `pitch`/`heading` in degrees | iOS      |
| `mapLibreCoordinate` | MapLibre `Marker`                  | `{ latitude, longitude }`, degrees                             | Android  |
| `mapLibreCamera`     | MapLibre `MapLibreMap`             | Coordinate, `zoom` level, `tilt`/`bearing` in degrees          | Android  |
| `sceneKitPose`       | `SCNNode`, including a camera node | `{ position: [x,y,z], orientation: [x,y,z,w] }`                | iOS      |

The core package retains its NativeScript 8.9+ minimum; reference demos are checked with NativeScript 9.1 on iOS 26 and Android 16. MapLibre is optional and must be added to the application separately; the demo pins `org.maplibre.gl:android-sdk:11.8.0`. This is not a claim of support for every version or map plugin. SceneKit has no Android adapter. A compiled Android renderer integration can implement the same property contract.

Coordinates use linear latitude and shortest-longitude interpolation, including crossing ±180°. This is a local route approximation, not a geodesic or constant ground speed. Headings take the shortest angle. MapKit altitude and MapLibre zoom are different units. MapKit pitch is 0–80°, MapLibre tilt 0–60° and zoom 0–24; the SDK can further constrain the camera. MapLibre clamps latitude to its Mercator projection limit. Compound coordinates and camera state are written together.

Scene poses use unit-quaternion shortest-path interpolation and native normalization between sampled keyframes. Position uses scene units. The adapter reads the [presentation node](https://developer.apple.com/documentation/scenekit/scnnode/presentation) when interrupted and writes with implicit actions disabled. Remove competing SceneKit constraints/actions from the properties Jolt owns. MapKit uses [`setCamera(..., animated: false)`](<https://developer.apple.com/documentation/mapkit/mkmapview/setcamera(_:animated:)>) and MapLibre uses an immediate camera update, avoiding a second SDK easing curve. Stop the property when handing control back to a user's map gesture or another renderer controller.

## Registering a property

```ts
const reveal = registerNativeProperty<number>({
  name: 'acme.chart/reveal',
  units: ['fraction'],
  platforms: ['ios', 'android'],
  encode: (n) => [n],
  decode: (components) => components[0],
  create: (chart) => createCompiledChartSink(chart),
})
const amount = reveal(nativeChart)
amount.animate(1, 'snappy')
```

`createCompiledChartSink` is supplied by the plugin. Implement `JoltPropertySink` in Objective-C/Swift or `org.rafaelaugusto.jolt.PropertySink` in Java/Kotlin. Its native `read()`/`write()` use finite numeric vectors matching `units`; the sink owns a weak target and reports whether it is alive. Implement compound writes atomically. The included scalar factories support a numeric Objective-C key path or a float/double JavaBean getter/setter. The registry rejects duplicate names, unsupported platforms, invalid vectors and JavaScript-generated sink implementations. Custom `validate` and `interpolate` functions execute while preparing samples.

The provided player writes on the native main/UI thread. A renderer requiring a different queue must marshal safely in its compiled sink and define how presentation reads synchronize; it must not dispatch a JavaScript setter per frame. This API offers no implicit JavaScript fallback. Native helper sources are packaged separately in `@rafaelaugusto/jolt-native`; application SDK dependencies remain optional.

Spatial adapters declare `spatial: true` and jump to the destination under reduced motion. Generic scalar properties retain timing. Additive adapter layers are unsupported; bind a [layered scalar motion value](./motion-values#layers-on-a-value) when appropriate. A quaternion pose does not acquire scalar additive semantics.

## Validation and cleanup

The native demo's **Run native checks** runs the compiled `reveal` custom-view fixture through tween, spring, pause/seek/resume, shared-value bindings, layers, progress observation, timeline scheduling, interruption and disposal on both platforms. It checks native player counts and verifies native bindings request no JavaScript observation frames. Unit tests cover registry validation, compound sampling, angles and quaternion behavior. Plugin authors should run the same scenarios against their own sink and SDK, including SDK destruction and app background/foreground.

Use `scope.add(property.animate(...))` and `scope.use(() => property.bind(...))` for ownership. Dispose the property at the target's actual destruction boundary. Scene callbacks delivered by `subscribe()` still execute in JavaScript. Native property writes run on the UI thread, so main-thread JavaScript can delay them; see [Android performance](./android-performance). Native playback is not a promise of isolation from a busy UI thread.

The compiled example lives in `demo/native-fixture`, and its reusable suite in `benchmarks/playback-adapters.ts`. It also checks scope ownership, target invalidation, slow motion and sampling while JavaScript is busy.

To migrate from `value.subscribe(n => nativeTarget.setValue(n))`, register a compiled sink and use `property.bind(value, n => n)`. Keep and call the release function at the same lifecycle boundary as the previous unsubscribe.

The wrapper preserves target identity until `dispose()`, which also releases its JavaScript reference. The native sink uses a weak reference. Dispose before destroying the SDK object; garbage collection is not a replacement for explicit lifecycle ownership.
