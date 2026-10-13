// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "MiskScribe",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [
        // WhisperKit: runs OpenAI's Whisper speech model on-device via Core ML.
        .package(url: "https://github.com/argmaxinc/argmax-oss-swift.git", from: "0.17.0")
    ],
    targets: [
        .executableTarget(
            name: "MiskScribe",
            dependencies: [
                .product(name: "WhisperKit", package: "argmax-oss-swift")
            ],
            path: "Sources/MiskScribe"
        )
    ]
)
