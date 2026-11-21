# EyeBreak 20-20-20 (V.02)
A Chrome extension (Manifest V3) that guides you through repeatable eye-care intervals and look-away breaks.

## Look-Away Break Durations

- **1 min** interval → **5s** look-away countdown  (Use to test if its working!!!)
- **5 min** interval → **10s** look-away countdown
- **15 min** interval → **15s** look-away countdown
- **20 min** interval → **20s** look-away countdown (Recommended)


## Install in Chrome

1. Extract the downloaded `EyeBreak-20-20-20.zip` archive into a folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `EyeBreak-20-20-20` folder.

       
## Key Features

1. **Interval-Based Look-Away Durations: Automatically pairs each work interval with a dedicated look-away countdown: 1 min → 5s, 5 min → 10s, 15 min → 15s, and 20 min → 20s. 
2. **Dedicated Look-Away Break Popup: Opens a focused break window (break.html) when a work interval finishes, counts down the look-away period, and enables Done, Continue once the countdown completes.
3. ** Continuous Repeat Loop: Starts the next work cycle automatically after you click Done, Continue, repeating the work-and-break loop indefinitely until you manually click Stop. 
4. **Multi-Channel Alert Delivery: Triggers the break popup window alongside a desktop notification (requireInteraction: true) and an in-page break card (content.js) across open tabs so reminders remain visible even during video playback or fullscreen/F4 viewing.
5. ** Resilient Background Scheduling: Combines chrome.alarms with a periodic watchdog and state verification (GET_STATE) in background.js and popup.js so timers stay accurate when popups or windows are minimized, closed, or suspended.   


