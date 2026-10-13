import AppKit

/// Everything that carries the app's name and look lives here (plus
/// Support/Info.plist and scripts/build-app.sh).
enum Brand {
    static let name = "Misk Scribe"
    static let tagline = "Hold a key. Speak. Done."
    static let privacyPromise = """
        \(name) turns your speech into text entirely on this Mac. \
        Your voice is never saved or sent over the internet.
        """

    /// Greens sampled from the Misk Schools logo, light to deep.
    enum Colors {
        static let light = NSColor(srgbRed: 0x46 / 255, green: 0xBB / 255, blue: 0xA6 / 255, alpha: 1)
        static let mid = NSColor(srgbRed: 0x00 / 255, green: 0xA0 / 255, blue: 0x74 / 255, alpha: 1)
        static let deep = NSColor(srgbRed: 0x00 / 255, green: 0x60 / 255, blue: 0x48 / 255, alpha: 1)
    }
}
