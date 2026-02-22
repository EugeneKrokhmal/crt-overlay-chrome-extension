/**
 * Content script entry: wires overlay + sound filter to storage and messages.
 */
import { STORAGE_KEYS, DEFAULT_OPTIONS, STORAGE_KEYS_LIST, MESSAGE } from "../shared/config.js";
import { storage } from "../shared/chrome-facade.js";
import { CRTOverlay } from "./overlay.js";
import { VHSSoundFilter } from "./soundFilter.js";

const overlay = new CRTOverlay();
const soundFilter = new VHSSoundFilter();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const response = overlay.handleMessage(msg);
  if (msg.type === MESSAGE.SET_OPTIONS && msg.options) {
    const opts = msg.options;
    soundFilter.setEnabled(opts.soundFilter, opts.soundEffectLevel, opts.soundNoiseLevel, opts.soundOverdriveLevel, opts.soundChorusLevel);
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

function runWhenReady() {
  storage.get(STORAGE_KEYS_LIST, (data) => {
    overlay.initFromStorage(data);
    const soundEnabled = data[STORAGE_KEYS.SOUND_FILTER] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_FILTER];
    const effectLevel = data[STORAGE_KEYS.SOUND_EFFECT_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_EFFECT_LEVEL];
    const noiseLevel = data[STORAGE_KEYS.SOUND_NOISE_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_NOISE_LEVEL];
    const overdriveLevel = data[STORAGE_KEYS.SOUND_OVERRIDE_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_OVERRIDE_LEVEL];
    const chorusLevel = data[STORAGE_KEYS.SOUND_CHORUS_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_CHORUS_LEVEL];
    soundFilter.setEnabled(!!soundEnabled, effectLevel, noiseLevel, overdriveLevel, chorusLevel);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runWhenReady);
} else {
  runWhenReady();
}
