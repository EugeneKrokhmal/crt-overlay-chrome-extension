/**
 * Single source of truth for all extension options.
 * Add one entry here when adding a new option; config and popup derive from this.
 *
 * Entry: { name, key, default, type, popupId?, fillId?, min?, max?, optionName?, contentKey? }
 * - optionName: overlay CSS option name (scanline, vignette, glow).
 * - contentKey: key used in options object sent to content script (default: optionName || key).
 */

export const OPTION_ENTRIES = [
  { name: "ENABLED", key: "crtEnabled", default: false, type: "checkbox", popupId: "crt-enabled", contentKey: null },
  { name: "SOUND_FILTER", key: "soundFilterEnabled", default: false, type: "checkbox", popupId: "crt-sound-filter", contentKey: "soundFilter" },
  { name: "SOUND_EFFECT_LEVEL", key: "soundEffectLevel", default: 0.8, type: "slider", popupId: "sound-effect-level", fillId: "sound-effect-fill", min: 0, max: 1 },
  { name: "SOUND_NOISE_LEVEL", key: "soundNoiseLevel", default: 0.6, type: "slider", popupId: "sound-noise-level", fillId: "sound-noise-fill", min: 0, max: 1 },
  { name: "SOUND_OVERRIDE_LEVEL", key: "soundOverdriveLevel", default: 0, type: "slider", popupId: "sound-overdrive-level", fillId: "sound-overdrive-fill", min: 0, max: 1 },
  { name: "SOUND_CHORUS_LEVEL", key: "soundChorusLevel", default: 0, type: "slider", popupId: "sound-chorus-level", fillId: "sound-chorus-fill", min: 0, max: 1 },
  { name: "VHS_GLITCHES", key: "vhsGlitchesEnabled", default: false, type: "checkbox", popupId: "crt-vhs-glitches", contentKey: "vhsGlitches" },
  { name: "GLITCH_PHASE_LEVEL", key: "glitchPhaseLevel", default: 0.3, type: "slider", popupId: "glitch-phase-level", fillId: "glitch-phase-fill", min: 0, max: 1 },
  { name: "GLITCH_NOISE_LEVEL", key: "glitchNoiseLevel", default: 0.15, type: "slider", popupId: "glitch-noise-level", fillId: "glitch-noise-fill", min: 0, max: 1 },
  { name: "GLITCH_TRACKING_LEVEL", key: "glitchTrackingLevel", default: 0.5, type: "slider", popupId: "glitch-tracking-level", fillId: "glitch-tracking-fill", min: 0, max: 1 },
  { name: "GLITCH_WOBBLE_LEVEL", key: "glitchWobbleLevel", default: 0.3, type: "slider", popupId: "glitch-wobble-level", fillId: "glitch-wobble-fill", min: 0, max: 1 },
  { name: "GLITCH_HEADSWITCH_LEVEL", key: "glitchHeadswitchLevel", default: 0.25, type: "slider", popupId: "glitch-headswitch-level", fillId: "glitch-headswitch-fill", min: 0, max: 1 },
  { name: "GLITCH_RGB_LEVEL", key: "glitchRgbLevel", default: 0.35, type: "slider", popupId: "glitch-rgb-level", fillId: "glitch-rgb-fill", min: 0, max: 1 },
  { name: "GLITCH_DROPOUT_LEVEL", key: "glitchDropoutLevel", default: 0.2, type: "slider", popupId: "glitch-dropout-level", fillId: "glitch-dropout-fill", min: 0, max: 1 },
  { name: "GLITCH_REWIND_LEVEL", key: "glitchRewindLevel", default: 0.4, type: "slider", popupId: "glitch-rewind-level", fillId: "glitch-rewind-fill", min: 0, max: 1 },
  { name: "SCANLINE", key: "scanlineIntensity", default: 0.4, type: "slider", popupId: "scanline", fillId: "scanline-fill", min: 0, max: 1, optionName: "scanline" },
  { name: "VIGNETTE", key: "vignetteIntensity", default: 0.5, type: "slider", popupId: "vignette", fillId: "vignette-fill", min: 0, max: 1, optionName: "vignette" },
  { name: "GLOW", key: "glowIntensity", default: 0.15, type: "slider", popupId: "glow", fillId: "glow-fill", min: 0, max: 0.8, optionName: "glow" },
];

const entries = OPTION_ENTRIES;

export const STORAGE_KEYS = Object.fromEntries(entries.map((e) => [e.name, e.key]));
export const DEFAULT_OPTIONS = Object.fromEntries(entries.map((e) => [e.key, e.default]));
export const STORAGE_KEYS_LIST = entries.map((e) => e.key);

const sliderEntries = entries.filter((e) => e.type === "slider");
export const OPTION_SLIDER_KEYS = entries.filter((e) => e.optionName).map((e) => e.key);
export const STORAGE_KEY_TO_OPTION = Object.fromEntries(entries.filter((e) => e.optionName).map((e) => [e.key, e.optionName]));
export const OPTION_TO_STORAGE_KEY = Object.fromEntries(entries.filter((e) => e.optionName).map((e) => [e.optionName, e.key]));

export const POPUP_IDS = Object.fromEntries(entries.filter((e) => e.popupId).map((e) => [e.name, e.popupId]));
export const SLIDER_RANGE = Object.fromEntries(sliderEntries.map((e) => [e.popupId, { min: e.min, max: e.max }]));
export const FILL_IDS = Object.fromEntries(entries.filter((e) => e.fillId).map((e) => [e.popupId, e.fillId]));
export const SLIDER_ID_TO_STORAGE_KEY = Object.fromEntries(sliderEntries.map((e) => [e.popupId, e.key]));

/** Content key for an entry (option name for overlay sliders, contentKey for checkboxes, key for other sliders) */
export function getContentKey(entry) {
  if (entry.contentKey != null) return entry.contentKey;
  return entry.optionName ?? entry.key;
}
