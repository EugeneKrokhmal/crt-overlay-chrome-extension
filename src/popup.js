/**
 * Popup UI controller: syncs form state with storage and broadcasts to all tabs.
 * Option list is driven by OPTION_ENTRIES (shared/options-schema.js).
 */
import {
  OPTION_ENTRIES,
  getContentKey,
  STORAGE_KEYS,
  DEFAULT_OPTIONS,
  STORAGE_KEYS_LIST,
  POPUP_IDS,
  SLIDER_RANGE,
  FILL_IDS,
  MESSAGE,
} from "./shared/config.js";
import { storage, tabs } from "./shared/chrome-facade.js";
import { logExtensionWarning } from "./shared/logger.js";

const SAVE_DEBOUNCE_MS = 80;

class PopupController {
  constructor() {
    this._enabledEl = null;
    this._saveDebounceTimer = null;
  }

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

  /** Read current option values from the form (schema-driven). */
  getOptionsFromForm() {
    const options = {};
    for (const entry of OPTION_ENTRIES) {
      if (entry.name === "ENABLED" || !entry.popupId) continue;
      const contentKey = getContentKey(entry);
      const el = this._getElement(entry.popupId);
      const raw = entry.type === "checkbox" ? (el?.checked ?? entry.default) : (el ? parseFloat(el.value) : entry.default);
      const value = entry.type === "checkbox" ? !!raw : (Number.isNaN(raw) ? entry.default : raw);
      options[contentKey] = value;
    }
    return options;
  }

  /** Build storage payload from enabled + options (schema-driven). */
  _buildStoragePayload(enabled, options) {
    const payload = { [STORAGE_KEYS.ENABLED]: enabled };
    for (const entry of OPTION_ENTRIES) {
      if (entry.name === "ENABLED") continue;
      const contentKey = getContentKey(entry);
      payload[entry.key] = options[contentKey] ?? entry.default;
    }
    return payload;
  }

  /** Build options object for content script from storage payload. */
  _payloadToMsgOptions(payload) {
    const msgOptions = {};
    for (const entry of OPTION_ENTRIES) {
      if (entry.name === "ENABLED") continue;
      msgOptions[getContentKey(entry)] = payload[entry.key];
    }
    return msgOptions;
  }

  saveAndBroadcast(enabled, options) {
    const payload = this._buildStoragePayload(enabled, options);
    storage.set(payload, () => {
      if (chrome.runtime.lastError) return;
      const msgOptions = this._payloadToMsgOptions(payload);
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

  /** Apply a storage-shaped payload to form fields (schema-driven). */
  _applyPayloadToForm(data) {
    if (!data) return;
    for (const entry of OPTION_ENTRIES) {
      if (!entry.popupId) continue;
      const el = this._getElement(entry.popupId);
      if (!el) continue;
      if (entry.type === "checkbox") el.checked = !!data[entry.key];
      else if (data[entry.key] != null) el.value = data[entry.key];
    }
  }

  loadFromStorage() {
    storage.get(STORAGE_KEYS_LIST, (data) => {
      this._applyPayloadToForm(data);
      this._updateTrackFills();
      this._updateStateLabels();
    });
  }

  resetToDefaults() {
    this._applyPayloadToForm(DEFAULT_OPTIONS);
    this._updateTrackFills();
    this._updateStateLabels();
    const enabled = this._enabledEl?.checked ?? false;
    this.saveAndBroadcast(enabled, this.getOptionsFromForm());
  }

  randomize() {
    for (const entry of OPTION_ENTRIES) {
      if (!entry.popupId) continue;
      const el = this._getElement(entry.popupId);
      if (!el) continue;
      if (entry.type === "checkbox") {
        el.checked = Math.random() < 0.5;
      } else if (entry.type === "slider" && entry.min != null && entry.max != null) {
        const val = entry.min + Math.random() * (entry.max - entry.min);
        el.value = String(Math.round(val * 100) / 100);
      }
    }
    if (this._enabledEl) this._enabledEl.checked = Math.random() < 0.4;
    this._updateTrackFills();
    this._updateStateLabels();
    const enabled = this._enabledEl?.checked ?? false;
    this.saveAndBroadcast(enabled, this.getOptionsFromForm());
  }

  bindEvents() {
    this._enabledEl?.addEventListener("change", () => {
      this._updateStateLabels();
      this.saveAndBroadcast(this._enabledEl.checked, this.getOptionsFromForm());
    });
    for (const entry of OPTION_ENTRIES) {
      if (!entry.popupId) continue;
      const el = this._getElement(entry.popupId);
      if (!el) continue;
      if (entry.type === "checkbox") {
        el.addEventListener("change", () => {
          this._updateStateLabels();
          this.saveAndBroadcast(this._enabledEl?.checked ?? false, this.getOptionsFromForm());
        });
      } else {
        el.addEventListener("input", () => {
          this._updateTrackFills();
          this._debouncedSaveAndBroadcast();
        });
      }
    }
    this._getElement("crt-reset-btn")?.addEventListener("click", () => this.resetToDefaults());
    this._getElement("crt-random-btn")?.addEventListener("click", () => this.randomize());
  }

  _updateTrackFills() {
    for (const [sliderId, fillId] of Object.entries(FILL_IDS)) {
      const range = SLIDER_RANGE[sliderId] ?? { min: 0, max: 1 };
      const el = this._getElement(sliderId);
      const fill = this._getElement(fillId);
      if (!el || !fill) continue;
      const val = parseFloat(el.value) || range.min;
      const pct = ((val - range.min) / (range.max - range.min)) * 100;
      fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
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
