/**
 * Content script entry: wires overlay + sound filter to storage and messages.
 */
import { STORAGE_KEYS, DEFAULT_OPTIONS, STORAGE_KEYS_LIST, MESSAGE } from "../shared/config.js";
import { storage } from "../shared/chrome-facade.js";
import { CRTOverlay } from "./overlay.js";
import { VHSSoundFilter } from "./soundFilter.js";

const overlay = new CRTOverlay();
const soundFilter = new VHSSoundFilter();

// Track whether channel static is currently enabled
let _channelStaticEnabled = false;

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const response = overlay.handleMessage(msg);
  if (msg.type === MESSAGE.SET_OPTIONS && msg.options) {
    const opts = msg.options;
    _channelStaticEnabled = !!opts.channelStatic;
    soundFilter.setEnabled(opts.soundFilter, opts.soundEffectLevel, opts.soundNoiseLevel, opts.soundOverdriveLevel, opts.soundChorusLevel, opts.soundMono, opts.wowFlutter);
  }
  if (msg.type === MESSAGE.TOGGLE) {
    overlay.showToggleIndicator(!!msg.enabled);
  }
  if (response && typeof response.then === "function") {
    response.then(sendResponse);
    return true;
  }
  if (response != null) {
    sendResponse(response);
    return true;
  }
  return false;
});

// ── Storage init ─────────────────────────────────────────────────────────────

function runWhenReady() {
  storage.get(STORAGE_KEYS_LIST, (data) => {
    overlay.initFromStorage(data);
    const soundEnabled = data[STORAGE_KEYS.SOUND_FILTER] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_FILTER];
    const effectLevel = data[STORAGE_KEYS.SOUND_EFFECT_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_EFFECT_LEVEL];
    const noiseLevel = data[STORAGE_KEYS.SOUND_NOISE_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_NOISE_LEVEL];
    const overdriveLevel = data[STORAGE_KEYS.SOUND_OVERRIDE_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_OVERRIDE_LEVEL];
    const chorusLevel = data[STORAGE_KEYS.SOUND_CHORUS_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_CHORUS_LEVEL];
    const mono = data[STORAGE_KEYS.SOUND_MONO] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_MONO];
    const wowFlutter = data[STORAGE_KEYS.WOW_FLUTTER] ?? DEFAULT_OPTIONS[STORAGE_KEYS.WOW_FLUTTER];
    soundFilter.setEnabled(!!soundEnabled, effectLevel, noiseLevel, overdriveLevel, chorusLevel, mono, wowFlutter);

    _channelStaticEnabled = !!(data[STORAGE_KEYS.CHANNEL_STATIC] ?? DEFAULT_OPTIONS[STORAGE_KEYS.CHANNEL_STATIC]);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runWhenReady);
} else {
  runWhenReady();
}

// ── SPA navigation detection ─────────────────────────────────────────────────

// Only fire after the initial page load settles (guards against frameworks that
// call pushState with the same URL during their own boot sequence).
let _navReady = false;
setTimeout(() => { _navReady = true; }, 1000);

window.addEventListener("popstate", () => {
  if (_channelStaticEnabled && _navReady) overlay.flashChannelStatic();
});

// Intercept history.pushState — only trigger when the URL meaningfully changes.
(function patchHistoryPushState() {
  const orig = history.pushState.bind(history);
  history.pushState = function (...args) {
    const before = location.href;
    orig(...args);
    if (_channelStaticEnabled && _navReady && location.href !== before) {
      overlay.flashChannelStatic();
    }
  };
})();
