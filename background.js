'use strict';

/**
 * EyeBreak 20-20-20 — background service worker (Manifest V3)
 */

const ALARM_NAME = 'eyebreak-reminder';
const WATCHDOG_ALARM_NAME = 'eyebreak-watchdog';
const NOTIFICATION_ID = 'eyebreak-reminder';
const BREAK_WINDOW_WIDTH = 400;
const BREAK_WINDOW_HEIGHT = 470;

const VALID_INTERVALS = [1, 5, 15, 20];
const DEFAULT_INTERVAL = 20;

const BREAK_SECONDS_BY_INTERVAL = {
  1: 5,
  5: 10,
  15: 15,
  20: 20
};

const DEFAULTS = {
  running: false,
  intervalMin: DEFAULT_INTERVAL,
  endTime: null,
  phase: 'idle',
  breakDurationSec: 20,
  breakStartedAt: null,
  breakWindowId: null,
  lastNotifiedAt: 0
};

let queue = Promise.resolve();
function enqueue(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function sanitizeInterval(value) {
  const n = Number(value);
  return VALID_INTERVALS.includes(n) ? n : DEFAULT_INTERVAL;
}

function getBreakSeconds(intervalMin) {
  return BREAK_SECONDS_BY_INTERVAL[sanitizeInterval(intervalMin)] ?? 20;
}

function setBadge(running, phase = 'working') {
  try {
    if (!running) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    if (phase === 'break_pending') {
      chrome.action.setBadgeText({ text: 'REST' });
      chrome.action.setBadgeBackgroundColor({ color: '#E68A00' });
    } else {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#3DAE86' });
    }
  } catch (err) {
    console.warn('EyeBreak: could not update badge', err);
  }
}

async function clearTimersOnly() {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(WATCHDOG_ALARM_NAME);
}

async function closeBreakWindowIfAny(windowId) {
  const targetId = windowId ?? (await getState()).breakWindowId;
  if (!targetId) return;
  try {
    await chrome.windows.remove(targetId);
  } catch (_) {}
}

async function dismissInPageOverlays() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, { type: 'HIDE_BREAK_OVERLAY' }).catch(() => {});
    }
  } catch (_) {}
}

async function startWorkCycle(intervalMin, keepLastNotifiedAt = 0) {
  const cleanInterval = sanitizeInterval(intervalMin);
  const now = Date.now();
  const endTime = now + cleanInterval * 60 * 1000;
  const breakDurationSec = getBreakSeconds(cleanInterval);

  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await chrome.alarms.create(WATCHDOG_ALARM_NAME, { periodInMinutes: 1 });

  await chrome.storage.local.set({
    running: true,
    intervalMin: cleanInterval,
    endTime,
    phase: 'working',
    breakDurationSec,
    breakStartedAt: null,
    lastNotifiedAt: keepLastNotifiedAt
  });

  setBadge(true, 'working');
  return getState();
}

async function startTimer(requestedInterval) {
  const state = await getState();
  const targetInterval = sanitizeInterval(requestedInterval ?? state.intervalMin);

  if (state.running && state.phase === 'working' && state.endTime && state.endTime > Date.now()) {
    await ensureScheduleHealthy(state);
    return getState();
  }

  await closeBreakWindowIfAny(state.breakWindowId);
  await dismissInPageOverlays();
  return startWorkCycle(targetInterval, 0);
}

async function stopTimer() {
  const state = await getState();
  await clearTimersOnly();
  await closeBreakWindowIfAny(state.breakWindowId);
  await dismissInPageOverlays();

  try {
    await chrome.notifications.clear(NOTIFICATION_ID);
  } catch (_) {}

  await chrome.storage.local.set({
    running: false,
    endTime: null,
    phase: 'idle',
    breakStartedAt: null,
    breakWindowId: null,
    lastNotifiedAt: 0
  });

  setBadge(false);
  return getState();
}

async function changeInterval(requestedInterval) {
  const state = await getState();
  if (state.running) return state;
  const cleanInterval = sanitizeInterval(requestedInterval);
  await chrome.storage.local.set({
    intervalMin: cleanInterval,
    breakDurationSec: getBreakSeconds(cleanInterval)
  });
  return getState();
}

async function openBreakPopupWindow(intervalMin, breakDurationSec) {
  const state = await getState();

  if (state.breakWindowId) {
    try {
      const existing = await chrome.windows.get(state.breakWindowId);
      if (existing && existing.id) {
        await chrome.windows.update(existing.id, { focused: true, state: 'normal' }).catch(() => {});
        return existing.id;
      }
    } catch (_) {}
  }

  let left;
  let top;
  try {
    const currentWin = await chrome.windows.getLastFocused();
    if (currentWin && typeof currentWin.left === 'number' && typeof currentWin.width === 'number') {
      left = Math.max(20, Math.round(currentWin.left + (currentWin.width - BREAK_WINDOW_WIDTH) / 2));
      top = Math.max(20, Math.round((currentWin.top ?? 40) + 60));
    }
  } catch (_) {}

  const url = chrome.runtime.getURL(
    `break.html?interval=${encodeURIComponent(intervalMin)}&breakSec=${encodeURIComponent(breakDurationSec)}`
  );

  try {
    const win = await chrome.windows.create({
      url,
      type: 'popup',
      width: BREAK_WINDOW_WIDTH,
      height: BREAK_WINDOW_HEIGHT,
      focused: true,
      ...(typeof left === 'number' ? { left, top } : {})
    });
    const winId = win?.id ?? null;
    await chrome.storage.local.set({ breakWindowId: winId });
    return winId;
  } catch (err) {
    console.warn('EyeBreak: popup window create fallback', err);
    return null;
  }
}

async function showDesktopNotification(intervalMin, breakDurationSec) {
  try {
    const level = await chrome.notifications.getPermissionLevel();
    if (level !== 'granted') return;

    await chrome.notifications.clear(NOTIFICATION_ID);
    await chrome.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `👀 Eye Break (${intervalMin}m cycle) — Look Away ${breakDurationSec}s`,
      message: `Look at something 20 feet (6 m) away for ${breakDurationSec} seconds, then click "Done, Continue" in the break popup.`,
      priority: 2,
      requireInteraction: true,
      silent: false
    });
  } catch (err) {
    console.warn('EyeBreak: notification error', err);
  }
}

async function notifyActiveOrAllTabs(intervalMin, breakDurationSec) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        continue;
      }
      chrome.tabs
        .sendMessage(tab.id, {
          type: 'SHOW_BREAK_OVERLAY',
          intervalMin,
          breakDurationSec
        })
        .catch(() => {});
    }
  } catch (_) {}
}

async function triggerBreak(reasonMarker = Date.now()) {
  const state = await getState();
  if (!state.running) return;

  const breakDurationSec = getBreakSeconds(state.intervalMin);
  const now = Date.now();

  await chrome.alarms.clear(ALARM_NAME);

  await chrome.storage.local.set({
    running: true,
    phase: 'break_pending',
    endTime: null,
    breakDurationSec,
    breakStartedAt: state.breakStartedAt ?? now,
    lastNotifiedAt: reasonMarker
  });

  setBadge(true, 'break_pending');

  await Promise.all([
    openBreakPopupWindow(state.intervalMin, breakDurationSec),
    showDesktopNotification(state.intervalMin, breakDurationSec),
    notifyActiveOrAllTabs(state.intervalMin, breakDurationSec)
  ]);
}

async function completeBreakAndContinue() {
  const state = await getState();
  await closeBreakWindowIfAny(state.breakWindowId);
  await dismissInPageOverlays();

  try {
    await chrome.notifications.clear(NOTIFICATION_ID);
  } catch (_) {}

  if (!state.running && state.phase === 'idle') {
    return getState();
  }

  return startWorkCycle(state.intervalMin, Date.now());
}

async function ensureScheduleHealthy(state) {
  if (!state.running) {
    await clearTimersOnly();
    setBadge(false);
    return;
  }

  if (state.phase === 'break_pending') {
    setBadge(true, 'break_pending');
    await openBreakPopupWindow(state.intervalMin, getBreakSeconds(state.intervalMin));
    return;
  }

  const now = Date.now();
  const endTime = state.endTime ?? now + state.intervalMin * 60 * 1000;

  if (endTime <= now) {
    await triggerBreak(endTime);
    return;
  }

  const alarm = await chrome.alarms.get(ALARM_NAME);
  if (!alarm || Math.abs((alarm.scheduledTime ?? 0) - endTime) > 1500) {
    await chrome.alarms.clear(ALARM_NAME);
    await chrome.alarms.create(ALARM_NAME, { when: endTime });
  }

  const watchdog = await chrome.alarms.get(WATCHDOG_ALARM_NAME);
  if (!watchdog) {
    await chrome.alarms.create(WATCHDOG_ALARM_NAME, { periodInMinutes: 1 });
  }

  await chrome.storage.local.set({ endTime, phase: 'working' });
  setBadge(true, 'working');
}

async function initialise() {
  const state = await getState();
  await ensureScheduleHealthy(state);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    enqueue(() => triggerBreak(alarm.scheduledTime || Date.now())).catch((err) =>
      console.error('EyeBreak: alarm error', err)
    );
  } else if (alarm.name === WATCHDOG_ALARM_NAME) {
    enqueue(async () => {
      const state = await getState();
      await ensureScheduleHealthy(state);
    }).catch((err) => console.error('EyeBreak: watchdog error', err));
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message.type !== 'string') return;

  let task;
  switch (message.type) {
    case 'START':
      task = () => startTimer(message.intervalMin);
      break;
    case 'STOP':
      task = () => stopTimer();
      break;
    case 'SET_INTERVAL':
      task = () => changeInterval(message.intervalMin);
      break;
    case 'COMPLETE_BREAK':
      task = () => completeBreakAndContinue();
      break;
    case 'OPEN_BREAK_POPUP':
      task = async () => {
        const s = await getState();
        await openBreakPopupWindow(s.intervalMin, getBreakSeconds(s.intervalMin));
        return s;
      };
      break;
    case 'GET_STATE':
      task = async () => {
        const s = await getState();
        if (s.running && s.phase === 'working' && s.endTime && Date.now() >= s.endTime) {
          await triggerBreak(s.endTime);
          return getState();
        }
        return s;
      };
      break;
    default:
      return;
  }

  enqueue(task)
    .then((state) => sendResponse({ ok: true, state }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});

chrome.windows.onRemoved.addListener((windowId) => {
  enqueue(async () => {
    const state = await getState();
    if (state.breakWindowId === windowId) {
      await chrome.storage.local.set({ breakWindowId: null });
      if (state.running && state.phase === 'break_pending') {
        await openBreakPopupWindow(state.intervalMin, getBreakSeconds(state.intervalMin));
      }
    }
  }).catch(() => {});
});

chrome.notifications.onClicked.addListener((id) => {
  if (id !== NOTIFICATION_ID) return;
  enqueue(async () => {
    const state = await getState();
    if (state.running && state.phase === 'break_pending') {
      await openBreakPopupWindow(state.intervalMin, getBreakSeconds(state.intervalMin));
    }
    try {
      await chrome.notifications.clear(id);
    } catch (_) {}
  }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  enqueue(initialise).catch((err) => console.error('EyeBreak: install error', err));
});

chrome.runtime.onStartup.addListener(() => {
  enqueue(initialise).catch((err) => console.error('EyeBreak: startup error', err));
});

enqueue(initialise).catch((err) => console.error('EyeBreak: init error', err));
