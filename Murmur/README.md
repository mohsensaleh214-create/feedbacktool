# Murmur

**Hold a key. Speak. Done.**

Murmur is a small Mac app for dictation. Hold down one key, say what you want to
type, let go, and your words appear wherever your cursor is: an email, a
document, a message, anything.

> "Murmur" is a placeholder name. We'll choose the real name and logo later.

---

## Privacy, in plain English

- Murmur turns your speech into text **entirely on your own Mac**.
- Your voice is **never saved** and **never sent over the internet**.
- No one, including the school or the app's creator, can see or track what you dictate.
- The **only** time Murmur uses the internet is the very first time it opens, to download its speech model (see below).
- Murmur has **no accounts, no logins, no tracking, and no usage limits**.

One honest note: the text goes wherever *you* put it. If you dictate into Gmail,
it's in Gmail, the same as if you'd typed it.

---

## What you need

- A Mac with an Apple chip (M1 or newer), running macOS 14 (Sonoma) or later.
- A microphone. MacBooks have one built in. **Mac Studio and Mac mini don't**, so
  use AirPods, a headset, a webcam with a mic, or an Apple Studio Display.
- About **0.2–1.5 GB** of free space (Murmur picks a speech model that suits your Mac).

---

## How to install it

1. **Download** `Murmur.zip` (from the Releases page of this project, or from wherever you were sent it).
2. **Double-click** the zip to unpack it. You'll get **Murmur**.
3. **Drag Murmur** into your **Applications** folder.
4. **Open Murmur** from Applications.
   - The first time, your Mac will say it **"could not verify"** Murmur. This is
     normal for apps not sold through Apple's App Store.
   - Click **Done** (not "Move to Bin").
   - Open **System Settings → Privacy & Security**, scroll down, and click
     **Open Anyway** next to the Murmur message. Confirm with your password.
5. A small **waveform icon** appears at the top of your screen, near the clock.
   That's Murmur.

### Allow the two permissions

Murmur will ask for these the first time:

| Permission | Why it's needed | What to do |
|---|---|---|
| **Microphone** | So it can hear you | Click **Allow** |
| **Accessibility** | So it can notice your key and type into other apps | Click **Open System Settings**, then turn **Murmur** on |

You can check both any time by clicking the waveform icon. A **✓** means it's allowed.

### Wait for the first download

The first time Murmur opens, it downloads its speech model. While that happens the icon
shows a **downward arrow**. Depending on your internet connection, this takes from a
few seconds to a few minutes. After that, Murmur works fully offline.

### If you're using the 🌐 Fn key (the default)

On most Macs, pressing 🌐 Fn opens emojis or Apple's own dictation. Switch that off so
it doesn't get in the way:

**System Settings → Keyboard → "Press 🌐 key to" → Do Nothing**

Or pick a different key: click the waveform icon → **Push-to-talk key** →
**Right Option** or **Right Command**.

---

## How to use it

1. Click where you want the text to go.
2. **Hold** your push-to-talk key (🌐 Fn by default).
3. A little **"Listening…"** bubble appears at the bottom of the screen. Speak.
4. **Let go.** After a moment, your words appear.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing happens when I hold the key | Click the waveform icon and check **Accessibility** has a ✓. If you use 🌐 Fn, set "Press 🌐 key to" to **Do Nothing** (see above). |
| "No microphone found" | Connect a microphone or headset. Check **System Settings → Sound → Input**. |
| Text is copied but not pasted | Accessibility isn't allowed yet. Turn Murmur on in **System Settings → Privacy & Security → Accessibility**. |
| **After installing a new version**, the key stops working | Go to **System Settings → Privacy & Security → Accessibility**, select Murmur, click **–** to remove it, then open Murmur again and allow it. (This goes away once the app is signed with an Apple Developer account.) |

---

## For IT staff

- Native Swift/AppKit menu-bar app (`LSUIElement`), not sandboxed (Accessibility requires this).
- Speech-to-text: [WhisperKit](https://github.com/argmaxinc/argmax-oss-swift) running OpenAI Whisper via Core ML on-device. The model is chosen per device by `WhisperKit.recommendedModels()` and downloaded once from Hugging Face (`argmaxinc/whisperkit-coreml`) into `~/Library/Application Support/Murmur/Models`. That is the app's only network access.
- Audio is held in memory only while the key is down and is discarded after transcription. Nothing is written to disk.
- Text is inserted by placing it on the pasteboard (marked `org.nspasteboard.TransientType` / `ConcealedType` so clipboard managers skip it), sending ⌘V, then restoring the previous pasteboard contents.
- No analytics, crash reporting, or auto-update code.
- Permissions: Microphone (`NSMicrophoneUsageDescription`) and Accessibility (event tap for the push-to-talk key, plus synthetic ⌘V).
- Currently ad-hoc signed. For managed deployment, sign with a Developer ID, notarize, and push via MDM with a PPPC profile pre-approving Accessibility. Bundle ID: `app.murmur.dictation`.

## For developers

```bash
cd Murmur
./scripts/build-app.sh          # → build/Murmur.app and build/Murmur.zip
open build/Murmur.app
```

Every push that changes `Murmur/` is built automatically by
`.github/workflows/build-murmur.yml` on GitHub's Mac machines. The result is published as
the **"Murmur — latest build"** release.

| File | What it does |
|---|---|
| `Sources/Murmur/AppDelegate.swift` | Connects everything; the menu bar menu |
| `Sources/Murmur/HotkeyMonitor.swift` | Notices the push-to-talk key going down/up |
| `Sources/Murmur/AudioRecorder.swift` | Records the microphone into memory (16 kHz mono) |
| `Sources/Murmur/Transcriber.swift` | Speech → text with Whisper, on-device |
| `Sources/Murmur/TextInserter.swift` | Pastes the text into the app you're using |
| `Sources/Murmur/HUDController.swift` | The "Listening…" bubble |
| `Sources/Murmur/Permissions.swift` | Microphone and Accessibility checks |
| `Sources/Murmur/Brand.swift` | App name, tagline, privacy wording |
