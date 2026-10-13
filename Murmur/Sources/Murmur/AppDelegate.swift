import AppKit

/// Wires the pieces together:
/// hold key → record → (release) → transcribe on-device → paste into the frontmost app.
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private enum State {
        case loading
        case ready
        case recording(startedAt: Date)
        case transcribing
        case failed(String)
    }

    private var state: State = .loading {
        didSet { updateIcon() }
    }

    private let recorder = AudioRecorder()
    private let transcriber = Transcriber()
    // `lazy` so these main-thread-only objects are created on the main thread.
    private lazy var inserter = TextInserter()
    private lazy var hud = HUDController()
    private lazy var hotkey = HotkeyMonitor(trigger: TriggerKey.saved)
    private lazy var menu = NSMenu()

    private var statusItem: NSStatusItem!

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        menu.delegate = self
        statusItem.menu = menu
        updateIcon()

        hotkey.onPress = { [weak self] in self?.keyPressed() }
        hotkey.onRelease = { [weak self] in self?.keyReleased() }

        Task {
            await askForPermissionsOnFirstLaunch()
            await startListeningForHotkey()
        }
        loadModel()
    }

    private func askForPermissionsOnFirstLaunch() async {
        if Permissions.microphoneUndecided {
            _ = await Permissions.requestMicrophone()
        }
        if !Permissions.accessibilityAllowed {
            Permissions.promptForAccessibility()
        }
    }

    /// The key watcher can only start once Accessibility is allowed, so keep
    /// trying quietly in the background until the user has flipped the switch.
    private func startListeningForHotkey() async {
        while !hotkey.start() {
            try? await Task.sleep(for: .seconds(2))
        }
    }

    private func loadModel() {
        state = .loading
        Task {
            do {
                _ = try await transcriber.load()
                state = .ready
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    // MARK: - Push to talk

    private func keyPressed() {
        switch state {
        case .ready:
            break
        case .loading:
            hud.flash("Still getting ready — downloading the speech model…")
            return
        case .failed:
            hud.flash("\(Brand.name) couldn't load. Open the menu bar icon for details.")
            return
        case .recording, .transcribing:
            return
        }

        guard Permissions.microphoneAllowed else {
            hud.flash("\(Brand.name) needs microphone access — see the menu bar icon.")
            return
        }

        do {
            try recorder.start()
            state = .recording(startedAt: Date())
            hud.show("Listening…", color: .systemRed)
        } catch {
            hud.flash(error.localizedDescription, seconds: 4)
        }
    }

    private func keyReleased() {
        guard case .recording(let startedAt) = state else { return }
        let samples = recorder.stop()

        // Ignore accidental taps and silence.
        let heldFor = Date().timeIntervalSince(startedAt)
        guard heldFor > 0.3, AudioRecorder.containsSpeech(samples) else {
            state = .ready
            hud.hide()
            return
        }

        state = .transcribing
        hud.show("Transcribing…", color: .systemOrange)

        Task {
            defer { state = .ready }
            do {
                let text = try await transcriber.transcribe(samples)
                guard !text.isEmpty else {
                    hud.hide()
                    return
                }
                deliver(text + " ")
            } catch {
                hud.flash("Sorry, that didn't work: \(error.localizedDescription)", seconds: 4)
            }
        }
    }

    private func deliver(_ text: String) {
        if Permissions.accessibilityAllowed {
            inserter.paste(text)
            hud.hide()
        } else {
            inserter.copy(text)
            hud.flash("Copied — press ⌘V to paste. (Allow Accessibility to paste automatically.)", seconds: 4)
        }
    }

    // MARK: - Menu bar

    private func updateIcon() {
        guard let button = statusItem?.button else { return }
        let symbol: String
        switch state {
        case .loading: symbol = "arrow.down.circle"
        case .ready: symbol = "waveform"
        case .recording: symbol = "mic.fill"
        case .transcribing: symbol = "ellipsis.circle"
        case .failed: symbol = "exclamationmark.triangle"
        }
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: Brand.name)
        image?.isTemplate = true
        button.image = image
    }

    /// Rebuilt every time the menu opens, so permission ticks are always current.
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()

        menu.addItem(disabledItem("\(Brand.name) — \(statusText)"))
        menu.addItem(disabledItem("Hold \(hotkey.trigger.title) and speak, then let go."))
        menu.addItem(.separator())

        let keyMenu = NSMenu()
        for key in TriggerKey.allCases {
            let item = NSMenuItem(title: key.title, action: #selector(chooseTrigger(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = key.rawValue
            item.state = key == hotkey.trigger ? .on : .off
            keyMenu.addItem(item)
        }
        let keyItem = NSMenuItem(title: "Push-to-talk key", action: nil, keyEquivalent: "")
        keyItem.submenu = keyMenu
        menu.addItem(keyItem)
        menu.addItem(.separator())

        menu.addItem(disabledItem("Permissions"))
        menu.addItem(permissionItem(
            allowed: Permissions.microphoneAllowed,
            name: "Microphone",
            action: #selector(openMicrophoneSettings)
        ))
        menu.addItem(permissionItem(
            allowed: Permissions.accessibilityAllowed,
            name: "Accessibility",
            action: #selector(openAccessibilitySettings)
        ))

        if case .failed = state {
            menu.addItem(.separator())
            menu.addItem(actionItem("Try Loading Again", #selector(retryLoad)))
        }

        menu.addItem(.separator())
        menu.addItem(actionItem("About \(Brand.name)", #selector(showAbout)))
        menu.addItem(actionItem("Quit \(Brand.name)", #selector(quit), key: "q"))
    }

    private var statusText: String {
        switch state {
        case .loading: return "Getting ready (first launch downloads the speech model)…"
        case .ready: return "Ready"
        case .recording: return "Listening…"
        case .transcribing: return "Transcribing…"
        case .failed(let message): return "Problem: \(message)"
        }
    }

    private func disabledItem(_ title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    private func actionItem(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    private func permissionItem(allowed: Bool, name: String, action: Selector) -> NSMenuItem {
        if allowed {
            return disabledItem("✓ \(name) allowed")
        }
        return actionItem("Allow \(name)…", action)
    }

    @objc private func chooseTrigger(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String, let key = TriggerKey(rawValue: raw) else { return }
        TriggerKey.saved = key
        hotkey.trigger = key
    }

    @objc private func openMicrophoneSettings() {
        if Permissions.microphoneUndecided {
            Task { _ = await Permissions.requestMicrophone() }
        } else {
            Permissions.openMicrophoneSettings()
        }
    }

    @objc private func openAccessibilitySettings() {
        Permissions.promptForAccessibility()
        Permissions.openAccessibilitySettings()
    }

    @objc private func retryLoad() {
        loadModel()
    }

    @objc private func showAbout() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: Brand.name,
            .credits: NSAttributedString(string: "\(Brand.tagline)\n\n\(Brand.privacyPromise)")
        ])
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
