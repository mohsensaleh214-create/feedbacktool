import AppKit

/// Types text into whichever app has the cursor, by briefly putting it on the
/// clipboard and pressing ⌘V on the user's behalf. Whatever was on the clipboard
/// beforehand is put back afterwards.
@MainActor
final class TextInserter {
    /// Markers that ask clipboard-history apps not to keep a copy.
    /// See http://nspasteboard.org
    private let transientType = NSPasteboard.PasteboardType("org.nspasteboard.TransientType")
    private let concealedType = NSPasteboard.PasteboardType("org.nspasteboard.ConcealedType")

    /// Pastes `text` into the frontmost app. Needs the Accessibility permission.
    func paste(_ text: String) {
        let pasteboard = NSPasteboard.general
        let saved = snapshot(of: pasteboard)

        put(text, on: pasteboard)
        let ourChangeCount = pasteboard.changeCount
        pressCommandV()

        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(600))
            // If the user copied something new in the meantime, leave it alone.
            guard pasteboard.changeCount == ourChangeCount else { return }
            pasteboard.clearContents()
            if !saved.isEmpty { pasteboard.writeObjects(saved) }
        }
    }

    /// Fallback when we can't paste automatically: leave the text on the clipboard.
    func copy(_ text: String) {
        put(text, on: NSPasteboard.general)
    }

    private func put(_ text: String, on pasteboard: NSPasteboard) {
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        pasteboard.setData(Data(), forType: transientType)
        pasteboard.setData(Data(), forType: concealedType)
    }

    private func snapshot(of pasteboard: NSPasteboard) -> [NSPasteboardItem] {
        (pasteboard.pasteboardItems ?? []).map { item in
            let copy = NSPasteboardItem()
            for type in item.types {
                if let data = item.data(forType: type) {
                    copy.setData(data, forType: type)
                }
            }
            return copy
        }
    }

    private func pressCommandV() {
        let source = CGEventSource(stateID: .combinedSessionState)
        let vKey: CGKeyCode = 9 // kVK_ANSI_V
        let down = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: true)
        let up = CGEvent(keyboardEventSource: source, virtualKey: vKey, keyDown: false)
        down?.flags = .maskCommand
        up?.flags = .maskCommand
        down?.post(tap: .cghidEventTap)
        up?.post(tap: .cghidEventTap)
    }
}
