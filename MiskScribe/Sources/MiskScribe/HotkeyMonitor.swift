import AppKit
import CoreGraphics

/// The key the user holds down to talk.
enum TriggerKey: String, CaseIterable {
    case fn
    case rightOption
    case rightCommand

    var title: String {
        switch self {
        case .fn: return "🌐 Fn (Globe)"
        case .rightOption: return "Right Option ⌥"
        case .rightCommand: return "Right Command ⌘"
        }
    }

    var keyCode: Int64 {
        switch self {
        case .fn: return 63           // kVK_Function
        case .rightOption: return 61  // kVK_RightOption
        case .rightCommand: return 54 // kVK_RightCommand
        }
    }

    var flag: CGEventFlags {
        switch self {
        case .fn: return .maskSecondaryFn
        case .rightOption: return .maskAlternate
        case .rightCommand: return .maskCommand
        }
    }

    private static let defaultsKey = "triggerKey"

    static var saved: TriggerKey {
        get { UserDefaults.standard.string(forKey: defaultsKey).flatMap(TriggerKey.init) ?? .fn }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: defaultsKey) }
    }
}

/// Watches the keyboard system-wide for the trigger key going down and up.
///
/// Modifier keys (Fn, Option, Command) only produce `flagsChanged` events, so a
/// Quartz event tap is used rather than a regular hotkey API. Creating the tap
/// requires the Accessibility permission; `start()` returns false until granted.
@MainActor
final class HotkeyMonitor {
    var trigger: TriggerKey {
        didSet { isDown = false }
    }
    var onPress: (() -> Void)?
    var onRelease: (() -> Void)?

    private var tap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var isDown = false

    init(trigger: TriggerKey) {
        self.trigger = trigger
    }

    func start() -> Bool {
        guard tap == nil else { return true }

        let mask = CGEventMask(1 << CGEventType.flagsChanged.rawValue)
        let callback: CGEventTapCallBack = { _, type, event, refcon in
            if let refcon {
                let monitor = Unmanaged<HotkeyMonitor>.fromOpaque(refcon).takeUnretainedValue()
                // The tap is attached to the main run loop, so we are on the main thread.
                MainActor.assumeIsolated {
                    monitor.handle(type: type, event: event)
                }
            }
            return Unmanaged.passUnretained(event)
        }

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: mask,
            callback: callback,
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        ) else {
            return false
        }

        let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        self.tap = tap
        self.runLoopSource = source
        return true
    }

    private func handle(type: CGEventType, event: CGEvent) {
        // macOS switches a tap off if it is ever too slow; switch it back on.
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
            return
        }
        guard type == .flagsChanged,
              event.getIntegerValueField(.keyboardEventKeycode) == trigger.keyCode
        else { return }

        let pressed = event.flags.contains(trigger.flag)
        if pressed && !isDown {
            isDown = true
            onPress?()
        } else if !pressed && isDown {
            isDown = false
            onRelease?()
        }
    }
}
