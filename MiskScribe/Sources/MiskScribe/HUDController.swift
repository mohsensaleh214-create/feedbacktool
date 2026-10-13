import AppKit

/// The small floating pill near the bottom of the screen. While you hold the
/// key it shows a green waveform that moves with your voice; while transcribing
/// the waveform ripples gently. It never takes focus from the app you're typing
/// in, and clicks pass straight through it.
@MainActor
final class HUDController {
    private let panel: NSPanel
    private let background: NSVisualEffectView
    private let waveform = WaveformView()
    private let label = NSTextField(labelWithString: "")
    private var hideTask: Task<Void, Never>?
    private var animationTask: Task<Void, Never>?

    private let waveSize = NSSize(width: 104, height: 36)
    private let messageHeight: CGFloat = 36

    init() {
        panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: waveSize),
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

        background = NSVisualEffectView(frame: NSRect(origin: .zero, size: waveSize))
        background.material = .hudWindow
        background.blendingMode = .behindWindow
        background.state = .active
        background.wantsLayer = true
        background.layer?.cornerRadius = waveSize.height / 2
        background.layer?.masksToBounds = true
        background.autoresizingMask = [.width, .height]

        label.font = .systemFont(ofSize: 13, weight: .medium)
        label.textColor = .labelColor
        label.alignment = .center
        label.lineBreakMode = .byTruncatingTail

        background.addSubview(waveform)
        background.addSubview(label)
        panel.contentView = background
    }

    /// Live waveform driven by the microphone level (0…1).
    func showListening(level: @escaping () -> Float) {
        showWaveform()
        animate { [waveform] _ in waveform.update(level: CGFloat(level())) }
    }

    /// Gentle ripple while the speech is being turned into text.
    func showTranscribing() {
        showWaveform()
        animate { [waveform] time in waveform.ripple(time: time) }
    }

    /// Shows a short text message, then hides.
    func flash(_ message: String, seconds: Double = 2.5) {
        stopAnimation()
        waveform.isHidden = true
        label.isHidden = false
        label.stringValue = message
        let width = min(max(label.intrinsicContentSize.width + 40, 160), 520)
        layout(size: NSSize(width: width, height: messageHeight))
        label.frame = NSRect(x: 20, y: (messageHeight - 18) / 2, width: width - 40, height: 18)
        panel.orderFrontRegardless()
        hide(after: seconds)
    }

    func hide(after seconds: Double = 0) {
        hideTask?.cancel()
        hideTask = Task { @MainActor [weak self] in
            if seconds > 0 {
                try? await Task.sleep(for: .seconds(seconds))
            }
            guard !Task.isCancelled, let self else { return }
            self.stopAnimation()
            self.panel.orderOut(nil)
        }
    }

    private func showWaveform() {
        hideTask?.cancel()
        label.isHidden = true
        waveform.isHidden = false
        layout(size: waveSize)
        waveform.frame = NSRect(origin: .zero, size: waveSize)
        panel.orderFrontRegardless()
    }

    /// Runs `frame` about 30 times a second until stopped.
    private func animate(_ frame: @escaping @MainActor (Double) -> Void) {
        stopAnimation()
        let start = Date()
        animationTask = Task { @MainActor in
            while !Task.isCancelled {
                frame(Date().timeIntervalSince(start))
                try? await Task.sleep(for: .milliseconds(33))
            }
        }
    }

    private func stopAnimation() {
        animationTask?.cancel()
        animationTask = nil
    }

    private func layout(size: NSSize) {
        // Show on whichever screen the mouse is on, near the bottom.
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main
        guard let frame = screen?.visibleFrame else { return }
        let origin = NSPoint(x: frame.midX - size.width / 2, y: frame.minY + 72)
        panel.setFrame(NSRect(origin: origin, size: size), display: true)
        background.layer?.cornerRadius = size.height / 2
    }
}

/// A row of rounded bars in the Misk greens.
@MainActor
final class WaveformView: NSView {
    private let barCount = 11
    private let barWidth: CGFloat = 3.5
    private let barGap: CGFloat = 3.5
    private let minHeight: CGFloat = 3.5
    private let maxHeight: CGFloat = 22

    private var bars: [CALayer] = []
    private var smoothedLevel: CGFloat = 0

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        for index in 0..<barCount {
            let bar = CALayer()
            bar.cornerRadius = barWidth / 2
            bar.backgroundColor = color(at: index).cgColor
            layer?.addSublayer(bar)
            bars.append(bar)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been used")
    }

    /// Bars jump with the voice; taller in the middle, shorter at the ends.
    func update(level: CGFloat) {
        // Rise quickly, fall gently, so it feels lively but not jittery.
        smoothedLevel = level > smoothedLevel ? level : smoothedLevel * 0.82 + level * 0.18
        setHeights { index in
            let jitter = CGFloat.random(in: 0.65...1.0)
            return smoothedLevel * envelope(index) * jitter
        }
    }

    /// A soft wave travelling across the bars.
    func ripple(time: Double) {
        smoothedLevel = 0
        setHeights { index in
            0.22 + 0.18 * CGFloat(sin(time * 7 - Double(index) * 0.6))
        }
    }

    private func setHeights(_ amount: (Int) -> CGFloat) {
        CATransaction.begin()
        CATransaction.setAnimationDuration(0.08)
        let totalWidth = CGFloat(barCount) * barWidth + CGFloat(barCount - 1) * barGap
        var x = (bounds.width - totalWidth) / 2
        for (index, bar) in bars.enumerated() {
            let fraction = min(max(amount(index), 0), 1)
            let height = minHeight + (maxHeight - minHeight) * fraction
            bar.frame = CGRect(x: x, y: (bounds.height - height) / 2, width: barWidth, height: height)
            x += barWidth + barGap
        }
        CATransaction.commit()
    }

    private func envelope(_ index: Int) -> CGFloat {
        let position = (Double(index) + 0.5) / Double(barCount)
        return CGFloat(0.35 + 0.65 * sin(.pi * position))
    }

    /// Light teal at the edges blending to the deeper Misk green in the middle.
    private func color(at index: Int) -> NSColor {
        let middle = Double(barCount - 1) / 2
        let distance = abs(Double(index) - middle) / middle
        return Brand.Colors.mid.blended(withFraction: distance, of: Brand.Colors.light) ?? Brand.Colors.mid
    }
}
