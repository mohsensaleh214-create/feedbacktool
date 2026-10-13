import Foundation
import WhisperKit

enum TranscriberError: LocalizedError {
    case notReady

    var errorDescription: String? { "The speech model hasn't finished loading yet." }
}

/// Turns recorded audio into text using Whisper, running entirely on this Mac.
actor Transcriber {
    private var whisper: WhisperKit?

    /// Models are kept in ~/Library/Application Support/Murmur/Models rather than
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
        let model = WhisperKit.recommendedModels().default
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
