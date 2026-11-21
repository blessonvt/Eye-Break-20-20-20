# EyeBreak 20-20-20 (Updated)

A Chrome extension (Manifest V3) that guides you through repeatable eye-care intervals and look-away breaks.

## Look-Away Break Durations

- **1 min** interval → **5s** look-away countdown
- **5 min** interval → **10s** look-away countdown
- **15 min** interval → **15s** look-away countdown
- **20 min** interval → **20s** look-away countdown

## Key Changes Made

1. **Dedicated Look-Away Break Popup (`break.html`, `break.css`, `break.js`)**: Automatically opens as a focused popup window when a timer completes, counts down the required look-away time, enables **Done, Continue** once finished, and repeats the cycle indefinitely until **Stop** is clicked.
2. **Multi-Channel Alert Delivery**: Triggers the dedicated break popup window, a desktop notification (`requireInteraction: true`), and an in-page break card (`content.js`) across tabs so reminders remain visible even during video playback or fullscreen/F4 viewing.
3. **Resilient Scheduling (`background.js` & `popup.js`)**: Combines `chrome.alarms` with a periodic watchdog and state verification on popup open/wake so timers continue reliably even if windows/popups are minimized or closed.
4. **Icons Untouched**: Keeps `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` unchanged in `manifest.json` and `icons/`.

## Install in Chrome

1. Extract the downloaded `EyeBreak-20-20-20.zip` archive into a folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `EyeBreak-20-20-20` folder.
