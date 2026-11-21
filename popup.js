'use strict';

const DEFAULTS = {
  running: false,
  intervalMin: 20,
  endTime: null,
  phase: 'idle',
  breakDurationSec: 20
};
const BREAK_MAP = { 1: 5, 5: 10, 15: 15, 20: 20 };
const RING_RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const $ = (id) => document.getElementById(id);
const els = {
  status: $('status'),
  statusText: $('statusText'),
  ring: $('ring'),
  ringProgress: $('ringProgress'),
  time: $('time'),
  sub: $('sub'),
  hint: $('hint'),
  chips: Array.from(document.querySelectorAll('.chip')),
  startBtn: $('startBtn'),
  stopBtn: $('stopBtn'),
  warning: $('warning')
};

let state = { ...DEFAULTS };

els.ringProgress.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;

async function loadState() {
  state = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
}

async function send(message) {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    if (reply && reply.state) state = { ...state, ...reply.state };
  } catch (err) {
    console.error('EyeBreak: message failed', err);
  }
  await loadState();
  render();
}

function formatTime(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function renderStatic() {
  const { running, intervalMin, phase } = state;
  const breakSec = BREAK_MAP[intervalMin] ?? state.breakDurationSec ?? 20;

  els.status.dataset.active = String(running);
  if (!running) {
    els.statusText.textContent = 'Inactive';
  } else if (phase === 'break_pending') {
    els.statusText.textContent = 'Break Due';
  } else {
    els.statusText.textContent = 'Active';
  }

  els.ring.dataset.active = String(running);

  els.chips.forEach((chip) => {
    const selected = Number(chip.dataset.min) === intervalMin;
    chip.setAttribute('aria-checked', String(selected));
    chip.tabIndex = selected ? 0 : -1;
    chip.disabled = running;
  });

  els.startBtn.disabled = running;
  els.stopBtn.disabled = !running;
  els.sub.textContent = `Every ${intervalMin}m · ${breakSec}s rest`;

  if (!running) {
    els.hint.textContent = '1m→5s, 5m→10s, 15m→15s, 20m→20s look-away break.';
  } else if (phase === 'break_pending') {
    els.hint.textContent = 'Break popup active. Finish look-away & click Done, Continue.';
  } else {
    els.hint.textContent = 'Repeats automatically until you click Stop.';
  }
}

function renderTime() {
  const totalMs = state.intervalMin * 60 * 1000;
  let remainingMs = totalMs;

  if (state.running && state.phase === 'break_pending') {
    remainingMs = 0;
  } else if (state.running && state.endTime) {
    remainingMs = Math.min(totalMs, Math.max(0, state.endTime - Date.now()));
  }

  els.time.textContent = formatTime(Math.ceil(remainingMs / 1000));

  const fraction = remainingMs / totalMs;
  els.ringProgress.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - fraction));
  els.ringProgress.style.strokeOpacity = fraction < 0.003 ? '0' : '1';
}

function render() {
  renderStatic();
  renderTime();
}

async function checkNotificationPermission() {
  try {
    const level = await chrome.notifications.getPermissionLevel();
    els.warning.hidden = level === 'granted';
  } catch (_) {
    els.warning.hidden = true;
  }
}

els.startBtn.addEventListener('click', () => {
  send({ type: 'START', intervalMin: state.intervalMin });
});

els.stopBtn.addEventListener('click', () => {
  send({ type: 'STOP' });
});

els.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    if (state.running) return;
    send({ type: 'SET_INTERVAL', intervalMin: Number(chip.dataset.min) });
  });
});

document.getElementById('intervals').addEventListener('keydown', (e) => {
  if (state.running) return;
  const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (!(e.key in keys)) return;
  e.preventDefault();
  const current = els.chips.findIndex((c) => Number(c.dataset.min) === state.intervalMin);
  const next = els.chips[(current + keys[e.key] + els.chips.length) % els.chips.length];
  next.focus();
  send({ type: 'SET_INTERVAL', intervalMin: Number(next.dataset.min) });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key in DEFAULTS) state[key] = newValue === undefined ? DEFAULTS[key] : newValue;
  }
  render();
});

(async function init() {
  await loadState();
  await send({ type: 'GET_STATE' });
  checkNotificationPermission();
  setInterval(renderTime, 250);
})();
