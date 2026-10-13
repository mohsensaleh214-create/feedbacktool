import AVFoundation

enum RecorderError: LocalizedError {
    case noMicrophone

    var errorDescription: String? {
        "No microphone found. Plug in or connect a microphone and try again."
    }
}

/// Records from the default microphone into memory as 16 kHz mono samples,
/// which is the format Whisper expects. Nothing is ever written to disk.
final class AudioRecorder {
    private let engine = AVAudioEngine()
    private let targetFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: 16_000,
        channels: 1,
        interleaved: false
    )!
    private var converter: AVAudioConverter?
    private var samples: [Float] = []
    private var level: Float = 0
    private let lock = NSLock()

    /// How loud the microphone is right now, from 0 (silent) to 1 (loud).
    var currentLevel: Float {
        lock.withLock { level }
    }

    func start() throws {
        lock.withLock {
            samples.removeAll(keepingCapacity: true)
            level = 0
        }

        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
            throw RecorderError.noMicrophone
        }
        converter = AVAudioConverter(from: inputFormat, to: targetFormat)

        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
            self?.append(buffer)
        }
        engine.prepare()
        try engine.start()
    }

    /// Stops recording and hands back everything captured since `start()`.
    func stop() -> [Float] {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        return lock.withLock {
            let captured = samples
            samples = []
            return captured
        }
    }

    /// True if the recording is louder than near-silence. Whisper tends to
    /// invent words ("Thank you.") when given silence, so we skip those.
    static func containsSpeech(_ samples: [Float]) -> Bool {
        let peak = samples.reduce(Float(0)) { max($0, abs($1)) }
        return peak > 0.02
    }

    private func append(_ buffer: AVAudioPCMBuffer) {
        guard let converter else { return }
        let ratio = targetFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1
        guard let output = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else { return }

        var handedOver = false
        var error: NSError?
        let status = converter.convert(to: output, error: &error) { _, inputStatus in
            if handedOver {
                inputStatus.pointee = .noDataNow
                return nil
            }
            handedOver = true
            inputStatus.pointee = .haveData
            return buffer
        }
        guard status != .error, let channel = output.floatChannelData?[0] else { return }

        let chunk = Array(UnsafeBufferPointer(start: channel, count: Int(output.frameLength)))
        let newLevel = Self.loudness(of: chunk)
        lock.withLock {
            samples.append(contentsOf: chunk)
            level = newLevel
        }
    }

    /// Converts the chunk's average volume to a 0…1 scale (-50 dB … -10 dB).
    private static func loudness(of chunk: [Float]) -> Float {
        guard !chunk.isEmpty else { return 0 }
        let meanSquare = chunk.reduce(Float(0)) { $0 + $1 * $1 } / Float(chunk.count)
        let decibels = 10 * log10(max(meanSquare, 1e-10))
        return min(max((decibels + 50) / 40, 0), 1)
    }
}
