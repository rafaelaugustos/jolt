# Not there yet

- [Real width/height/auto transitions](./size) are available for StackLayout/GridLayout, including inside ScrollView. They run JS layout per frame; flex allocation, recycled cells and shared elements are outside that API.

- [Layout changes](./layout), [drag constraints](./drag), [motion values](./motion-values), [observable playback](./playback) and [joint timeline controls](./sequences) are available. They have different native execution and lifecycle contracts; see their guides.
- [Shared navigation](./shared-navigation) and [shared gestures](./shared-gestures) are available in this checkout for the next beta on stable pages. Recycled/offscreen target resolution and the complete gallery remain tracked by [#24](https://github.com/rafaelaugustos/jolt/issues/24).
- General-purpose multi-finger gesture composition remains outside `drag()`; [photo zoom](./photo-zoom) provides its own pinch, pan and dismissal controller.
- [External property adapters](./native-properties) require an optional native plugin. Camera pose and [light/solid-material adapters](./scene-lighting) use SceneKit on iOS; there is no bundled Android 3D renderer adapter. MapKit and MapLibre camera units are distinct.
- [SceneKit camera FOV](./scene-camera) is available for automatic perspective cameras on iOS. Orthographic-scale and arbitrary lens controls remain outside that adapter.
- Timelines pause and resume their participants, but do not offer arbitrary aggregate scrubbing of callbacks or one-shot effects. Native writes do not isolate a renderer from main-thread JavaScript.

The [issues](https://github.com/rafaelaugustos/jolt/issues) track upcoming work and integrations.
