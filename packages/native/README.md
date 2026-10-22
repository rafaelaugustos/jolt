# Jolt native property runtime

Optional NativeScript plugin for `@rafaelaugusto/jolt/native`. Install this package alongside Jolt and rebuild the app. Core Jolt does not depend on this plugin.

```sh
npm install @rafaelaugusto/jolt @rafaelaugusto/jolt-native
```

Includes compiled scalar/compound playback, MapKit and SceneKit sinks on iOS, and a MapLibre sink on Android. It does not install MapLibre; the app chooses its SDK version. Reference demo: MapLibre Android 11.8.0, NativeScript 9.1, iOS 26 / Android 16. Minimum NativeScript 8.9; native helper APIs require iOS 13+ / Android API 23+ (the app/runtime or SDK may require newer).

See the [native properties guide](https://jolt.rafaelaugusto.dev/guide/native-properties) for capabilities, authoring, ownership and execution limits.

Release maintainers: publish this optional package together with compatible core releases (`npm publish` from this directory). Build and pack the core at the repository root. The demo uses local file dependencies and never needs the package published for validation.
