# Mobile Web acceptance

The maintainer selected simulator/emulator acceptance for this delivery. These are actual Safari and Chrome interactions with their software keyboards; no synthetic sensor events were sent. The candidate keyboard fixes are not published in RC.10.

<Clip name="web-mobile-ios" caption="Safari 26.2 · iPhone 17 simulator, iOS 26.2. Actual keyboard input, rotation, permission request, pause/resume and disposal. Motion permission is granted but no readings arrive, so both sources settle as unavailable. Haptics are unavailable. English UI, original speed." />

<Clip name="web-mobile-android" caption="Chrome 133 · Android API 36 emulator. Actual software keyboard, interface rotation, pause/resume and disposal. Rotation/gravity readings come from the emulator; a vibration request does not establish physical vibration. English UI, original speed." />

## Keyboard contract

An exposed VirtualKeyboard object with an empty rectangle does not prove an active geometry backend. Unless overlaysContent is enabled by the app or a nonempty rectangle is reported, Jolt uses VisualViewport. It never changes the app’s overlaysContent setting.

When the browser resizes both viewports, visibility is estimated from the resting height while covered height remains zero. This prevents double lifting. Browser panning changes bottom coverage without making an open keyboard disappear. Rotation invalidates the height baseline. VisualViewport estimates cannot distinguish every focused desktop-window resize from a keyboard.

## Reproduce and inspect

[Protocol and raw reports](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/web-mobile).

```sh
node benchmarks/web-mobile/server.mjs
python3 benchmarks/web-mobile/android.py YOUR_EMULATOR /tmp/jolt-mobile-android
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/jolt-mobile-ios testMobileBrowser
```

[Keyboard API](keyboard.md) · [Parity inventory](web-parity.md)
