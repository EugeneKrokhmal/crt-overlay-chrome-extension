/**
 * Shared configuration for CRT overlay extension.
 * Single source of truth for storage keys, defaults, and message types.
 *
 * When adding a new option:
 * 1. Add key to STORAGE_KEYS and value to DEFAULT_OPTIONS.
 * 2. Add to STORAGE_KEYS_LIST.
 * 3. If it's a slider: add to OPTION_SLIDER_KEYS and to STORAGE_KEY_TO_OPTION / OPTION_TO_STORAGE_KEY.
 * 4. In popup.js: add to POPUP_IDS, and to SLIDER_RANGE / FILL_IDS if it's a slider.
 */

export const STORAGE_KEYS = {
  ENABLED: "crtEnabled",
  SCANLINE: "scanlineIntensity",
  VIGNETTE: "vignetteIntensity",
  CURVATURE: "curvatureIntensity",
  GLOW: "glowIntensity",
  SOUND_FILTER: "soundFilterEnabled",
  SOUND_EFFECT_LEVEL: "soundEffectLevel",
  SOUND_NOISE_LEVEL: "soundNoiseLevel",
  VHS_GLITCHES: "vhsGlitchesEnabled",
  GLITCH_PHASE_LEVEL: "glitchPhaseLevel",
  GLITCH_NOISE_LEVEL: "glitchNoiseLevel",
};

export const DEFAULT_OPTIONS = {
  [STORAGE_KEYS.ENABLED]: false,
  [STORAGE_KEYS.SCANLINE]: 0.4,
  [STORAGE_KEYS.VIGNETTE]: 0.5,
  [STORAGE_KEYS.CURVATURE]: 0.15,
  [STORAGE_KEYS.GLOW]: 0.1,
  [STORAGE_KEYS.SOUND_FILTER]: false,
  [STORAGE_KEYS.SOUND_EFFECT_LEVEL]: 0.8,
  [STORAGE_KEYS.SOUND_NOISE_LEVEL]: 0.6,
  [STORAGE_KEYS.VHS_GLITCHES]: false,
  [STORAGE_KEYS.GLITCH_PHASE_LEVEL]: 0.3,
  [STORAGE_KEYS.GLITCH_NOISE_LEVEL]: 0.15,
};

/** All storage keys as array for batch get/set */
export const STORAGE_KEYS_LIST = [
  STORAGE_KEYS.ENABLED,
  STORAGE_KEYS.SCANLINE,
  STORAGE_KEYS.VIGNETTE,
  STORAGE_KEYS.CURVATURE,
  STORAGE_KEYS.GLOW,
  STORAGE_KEYS.SOUND_FILTER,
  STORAGE_KEYS.SOUND_EFFECT_LEVEL,
  STORAGE_KEYS.SOUND_NOISE_LEVEL,
  STORAGE_KEYS.VHS_GLITCHES,
  STORAGE_KEYS.GLITCH_PHASE_LEVEL,
  STORAGE_KEYS.GLITCH_NOISE_LEVEL,
];

/** Option keys that are sliders (excludes ENABLED and SOUND_FILTER) */
export const OPTION_SLIDER_KEYS = [
  STORAGE_KEYS.SCANLINE,
  STORAGE_KEYS.VIGNETTE,
  STORAGE_KEYS.CURVATURE,
  STORAGE_KEYS.GLOW,
];

export const MESSAGE = {
  TOGGLE: "toggle",
  SET_OPTIONS: "setOptions",
  GET_STATE: "getState",
};

/**
 * Standard message response shape: { ok: boolean, data?: unknown }.
 * Async handlers must return a Promise that resolves to this; the listener must return true
 * when the handler is async so sendResponse remains valid.
 */
export function messageResponse(ok, data = undefined) {
  return data === undefined ? { ok } : { ok, data };
}

/** Map storage key to option name (camelCase) */
export const STORAGE_KEY_TO_OPTION = {
  [STORAGE_KEYS.SCANLINE]: "scanline",
  [STORAGE_KEYS.VIGNETTE]: "vignette",
  [STORAGE_KEYS.CURVATURE]: "curvature",
  [STORAGE_KEYS.GLOW]: "glow",
};

/** Option name to storage key (reverse map) */
export const OPTION_TO_STORAGE_KEY = {
  scanline: STORAGE_KEYS.SCANLINE,
  vignette: STORAGE_KEYS.VIGNETTE,
  curvature: STORAGE_KEYS.CURVATURE,
  glow: STORAGE_KEYS.GLOW,
};

/** URL prefixes for tabs we must not send messages to */
export const RESTRICTED_URL_PREFIXES = ["chrome://", "chrome-extension://", "edge://"];

/** True if we can sendMessage to this tab */
export function isMessageableTab(tab) {
  return tab.id && tab.url && !RESTRICTED_URL_PREFIXES.some((p) => tab.url.startsWith(p));
}
