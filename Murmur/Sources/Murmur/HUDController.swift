import AppKit

/// The small floating pill near the bottom of the screen that shows
/// "Listening…" / "Transcribing…". It never takes focus away from the app
/// you're typing in, and clicks pass straight through it.
@MainActor
final class HUDController {
    private let panel: NSPanel
    private let label = NSTextField(labelWithString: "")
    private let dot = NSView()
    private var hideTask: Task<Void, Never>?

    private let size = NSSize(width: 240, height: 44)

    init() {
        panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.nonactivatingPanel, .borderless],
            backing: .buffered,
            defer: true
        )
        panel.isFloatingPanel = true
        panel.level = .statusBar
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.ignoresMouseEvents = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]

        let background = NSVisualEffectView(frame: NSRect(origin: .zero, size: size))
        background.material = .hudWindow
        background.blendingMode = .behindWindow
        background.state = .active
        background.wantsLayer = true
        background.layer?.cornerRadius = size.height / 2
        background.layer?.masksToBounds = true

        dot.frame = NSRect(x: 18, y: (size.height - 10) / 2, width: 10, height: 10)
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 5

        label.frame = NSRect(x: 38, y: (size.height - 20) / 2, width: size.width - 52, height: 20)
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textColor = .labelColor
        label.lineBreakMode = .byTruncatingTail

        background.addSubview(dot)
        background.addSubview(label)
        panel.contentView = background
    }

    func show(_ message: String, color: NSColor) {
        hideTask?.cancel()
        label.stringValue = message
        dot.layer?.backgroundColor = color.cgColor
        position()
        panel.orderFrontRegardless()
    }

    /// Shows a message briefly, then hides.
    func flash(_ message: String, seconds: Double = 2.5) {
        show(message, color: .systemGray)
        hide(after: seconds)
    }

    func hide(after seconds: Double = 0) {
        hideTask?.cancel()
        hideTask = Task { @MainActor [weak self] in
            if seconds > 0 {
                try? await Task.sleep(for: .seconds(seconds))
            }
            guard !Task.isCancelled else { return }
            self?.panel.orderOut(nil)
        }
    }

    private func position() {
        // Show on whichever screen the mouse is on.
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main
        guard let frame = screen?.visibleFrame else { return }
        let origin = NSPoint(x: frame.midX - size.width / 2, y: frame.minY + 80)
        panel.setFrame(NSRect(origin: origin, size: size), display: true)
    }
}
