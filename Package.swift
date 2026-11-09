// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Jolt",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "JoltSwiftUI", targets: ["JoltSwiftUI"])],
    targets: [
        .target(name: "JoltCore", path: "packages/swiftui/Sources/JoltCore", resources: [.process("Resources")]),
        .target(name: "JoltSwiftUI", dependencies: ["JoltCore"], path: "packages/swiftui/Sources/JoltSwiftUI"),
        .testTarget(name: "JoltSwiftUITests", dependencies: ["JoltSwiftUI"], path: "packages/swiftui/Tests/JoltSwiftUITests"),
        .testTarget(name: "JoltCoreTests", dependencies: ["JoltCore"], path: "packages/swiftui/Tests/JoltCoreTests", resources: [.process("Fixtures")])
    ]
)
