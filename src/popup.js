/**
 * Popup UI controller: syncs form state with storage and broadcasts to all tabs.
 * Popup uses VHS OSD styling (no Bulma).
 */
import {
  STORAGE_KEYS,
  DEFAULT_OPTIONS,
  STORAGE_KEYS_LIST,
  STORAGE_KEY_TO_OPTION,
  OPTION_TO_STORAGE_KEY,
  OPTION_SLIDER_KEYS,
  MESSAGE,
} from "./shared/config.js";
import { storage, tabs } from "./shared/chrome-facade.js";
import { logExtensionWarning } from "./shared/logger.js";

const POPUP_IDS = {
  ENABLED: "crt-enabled",
  SOUND_FILTER: "crt-sound-filter",
  SOUND_EFFECT_LEVEL: "sound-effect-level",
  SOUND_NOISE_LEVEL: "sound-noise-level",
  VHS_GLITCHES: "crt-vhs-glitches",
  GLITCH_PHASE_LEVEL: "glitch-phase-level",
  GLITCH_NOISE_LEVEL: "glitch-noise-level",
  GLITCH_TRACKING_LEVEL: "glitch-tracking-level",
  GLITCH_WOBBLE_LEVEL: "glitch-wobble-level",
  GLITCH_HEADSWITCH_LEVEL: "glitch-headswitch-level",
  GLITCH_RGB_LEVEL: "glitch-rgb-level",
  GLITCH_DROPOUT_LEVEL: "glitch-dropout-level",
  SCANLINE: "scanline",
  VIGNETTE: "vignette",
  GLOW: "glow",
};

/** Slider id -> { min, max } for fill width % (default 0-1) */
const SLIDER_RANGE = {
  [POPUP_IDS.SOUND_EFFECT_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.SOUND_NOISE_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.GLITCH_PHASE_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.GLITCH_NOISE_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.GLITCH_TRACKING_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.GLITCH_WOBBLE_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.GLITCH_HEADSWITCH_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.GLITCH_RGB_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.GLITCH_DROPOUT_LEVEL]: { min: 0, max: 1 },
  [POPUP_IDS.SCANLINE]: { min: 0, max: 1 },
  [POPUP_IDS.VIGNETTE]: { min: 0, max: 1 },
  [POPUP_IDS.GLOW]: { min: 0, max: 0.8 },
};

const FILL_IDS = {
  [POPUP_IDS.SOUND_EFFECT_LEVEL]: "sound-effect-fill",
  [POPUP_IDS.SOUND_NOISE_LEVEL]: "sound-noise-fill",
  [POPUP_IDS.GLITCH_PHASE_LEVEL]: "glitch-phase-fill",
  [POPUP_IDS.GLITCH_NOISE_LEVEL]: "glitch-noise-fill",
  [POPUP_IDS.GLITCH_TRACKING_LEVEL]: "glitch-tracking-fill",
  [POPUP_IDS.GLITCH_WOBBLE_LEVEL]: "glitch-wobble-fill",
  [POPUP_IDS.GLITCH_HEADSWITCH_LEVEL]: "glitch-headswitch-fill",
  [POPUP_IDS.GLITCH_RGB_LEVEL]: "glitch-rgb-fill",
  [POPUP_IDS.GLITCH_DROPOUT_LEVEL]: "glitch-dropout-fill",
  [POPUP_IDS.SCANLINE]: "scanline-fill",
  [POPUP_IDS.VIGNETTE]: "vignette-fill",
  [POPUP_IDS.GLOW]: "glow-fill",
};

const SAVE_DEBOUNCE_MS = 80;

class PopupController {
  constructor() {
    this._enabledEl = null;
    this._saveDebounceTimer = null;
    this._sliderIdsByOption = {
      scanline: POPUP_IDS.SCANLINE,
      vignette: POPUP_IDS.VIGNETTE,
      glow: POPUP_IDS.GLOW,
    };
  }

  /** Debounced save+broadcast for slider input; call saveAndBroadcast directly for toggles */
  _debouncedSaveAndBroadcast() {
    if (this._saveDebounceTimer != null) clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = setTimeout(() => {
      this._saveDebounceTimer = null;
      const enabled = this._enabledEl?.checked ?? false;
      this.saveAndBroadcast(enabled, this.getOptionsFromForm());
    }, SAVE_DEBOUNCE_MS);
  }

  _getElement(id) {
    return document.getElementById(id);
  }

  /** Read current option values from the form (sliders + sound filter) */
  getOptionsFromForm() {
    const options = {};
    for (const [optionName, id] of Object.entries(this._sliderIdsByOption)) {
      const el = this._getElement(id);
      const storageKey = OPTION_TO_STORAGE_KEY[optionName];
      const defaultVal = DEFAULT_OPTIONS[storageKey];
      const value = el ? parseFloat(el.value) : defaultVal;
      options[optionName] = Number.isNaN(value) ? defaultVal : value;
    }
    options.soundFilter = this._getElement(POPUP_IDS.SOUND_FILTER)?.checked ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_FILTER];
    const effectEl = this._getElement(POPUP_IDS.SOUND_EFFECT_LEVEL);
    const noiseEl = this._getElement(POPUP_IDS.SOUND_NOISE_LEVEL);
    options.soundEffectLevel = effectEl ? parseFloat(effectEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_EFFECT_LEVEL];
    options.soundNoiseLevel = noiseEl ? parseFloat(noiseEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_NOISE_LEVEL];
    if (Number.isNaN(options.soundEffectLevel)) options.soundEffectLevel = DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_EFFECT_LEVEL];
    if (Number.isNaN(options.soundNoiseLevel)) options.soundNoiseLevel = DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_NOISE_LEVEL];
    options.vhsGlitches = this._getElement(POPUP_IDS.VHS_GLITCHES)?.checked ?? DEFAULT_OPTIONS[STORAGE_KEYS.VHS_GLITCHES];
    const phaseEl = this._getElement(POPUP_IDS.GLITCH_PHASE_LEVEL);
    const videoNoiseEl = this._getElement(POPUP_IDS.GLITCH_NOISE_LEVEL);
    options.glitchPhaseLevel = phaseEl ? parseFloat(phaseEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_PHASE_LEVEL];
    options.glitchNoiseLevel = videoNoiseEl ? parseFloat(videoNoiseEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_NOISE_LEVEL];
    const trackingEl = this._getElement(POPUP_IDS.GLITCH_TRACKING_LEVEL);
    const wobbleEl = this._getElement(POPUP_IDS.GLITCH_WOBBLE_LEVEL);
    const headswitchEl = this._getElement(POPUP_IDS.GLITCH_HEADSWITCH_LEVEL);
    options.glitchTrackingLevel = trackingEl ? parseFloat(trackingEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_TRACKING_LEVEL];
    options.glitchWobbleLevel = wobbleEl ? parseFloat(wobbleEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL];
    options.glitchHeadswitchLevel = headswitchEl ? parseFloat(headswitchEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL];
    const rgbEl = this._getElement(POPUP_IDS.GLITCH_RGB_LEVEL);
    const dropoutEl = this._getElement(POPUP_IDS.GLITCH_DROPOUT_LEVEL);
    options.glitchRgbLevel = rgbEl ? parseFloat(rgbEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_RGB_LEVEL];
    options.glitchDropoutLevel = dropoutEl ? parseFloat(dropoutEl.value) : DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL];
    if (Number.isNaN(options.glitchPhaseLevel)) options.glitchPhaseLevel = DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_PHASE_LEVEL];
    if (Number.isNaN(options.glitchNoiseLevel)) options.glitchNoiseLevel = DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_NOISE_LEVEL];
    if (Number.isNaN(options.glitchTrackingLevel)) options.glitchTrackingLevel = DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_TRACKING_LEVEL];
    if (Number.isNaN(options.glitchWobbleLevel)) options.glitchWobbleLevel = DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL];
    if (Number.isNaN(options.glitchHeadswitchLevel)) options.glitchHeadswitchLevel = DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL];
    if (Number.isNaN(options.glitchRgbLevel)) options.glitchRgbLevel = DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_RGB_LEVEL];
    if (Number.isNaN(options.glitchDropoutLevel)) options.glitchDropoutLevel = DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL];
    return options;
  }

  /** Build storage payload from enabled + options */
  _buildStoragePayload(enabled, options) {
    return {
      [STORAGE_KEYS.ENABLED]: enabled,
      [STORAGE_KEYS.SOUND_FILTER]: options.soundFilter ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_FILTER],
      [STORAGE_KEYS.SOUND_EFFECT_LEVEL]: options.soundEffectLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_EFFECT_LEVEL],
      [STORAGE_KEYS.SOUND_NOISE_LEVEL]: options.soundNoiseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.SOUND_NOISE_LEVEL],
      [STORAGE_KEYS.VHS_GLITCHES]: options.vhsGlitches ?? DEFAULT_OPTIONS[STORAGE_KEYS.VHS_GLITCHES],
      [STORAGE_KEYS.GLITCH_PHASE_LEVEL]: options.glitchPhaseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_PHASE_LEVEL],
      [STORAGE_KEYS.GLITCH_NOISE_LEVEL]: options.glitchNoiseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_NOISE_LEVEL],
      [STORAGE_KEYS.GLITCH_TRACKING_LEVEL]: options.glitchTrackingLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_TRACKING_LEVEL],
      [STORAGE_KEYS.GLITCH_WOBBLE_LEVEL]: options.glitchWobbleLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL],
      [STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL]: options.glitchHeadswitchLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL],
      [STORAGE_KEYS.GLITCH_RGB_LEVEL]: options.glitchRgbLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_RGB_LEVEL],
      [STORAGE_KEYS.GLITCH_DROPOUT_LEVEL]: options.glitchDropoutLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL],
      [STORAGE_KEYS.SCANLINE]: options.scanline,
      [STORAGE_KEYS.VIGNETTE]: options.vignette,
      [STORAGE_KEYS.GLOW]: options.glow,
    };
  }

  /** Save to storage and broadcast to all messageable tabs */
  saveAndBroadcast(enabled, options) {
    const payload = this._buildStoragePayload(enabled, options);
    storage.set(payload, () => {
      if (chrome.runtime.lastError) return;
      const msgOptions = {
        ...options,
        soundFilter: payload[STORAGE_KEYS.SOUND_FILTER],
        soundEffectLevel: payload[STORAGE_KEYS.SOUND_EFFECT_LEVEL],
        soundNoiseLevel: payload[STORAGE_KEYS.SOUND_NOISE_LEVEL],
        vhsGlitches: payload[STORAGE_KEYS.VHS_GLITCHES],
        glitchPhaseLevel: payload[STORAGE_KEYS.GLITCH_PHASE_LEVEL],
        glitchNoiseLevel: payload[STORAGE_KEYS.GLITCH_NOISE_LEVEL],
        glitchTrackingLevel: payload[STORAGE_KEYS.GLITCH_TRACKING_LEVEL],
        glitchWobbleLevel: payload[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL],
        glitchHeadswitchLevel: payload[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL],
        glitchRgbLevel: payload[STORAGE_KEYS.GLITCH_RGB_LEVEL],
        glitchDropoutLevel: payload[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL],
      };
      tabs.sendToMessageableTabs(
        { type: MESSAGE.SET_OPTIONS, options: msgOptions, visible: enabled },
        (err) => {
          if (!err) return;
          if (err.message && err.message.includes("Receiving end does not exist")) return;
          logExtensionWarning("Popup: sendMessage to tab failed", err);
        }
      );
    });
  }

  /** Cache form element references */
  _cacheElements() {
    this._enabledEl = this._getElement(POPUP_IDS.ENABLED);
  }

  _updateStateLabels() {
    const overlayLabel = this._getElement("overlay-label");
    const soundLabel = this._getElement("sound-label");
    const glitchesLabel = this._getElement("glitches-label");
    if (overlayLabel) overlayLabel.textContent = this._enabledEl?.checked ? "OVERLAY: ON" : "OVERLAY: OFF";
    if (soundLabel) soundLabel.textContent = this._getElement(POPUP_IDS.SOUND_FILTER)?.checked ? "VHS SOUND: ON" : "VHS SOUND: OFF";
    if (glitchesLabel) glitchesLabel.textContent = this._getElement(POPUP_IDS.VHS_GLITCHES)?.checked ? "VHS GLITCHES: ON" : "VHS GLITCHES: OFF";
  }

  /** Load storage into form */
  loadFromStorage() {
    storage.get(STORAGE_KEYS_LIST, (data) => {
      if (this._enabledEl) this._enabledEl.checked = !!data[STORAGE_KEYS.ENABLED];
      const soundEl = this._getElement(POPUP_IDS.SOUND_FILTER);
      if (soundEl) soundEl.checked = !!data[STORAGE_KEYS.SOUND_FILTER];
      const effectEl = this._getElement(POPUP_IDS.SOUND_EFFECT_LEVEL);
      if (effectEl && data[STORAGE_KEYS.SOUND_EFFECT_LEVEL] != null) effectEl.value = data[STORAGE_KEYS.SOUND_EFFECT_LEVEL];
      const noiseEl = this._getElement(POPUP_IDS.SOUND_NOISE_LEVEL);
      if (noiseEl && data[STORAGE_KEYS.SOUND_NOISE_LEVEL] != null) noiseEl.value = data[STORAGE_KEYS.SOUND_NOISE_LEVEL];
      const glitchesEl = this._getElement(POPUP_IDS.VHS_GLITCHES);
      if (glitchesEl) glitchesEl.checked = !!data[STORAGE_KEYS.VHS_GLITCHES];
      const phaseEl = this._getElement(POPUP_IDS.GLITCH_PHASE_LEVEL);
      if (phaseEl && data[STORAGE_KEYS.GLITCH_PHASE_LEVEL] != null) phaseEl.value = data[STORAGE_KEYS.GLITCH_PHASE_LEVEL];
      const glitchNoiseEl = this._getElement(POPUP_IDS.GLITCH_NOISE_LEVEL);
      if (glitchNoiseEl && data[STORAGE_KEYS.GLITCH_NOISE_LEVEL] != null) glitchNoiseEl.value = data[STORAGE_KEYS.GLITCH_NOISE_LEVEL];
      const trackingEl = this._getElement(POPUP_IDS.GLITCH_TRACKING_LEVEL);
      if (trackingEl && data[STORAGE_KEYS.GLITCH_TRACKING_LEVEL] != null) trackingEl.value = data[STORAGE_KEYS.GLITCH_TRACKING_LEVEL];
      const wobbleEl = this._getElement(POPUP_IDS.GLITCH_WOBBLE_LEVEL);
      if (wobbleEl && data[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL] != null) wobbleEl.value = data[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL];
      const headswitchEl = this._getElement(POPUP_IDS.GLITCH_HEADSWITCH_LEVEL);
      if (headswitchEl && data[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL] != null) headswitchEl.value = data[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL];
      const rgbEl = this._getElement(POPUP_IDS.GLITCH_RGB_LEVEL);
      if (rgbEl && data[STORAGE_KEYS.GLITCH_RGB_LEVEL] != null) rgbEl.value = data[STORAGE_KEYS.GLITCH_RGB_LEVEL];
      const dropoutEl = this._getElement(POPUP_IDS.GLITCH_DROPOUT_LEVEL);
      if (dropoutEl && data[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL] != null) dropoutEl.value = data[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL];

      OPTION_SLIDER_KEYS.forEach((storageKey) => {
        const optionName = STORAGE_KEY_TO_OPTION[storageKey];
        const id = this._sliderIdsByOption[optionName];
        const el = id ? this._getElement(id) : null;
        if (el && data[storageKey] != null) el.value = data[storageKey];
      });
      this._updateTrackFills();
      this._updateStateLabels();
    });
  }

  bindEvents() {
    this._enabledEl?.addEventListener("change", () => {
      this._updateStateLabels();
      this.saveAndBroadcast(this._enabledEl.checked, this.getOptionsFromForm());
    });
    this._getElement(POPUP_IDS.SOUND_FILTER)?.addEventListener("change", () => {
      this._updateStateLabels();
      this.saveAndBroadcast(this._enabledEl?.checked ?? false, this.getOptionsFromForm());
    });
    [POPUP_IDS.SOUND_EFFECT_LEVEL, POPUP_IDS.SOUND_NOISE_LEVEL].forEach((id) => {
      this._getElement(id)?.addEventListener("input", () => {
        this._updateTrackFills();
        this._debouncedSaveAndBroadcast();
      });
    });
    this._getElement(POPUP_IDS.VHS_GLITCHES)?.addEventListener("change", () => {
      this._updateStateLabels();
      this.saveAndBroadcast(this._enabledEl?.checked ?? false, this.getOptionsFromForm());
    });
    [
      POPUP_IDS.GLITCH_PHASE_LEVEL,
      POPUP_IDS.GLITCH_NOISE_LEVEL,
      POPUP_IDS.GLITCH_TRACKING_LEVEL,
      POPUP_IDS.GLITCH_WOBBLE_LEVEL,
      POPUP_IDS.GLITCH_HEADSWITCH_LEVEL,
      POPUP_IDS.GLITCH_RGB_LEVEL,
      POPUP_IDS.GLITCH_DROPOUT_LEVEL,
    ].forEach((id) => {
      this._getElement(id)?.addEventListener("input", () => {
        this._updateTrackFills();
        this._debouncedSaveAndBroadcast();
      });
    });

    Object.values(this._sliderIdsByOption).forEach((id) => {
      const el = this._getElement(id);
      el?.addEventListener("input", () => {
        this._updateTrackFills();
        this._debouncedSaveAndBroadcast();
      });
    });
  }

  _updateTrackFills() {
    Object.entries(FILL_IDS).forEach(([sliderId, fillId]) => {
      const range = SLIDER_RANGE[sliderId] || { min: 0, max: 1 };
      const el = this._getElement(sliderId);
      const fill = this._getElement(fillId);
      if (!el || !fill) return;
      const val = parseFloat(el.value) || range.min;
      const pct = ((val - range.min) / (range.max - range.min)) * 100;
      fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    });
  }

  init() {
    this._cacheElements();
    this.loadFromStorage();
    this.bindEvents();
    this._updateTrackFills();
    this._updateStateLabels();
  }
}

const controller = new PopupController();
controller.init();
