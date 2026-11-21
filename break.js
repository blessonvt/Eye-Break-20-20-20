'use strict';

const BREAK_MAP = { 1: 5, 5: 10, 15: 15, 20: 20 };

const params = new URLSearchParams(window.location.search);
const intervalMin = Number(params.get('interval')) || 20;
const breakDurationSec = Number(params.get('breakSec')) || BREAK_MAP[intervalMin] || 20;

const countdownEl = document.getElementById('breakCountdown');
const countdownSubEl = document.getElementById('countdownSub');
const progressFillEl = document.getElementById('progressFill');
const cycleTagEl = document.getElementById('cycleTag');
const breakBadgeEl = document.getElementById('breakBadge');
const doneBtn = document.getElementById('doneContinueBtn');
const stopBtn = document.getElementById('stopAllBtn');

cycleTagEl.textContent = `Interval: ${intervalMin} min · Look away: ${breakDurationSec}s`;

const startedAt = Date.now();
const targetEndMs = startedAt + breakDurationSec * 1000;

function formatSec(sec) {
  const s = Math.max(0, sec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function tick() {
  const now = Date.now();
  const remainingMs = Math.max(0, targetEndMs - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const elapsedMs = Math.min(breakDurationSec * 1000, Math.max(0, now - startedAt));
  const pct = (elapsedMs / (breakDurationSec * 1000)) * 100;

  countdownEl.textContent = formatSec(remainingSec);
  progressFillEl.style.width = `${pct.toFixed(1)}%`;

  if (remainingMs <= 0) {
    doneBtn.disabled = false;
    breakBadgeEl.textContent = 'READY';
    breakBadgeEl.dataset.ready = 'true';
    countdownSubEl.textContent = 'Look-away time complete! Click "Done, Continue" for the next cycle.';
  } else {
    countdownSubEl.textContent = `Keep looking away for ${remainingSec}s...`;
  }
}

doneBtn.addEventListener('click', async () => {
  if (doneBtn.disabled) return;
  doneBtn.disabled = true;
  try {
    await chrome.runtime.sendMessage({ type: 'COMPLETE_BREAK' });
  } catch (_) {}
  window.close();
});

stopBtn.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP' });
  } catch (_) {}
  window.close();
});

tick();
setInterval(tick, 200);
