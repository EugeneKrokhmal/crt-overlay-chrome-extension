/**
 * Popup UI controller: syncs form state with storage and broadcasts to all tabs.
 * Option list is driven by OPTION_ENTRIES (shared/options-schema.js).
 */
import "./popup.css";
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
import {
  PRESETS_STORAGE_KEY,
  MAX_PRESETS,
  DEFAULT_PRESETS,
  createPresetId,
  normalizePresetName,
  isValidPresetName,
  sanitizePresetsList,
} from "./shared/presets.js";
import { storage, tabs } from "./shared/chrome-facade.js";
import { logExtensionWarning } from "./shared/logger.js";

const SAVE_DEBOUNCE_MS = 80;
const PRESET_STATUS_MS = 2200;

class PopupController {
  constructor() {
    this._enabledEl = null;
    this._saveDebounceTimer = null;
    this._presets = [];
    this._activePresetId = "";
    this._suppressPresetClear = false;
  }

  _debouncedSaveAndBroadcast() {
    if (this._saveDebounceTimer != null) clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = setTimeout(() => {
      this._saveDebounceTimer = null;
      const enabled = this._enabledEl?.checked ?? false;
      this.saveAndBroadcast(enabled, this.getOptionsFromForm());
    }, SAVE_DEBOUNCE_MS);
  }

  _flushSave() {
    if (this._saveDebounceTimer != null) {
      clearTimeout(this._saveDebounceTimer);
      this._saveDebounceTimer = null;
    }
    const enabled = this._enabledEl?.checked ?? false;
    this.saveAndBroadcast(enabled, this.getOptionsFromForm());
  }

  _getElement(id) {
    return document.getElementById(id);
  }

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

  getCurrentPayload() {
    const enabled = this._enabledEl?.checked ?? false;
    return this._buildStoragePayload(enabled, this.getOptionsFromForm());
  }

  _buildStoragePayload(enabled, options) {
    const payload = { [STORAGE_KEYS.ENABLED]: enabled };
    for (const entry of OPTION_ENTRIES) {
      if (entry.name === "ENABLED") continue;
      const contentKey = getContentKey(entry);
      payload[entry.key] = options[contentKey] ?? entry.default;
    }
    return payload;
  }

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

  _markCustomPreset() {
    if (this._suppressPresetClear) return;
    this._activePresetId = "";
    const select = this._getElement("preset-select");
    if (select) select.value = "";
  }

  _setPresetStatus(message, type = "") {
    const el = this._getElement("preset-status");
    if (!el) return;
    el.textContent = message;
    el.className = `preset-hint${type ? ` ${type}` : ""}`;
    if (this._statusTimer) clearTimeout(this._statusTimer);
    if (message) {
      this._statusTimer = setTimeout(() => {
        el.textContent = "";
        el.className = "preset-hint";
      }, PRESET_STATUS_MS);
    }
  }

  _persistPresets(callback) {
    storage.set({ [PRESETS_STORAGE_KEY]: this._presets }, callback);
  }

  _allPresets() {
    return [...DEFAULT_PRESETS, ...this._presets];
  }

  _loadPresets(callback) {
    storage.get(PRESETS_STORAGE_KEY, (data) => {
      this._presets = sanitizePresetsList(data[PRESETS_STORAGE_KEY]);
      this._renderPresetSelect();
      callback?.();
    });
  }

  _renderPresetSelect() {
    const select = this._getElement("preset-select");
    if (!select) return;
    const current = this._activePresetId;
    select.innerHTML = '<option value="">— Custom —</option>';
    for (const preset of this._allPresets()) {
      const opt = document.createElement("option");
      opt.value = preset.id;
      opt.textContent = preset.builtin ? `★ ${preset.name}` : preset.name;
      select.appendChild(opt);
    }
    select.value = this._allPresets().some((p) => p.id === current) ? current : "";
    this._updatePresetActions();
  }

  _updatePresetActions() {
    const deleteBtn = this._getElement("preset-delete-btn");
    const selectedId = this._getElement("preset-select")?.value;
    const isBuiltin = DEFAULT_PRESETS.some((p) => p.id === selectedId);
    if (deleteBtn) deleteBtn.disabled = !selectedId || isBuiltin;
  }

  _applyPresetById(id) {
    const preset = this._allPresets().find((p) => p.id === id);
    if (!preset) return;
    this._suppressPresetClear = true;
    this._applyPayloadToForm(preset.settings);
    this._updateSliders();
    this._suppressPresetClear = false;
    this._activePresetId = id;
    const select = this._getElement("preset-select");
    if (select) select.value = id;
    const nameInput = this._getElement("preset-name");
    if (nameInput) nameInput.value = preset.name;
    this._updatePresetActions();
    const enabled = this._enabledEl?.checked ?? false;
    this.saveAndBroadcast(enabled, this.getOptionsFromForm());
    this._setPresetStatus(`Loaded "${preset.name}"`, "ok");
  }

  savePreset() {
    const nameInput = this._getElement("preset-name");
    const name = normalizePresetName(nameInput?.value ?? "");
    if (!isValidPresetName(name)) {
      this._setPresetStatus("Enter a preset name", "err");
      nameInput?.focus();
      return;
    }

    if (DEFAULT_PRESETS.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      this._setPresetStatus("Name is reserved for a built-in preset", "err");
      nameInput?.focus();
      return;
    }

    const settings = this.getCurrentPayload();
    const existing = this._presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.settings = settings;
      this._activePresetId = existing.id;
    } else {
      if (this._presets.length >= MAX_PRESETS) {
        this._setPresetStatus(`Max ${MAX_PRESETS} presets`, "err");
        return;
      }
      const preset = { id: createPresetId(), name, settings };
      this._presets.push(preset);
      this._activePresetId = preset.id;
    }

    this._persistPresets(() => {
      if (chrome.runtime.lastError) {
        this._setPresetStatus("Could not save preset", "err");
        return;
      }
      this._renderPresetSelect();
      this._flushSave();
      this._setPresetStatus(`Saved "${name}"`, "ok");
    });
  }

  deletePreset() {
    const select = this._getElement("preset-select");
    const id = select?.value;
    if (!id) return;
    if (DEFAULT_PRESETS.some((p) => p.id === id)) {
      this._setPresetStatus("Built-in presets cannot be deleted", "err");
      return;
    }
    const preset = this._presets.find((p) => p.id === id);
    if (!preset) return;

    this._presets = this._presets.filter((p) => p.id !== id);
    this._activePresetId = "";
    this._persistPresets(() => {
      if (chrome.runtime.lastError) {
        this._setPresetStatus("Could not delete preset", "err");
        return;
      }
      this._renderPresetSelect();
      const nameInput = this._getElement("preset-name");
      if (nameInput) nameInput.value = "";
      this._setPresetStatus(`Deleted "${preset.name}"`, "ok");
    });
  }

  shareSettings() {
    const nameInput = this._getElement("preset-name");
    const rawName = normalizePresetName(nameInput?.value ?? "");
    const name = isValidPresetName(rawName) ? rawName : "Shared Preset";
    const settings = this.getCurrentPayload();
    const shareData = JSON.stringify([{ id: createPresetId(), name, settings }], null, 2);

    const copyFallback = () => {
      const el = document.createElement("textarea");
      el.value = shareData;
      el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(el);
    };

    const onDone = () => {
      this._setPresetStatus(`"${name}" copied — paste into Import`, "ok");
      const btn = this._getElement("share-btn");
      if (btn) {
        btn.classList.add("shared");
        setTimeout(() => btn.classList.remove("shared"), 500);
      }
    };
    const onFail = () => { copyFallback(); onDone(); };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareData).then(onDone).catch(onFail);
    } else {
      copyFallback();
      onDone();
    }
  }

  exportPresets() {
    if (!this._presets.length) {
      this._setPresetStatus("No user presets to export", "err");
      return;
    }
    const json = JSON.stringify(this._presets, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crt-overlay-presets.json";
    a.click();
    URL.revokeObjectURL(url);
    this._setPresetStatus(`Exported ${this._presets.length} preset${this._presets.length !== 1 ? "s" : ""}`, "ok");
  }

  importPresets() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          const raw = JSON.parse(/** @type {string} */ (reader.result));
          const list = sanitizePresetsList(Array.isArray(raw) ? raw : []);
          if (!list.length) {
            this._setPresetStatus("No valid presets in file", "err");
            return;
          }
          let added = 0;
          for (const p of list) {
            const nameConflict = [
              ...DEFAULT_PRESETS,
              ...this._presets,
            ].some((e) => e.name.toLowerCase() === p.name.toLowerCase());
            if (!nameConflict && this._presets.length < MAX_PRESETS) {
              this._presets.push({ ...p, id: createPresetId() });
              added++;
            }
          }
          if (!added) {
            this._setPresetStatus("All presets already exist", "err");
            return;
          }
          this._persistPresets(() => {
            if (chrome.runtime.lastError) {
              this._setPresetStatus("Could not save imported presets", "err");
              return;
            }
            this._renderPresetSelect();
            this._setPresetStatus(`Imported ${added} preset${added !== 1 ? "s" : ""}`, "ok");
          });
        } catch {
          this._setPresetStatus("Invalid JSON file", "err");
        }
      });
      reader.readAsText(file);
    });
    input.click();
  }

  loadFromStorage() {
    storage.get(STORAGE_KEYS_LIST, (data) => {
      this._applyPayloadToForm(data);
      this._updateSliders();
    });
  }

  resetToDefaults() {
    this._suppressPresetClear = true;
    this._applyPayloadToForm(DEFAULT_OPTIONS);
    this._updateSliders();
    this._suppressPresetClear = false;
    this._markCustomPreset();
    const enabled = this._enabledEl?.checked ?? false;
    this.saveAndBroadcast(enabled, this.getOptionsFromForm());
    this._setPresetStatus("Reset to defaults", "ok");
  }

  randomize() {
    for (const entry of OPTION_ENTRIES) {
      if (!entry.popupId || entry.type === "checkbox") continue;
      const el = this._getElement(entry.popupId);
      if (!el) continue;
      if (entry.type === "slider" && entry.min != null && entry.max != null) {
        const val = entry.min + Math.random() * (entry.max - entry.min);
        el.value = String(Math.round(val * 100) / 100);
      }
    }
    this._updateSliders();
    this._markCustomPreset();
    const enabled = this._enabledEl?.checked ?? false;
    this.saveAndBroadcast(enabled, this.getOptionsFromForm());
    this._setPresetStatus("Randomized settings", "ok");
  }

  bindEvents() {
    this._enabledEl?.addEventListener("change", () => {
      this._markCustomPreset();
      this.saveAndBroadcast(this._enabledEl.checked, this.getOptionsFromForm());
    });

    for (const entry of OPTION_ENTRIES) {
      if (!entry.popupId || entry.name === "ENABLED") continue;
      const el = this._getElement(entry.popupId);
      if (!el) continue;
      if (entry.type === "checkbox") {
        el.addEventListener("change", () => {
          this._markCustomPreset();
          this.saveAndBroadcast(this._enabledEl?.checked ?? false, this.getOptionsFromForm());
        });
      } else {
        el.addEventListener("input", () => {
          this._markCustomPreset();
          this._updateSliders();
          this._debouncedSaveAndBroadcast();
        });
      }
    }

    this._getElement("crt-reset-btn")?.addEventListener("click", () => this.resetToDefaults());
    this._getElement("crt-random-btn")?.addEventListener("click", () => this.randomize());

    this._getElement("share-btn")?.addEventListener("click", () => this.shareSettings());

    this._getElement("save-btn")?.addEventListener("click", () => {
      this._flushSave();
      const btn = this._getElement("save-btn");
      if (!btn) return;
      btn.classList.add("saved");
      setTimeout(() => btn.classList.remove("saved"), 500);
    });

    this._getElement("preset-export-btn")?.addEventListener("click", () => this.exportPresets());
    this._getElement("preset-import-btn")?.addEventListener("click", () => this.importPresets());
    this._getElement("preset-save-btn")?.addEventListener("click", () => this.savePreset());
    this._getElement("preset-delete-btn")?.addEventListener("click", () => this.deletePreset());
    this._getElement("preset-select")?.addEventListener("change", (e) => {
      const id = e.target.value;
      if (!id) {
        this._activePresetId = "";
        this._updatePresetActions();
        return;
      }
      this._applyPresetById(id);
    });
    this._getElement("preset-name")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.savePreset();
      }
    });
  }

  _updateSliders() {
    for (const [sliderId, fillId] of Object.entries(FILL_IDS)) {
      const range = SLIDER_RANGE[sliderId] ?? { min: 0, max: 1 };
      const el = this._getElement(sliderId);
      const fill = this._getElement(fillId);
      if (!el) continue;
      const val = parseFloat(el.value);
      const safeVal = Number.isNaN(val) ? range.min : val;
      const pct = ((safeVal - range.min) / (range.max - range.min)) * 100;
      const clamped = Math.max(0, Math.min(100, pct));
      if (fill) fill.style.width = `${clamped}%`;
      const pctEl = document.querySelector(`.slider-pct[data-for="${sliderId}"]`);
      if (pctEl) pctEl.textContent = `${Math.round(clamped)}%`;
    }
  }

  init() {
    this._cacheElements();
    this.loadFromStorage();
    this._loadPresets();
    this.bindEvents();
    this._updateSliders();
    this._updatePresetActions();
  }
}

const controller = new PopupController();
controller.init();
