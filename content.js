'use strict';

const OVERLAY_ID = 'eyebreak-inpage-banner-host';

function removeOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
}

function showOverlay(intervalMin, breakDurationSec) {
  removeOverlay();

  const host = document.createElement('div');
  host.id = OVERLAY_ID;
  host.style.cssText = [
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'z-index: 2147483647',
    'max-width: 340px',
    'background: #ffffff',
    'color: #12425e',
    'border: 2px solid #3a9ad9',
    'border-radius: 16px',
    'padding: 14px 16px',
    'box-shadow: 0 12px 32px rgba(18, 66, 94, 0.28)',
    'font-family: ui-rounded, "Nunito", system-ui, -apple-system, sans-serif'
  ].join(';');

  host.innerHTML = `
    <div style="font-weight:700;font-size:15px;margin-bottom:4px;">👀 Time to Look Away (${breakDurationSec}s)</div>
    <div style="font-size:12.5px;color:#4f7288;margin-bottom:10px;line-height:1.4;">
      ${intervalMin}m cycle complete. Look 20 ft (6 m) away for <b>${breakDurationSec}s</b>, then complete your break.
    </div>
    <div style="display:flex;gap:8px;">
      <button id="eyebreak-open-win" style="flex:1;padding:8px 10px;border:0;border-radius:10px;background:#3a9ad9;color:#fff;font-weight:700;font-size:12px;cursor:pointer;">
        Break Popup
      </button>
      <button id="eyebreak-done-btn" style="flex:1;padding:8px 10px;border:0;border-radius:10px;background:#36a077;color:#fff;font-weight:700;font-size:12px;cursor:pointer;">
        Done, Continue
      </button>
    </div>
  `;

  (document.fullscreenElement || document.body || document.documentElement).appendChild(host);

  const openBtn = host.querySelector('#eyebreak-open-win');
  const doneBtn = host.querySelector('#eyebreak-done-btn');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_BREAK_POPUP' }).catch(() => {});
    });
  }

  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      removeOverlay();
      chrome.runtime.sendMessage({ type: 'COMPLETE_BREAK' }).catch(() => {});
    });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'SHOW_BREAK_OVERLAY') {
    showOverlay(message.intervalMin || 20, message.breakDurationSec || 20);
  } else if (message.type === 'HIDE_BREAK_OVERLAY') {
    removeOverlay();
  }
});
