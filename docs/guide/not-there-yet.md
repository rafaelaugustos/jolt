# Not there yet

- [Layout changes](./layout), [drag constraints](./drag), [motion values](./motion-values), [observable playback](./playback) and [joint timeline controls](./sequences) are available. They have different native execution and lifecycle contracts; see their guides.
- Shared element transitions between screens remain planned ([#24](https://github.com/rafaelaugustos/jolt/issues/24)).
- General-purpose multi-finger gesture composition remains outside `drag()`; [photo zoom](./photo-zoom) provides its own pinch, pan and dismissal controller.
- [External property adapters](./native-properties) require an optional native plugin. Camera pose and [light/solid-material adapters](./scene-lighting) use SceneKit on iOS; there is no bundled Android 3D renderer adapter. MapKit and MapLibre camera units are distinct.
- [SceneKit camera FOV](./scene-camera) is available for automatic perspective cameras on iOS. Orthographic-scale and arbitrary lens controls remain outside that adapter.
- Timelines pause and resume their participants, but do not offer arbitrary aggregate scrubbing of callbacks or one-shot effects. Native writes do not isolate a renderer from main-thread JavaScript.

The [issues](https://github.com/rafaelaugustos/jolt/issues) track upcoming work and integrations.
