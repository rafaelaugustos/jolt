// swift-tools-version: 6.0
import Foundation
import PackageDescription

let jolt = Context.environment["JOLT_SWIFT_PACKAGE"] ?? "../../.."
let identity = URL(fileURLWithPath: jolt, relativeTo: URL(fileURLWithPath: Context.packageDirectory))
    .standardizedFileURL.lastPathComponent.lowercased()
let package = Package(
    name: "JoltCLI",
    platforms: [.macOS(.v14)],
    dependencies: [.package(path: jolt)],
    targets: [
        .executableTarget(
            name: "JoltCLI",
            dependencies: [.product(name: "JoltSwiftUI", package: identity)]
        )
    ]
)
