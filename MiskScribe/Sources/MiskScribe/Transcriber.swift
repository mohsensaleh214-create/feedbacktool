import Foundation
import WhisperKit

enum TranscriberError: LocalizedError {
    case notReady

    var errorDescription: String? { "The speech model hasn't finished loading yet." }
}

/// Turns recorded audio into text using Whisper, running entirely on this Mac.
actor Transcriber {
    private var whisper: WhisperKit?

    /// Models are kept in ~/Library/Application Support/Misk Scribe/Models rather than
    /// WhisperKit's default of ~/Documents, which would trigger a Documents
    /// folder permission prompt.
    static var modelsFolder: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(Brand.name, isDirectory: true)
            .appendingPathComponent("Models", isDirectory: true)
    }

    /// Downloads the model on first launch (the app's only internet use), then
    /// loads it. Returns the model's name. WhisperKit picks the best model this
    /// particular Mac can run comfortably, so every Mac gets a sensible choice.
    func load() async throws -> String {
        let model = Self.chooseModel()
        try FileManager.default.createDirectory(at: Self.modelsFolder, withIntermediateDirectories: true)
        let config = WhisperKitConfig(
            model: model,
            downloadBase: Self.modelsFolder,
            verbose: false,
            prewarm: true,
            load: true,
            download: true
        )
        whisper = try await WhisperKit(config)
        return model
    }

    /// WhisperKit's pick for this Mac, except on 8 GB Macs (e.g. many 2023
    /// MacBook Airs), where the compressed ~600 MB version of the same model is
    /// used if available: nearly as accurate, half the download and memory.
    private static func chooseModel() -> String {
        let support = WhisperKit.recommendedModels()
        let eightGigabytes: UInt64 = 8 * 1024 * 1024 * 1024
        guard ProcessInfo.processInfo.physicalMemory <= eightGigabytes else {
            return support.default
        }
        let compact = support.supported.first {
            $0.hasPrefix(support.default) && $0.hasSuffix("MB")
        }
        return compact ?? support.default
    }

    func transcribe(_ samples: [Float]) async throws -> String {
        guard let whisper else { throw TranscriberError.notReady }
        let options = DecodingOptions(
            language: "en",
            skipSpecialTokens: true,
            withoutTimestamps: true
        )
        let results = try await whisper.transcribe(audioArray: samples, decodeOptions: options)
        return results
            .map(\.text)
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
