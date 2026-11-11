# Standalone SwiftUI acceptance

This app consumes the repository's Swift Package, with no JavaScript or NativeScript dependency. The same source builds iOS 17+ and macOS 14+ targets. The actual reviewed runs use an iPhone 17 Pro / iOS 27.0 simulator and macOS 26.6.2 on Apple Silicon; neither is a performance comparison.

Install the `xcodeproj` Ruby gem, then generate the development project:

```sh
ruby benchmarks/swiftui-demo/project.rb
swift test
npm run build
npm run swiftui:check
```

To build the apps against the package SwiftPM users download, generate it and point the project at it. CI and the Release workflow run the UI cases this way:

```sh
npm run swift:package -- /tmp/jolt-swift
JOLT_SWIFT_PACKAGE=/tmp/jolt-swift ruby benchmarks/swiftui-demo/project.rb
```

Run XCTest against an explicitly selected simulator or the Mac:

```sh
xcodebuild test -project benchmarks/swiftui-demo/JoltSwiftUIDemo.xcodeproj -scheme JoltSwiftUIDemo -destination 'platform=iOS Simulator,id=YOUR_UUID' -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO
xcodebuild test -project benchmarks/swiftui-demo/JoltSwiftUIDemo.xcodeproj -scheme JoltSwiftUIMac -destination 'platform=macOS,arch=arm64' -parallel-testing-enabled NO
```

The Mac uses local ad-hoc signing. Its sandboxed test runner exchanges recorder acknowledgements in its own temporary directory. Capture actual test interaction after launch, with a unique output directory:

```sh
python3 benchmarks/swiftui-demo/record.py YOUR_UUID /tmp/jolt-swiftui-ios-review
python3 benchmarks/swiftui-demo/record.py macos /tmp/jolt-swiftui-mac-review
```

`testActivityExpansion` (`--activity-lab`) opens a second `WindowGroup` window, windows hosted by `NSHostingView` and `NSHostingController`, the `Settings` scene and a `MenuBarExtra` window, and records in the result bundle the scene phase and Jolt activity each one reads while another is key, minimized or covered, plus pointer follow while Finder is frontmost.

The macOS recorder requires screen-recording access and selects only the `JoltSwiftUIMac` window. The iOS recorder selects only the supplied simulator. Decode and visually inspect the resulting MP4 before copying it into documentation. The recording does not assert exact pause/resume, complete Jolt parity or real-device performance. Shared recipe definitions are compiled into `JoltCore` from `Definitions.swift`, which `scripts/generate-swiftui-definitions.mjs` writes; `npm run swiftui:check` fails when the checked-in file differs from the generator. `benchmarks/swiftui-demo/cli/run.sh` builds a release executable against the package and runs it from a directory that holds only that file.
