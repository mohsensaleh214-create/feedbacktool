import Foundation

/// Everything that carries the app's name lives here (plus Support/Info.plist
/// and scripts/build-app.sh), so a rename is a small change.
enum Brand {
    static let name = "Murmur"
    static let tagline = "Hold a key. Speak. Done."
    static let privacyPromise = """
        \(name) turns your speech into text entirely on this Mac. \
        Your voice is never saved or sent over the internet.
        """
}
