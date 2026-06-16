/**
 * Named preset storage for popup settings.
 * Each preset stores the full storage payload (all option keys + enabled state).
 */

export const PRESETS_STORAGE_KEY = "crtPresets";
export const MAX_PRESETS = 12;

/** @typedef {{ id: string, name: string, builtin?: boolean, settings: Record<string, boolean|number> }} Preset */

export function createPresetId() {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {string} name */
export function normalizePresetName(name) {
  return name.trim().slice(0, 32);
}

/** @param {string} name */
export function isValidPresetName(name) {
  return normalizePresetName(name).length > 0;
}

/** @param {unknown} value */
export function sanitizePresetsList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p) => p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string" && p.settings && typeof p.settings === "object")
    .slice(0, MAX_PRESETS);
}

/** Default values for newly added keys so every builtin preset is fully self-contained. */
const NEW_KEY_DEFAULTS = {
  flickerIntensity: 0,
  interlace: false,
  signalBands: false,
  wowFlutter: 0,
  channelStatic: false,
  vhsTimestamp: false,
  tapeCounter: false,
};

/**
 * Built-in presets — shown at the top of the list and cannot be deleted.
 * Values captured from user's saved presets.
 * Glow slider range is 0–0.8, so: pct * 0.8 = stored value.
 */
export const DEFAULT_PRESETS = [
  {
    id: "builtin-weak-signal",
    name: "Weak Signal",
    builtin: true,
    settings: { ...NEW_KEY_DEFAULTS,
      crtEnabled: false,
      scanlineIntensity: 0.88,
      vignetteIntensity: 0.42,
      glowIntensity: 0.36,
      phosphorIntensity: 0.01,
      soundFilterEnabled: false,
      soundNoiseLevel: 0.13,
      soundEffectLevel: 0.65,
      soundOverdriveLevel: 0.05,
      soundChorusLevel: 0.90,
      vhsGlitchesEnabled: false,
      glitchPhaseLevel: 0.72,
      glitchNoiseLevel: 0.09,
      glitchTrackingLevel: 0.08,
      glitchWobbleLevel: 0.39,
      glitchHeadswitchLevel: 0.19,
      glitchRgbLevel: 0.09,
      glitchDropoutLevel: 0.18,
      glitchRewindLevel: 0.49,
      soundMono: false,
      filterSaturation: 1,
      filterContrast: 1,
      filterSharpness: 0,
      filterHue: 0,
    },
  },
  {
    id: "builtin-scan",
    name: "Scan",
    builtin: true,
    settings: { ...NEW_KEY_DEFAULTS,
      crtEnabled: true,
      scanlineIntensity: 0.16,
      vignetteIntensity: 0.13,
      glowIntensity: 0.048,
      phosphorIntensity: 0.48,
      soundFilterEnabled: false,
      soundNoiseLevel: 0.20,
      soundEffectLevel: 0.25,
      soundOverdriveLevel: 0.25,
      soundChorusLevel: 1.00,
      vhsGlitchesEnabled: false,
      glitchPhaseLevel: 0.35,
      glitchNoiseLevel: 0.65,
      glitchTrackingLevel: 0.60,
      glitchWobbleLevel: 0.30,
      glitchHeadswitchLevel: 0.05,
      glitchRgbLevel: 0.50,
      glitchDropoutLevel: 0.40,
      glitchRewindLevel: 0.65,
      soundMono: false,
      filterSaturation: 1,
      filterContrast: 1,
      filterSharpness: 0,
      filterHue: 0,
    },
  },
  {
    id: "builtin-vhs",
    name: "VHS",
    builtin: true,
    settings: { ...NEW_KEY_DEFAULTS,
      crtEnabled: true,
      scanlineIntensity: 0.16,
      vignetteIntensity: 0.13,
      glowIntensity: 0.048,
      phosphorIntensity: 0.48,
      soundFilterEnabled: true,
      soundNoiseLevel: 0.07,
      soundEffectLevel: 1.00,
      soundOverdriveLevel: 1.00,
      soundChorusLevel: 0.13,
      vhsGlitchesEnabled: true,
      glitchPhaseLevel: 0.35,
      glitchNoiseLevel: 0.12,
      glitchTrackingLevel: 0.00,
      glitchWobbleLevel: 0.00,
      glitchHeadswitchLevel: 0.01,
      glitchRgbLevel: 0.01,
      glitchDropoutLevel: 0.02,
      glitchRewindLevel: 0.06,
      soundMono: false,
      filterSaturation: 1,
      filterContrast: 1,
      filterSharpness: 0,
      filterHue: 0,
    },
  },
  {
    id: "builtin-vhs2",
    name: "VHS 2",
    builtin: true,
    settings: { ...NEW_KEY_DEFAULTS,
      crtEnabled: true,
      scanlineIntensity: 0.54,
      vignetteIntensity: 0.13,
      glowIntensity: 0.728,
      phosphorIntensity: 0.54,
      soundFilterEnabled: true,
      soundNoiseLevel: 0.14,
      soundEffectLevel: 0.87,
      soundOverdriveLevel: 0.00,
      soundChorusLevel: 0.23,
      vhsGlitchesEnabled: true,
      glitchPhaseLevel: 0.15,
      glitchNoiseLevel: 0.21,
      glitchTrackingLevel: 0.03,
      glitchWobbleLevel: 0.00,
      glitchHeadswitchLevel: 0.01,
      glitchRgbLevel: 0.01,
      glitchDropoutLevel: 0.02,
      glitchRewindLevel: 0.06,
      soundMono: false,
      filterSaturation: 1,
      filterContrast: 1,
      filterSharpness: 0,
      filterHue: 0,
    },
  },
  {
    id: "builtin-clean",
    name: "Clean",
    builtin: true,
    settings: { ...NEW_KEY_DEFAULTS,
      crtEnabled: false,
      scanlineIntensity: 0.54,
      vignetteIntensity: 0.13,
      glowIntensity: 0.728,
      phosphorIntensity: 0.54,
      soundFilterEnabled: true,
      soundNoiseLevel: 0.14,
      soundEffectLevel: 0.87,
      soundOverdriveLevel: 0.00,
      soundChorusLevel: 0.23,
      vhsGlitchesEnabled: false,
      glitchPhaseLevel: 0.15,
      glitchNoiseLevel: 0.21,
      glitchTrackingLevel: 0.03,
      glitchWobbleLevel: 0.00,
      glitchHeadswitchLevel: 0.01,
      glitchRgbLevel: 0.01,
      glitchDropoutLevel: 0.02,
      glitchRewindLevel: 0.06,
      soundMono: false,
      filterSaturation: 1,
      filterContrast: 1,
      filterSharpness: 0,
      filterHue: 0,
    },
  },
];
