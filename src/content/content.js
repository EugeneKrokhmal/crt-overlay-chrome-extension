/**
 * Content script: injects and controls the CRT overlay and VHS sound filter.
 */
import {
  STORAGE_KEYS,
  DEFAULT_OPTIONS,
  STORAGE_KEYS_LIST,
  STORAGE_KEY_TO_OPTION,
  OPTION_SLIDER_KEYS,
  MESSAGE,
  messageResponse,
} from "../shared/config.js";
import { storage } from "../shared/chrome-facade.js";
import { VHSSoundFilter } from "./soundFilter.js";

const OVERLAY_ROOT_ID = "crt-overlay-root";
const CURVE_INNER_SELECTOR = "#crt-curve-inner";

/** Curvature: map 0..1 option to border-radius percentage */
const CURVATURE_MIN_RADIUS = 8;
const CURVATURE_RANGE = 20;

class CRTOverlay {
  constructor() {
    this._root = null;
  }

  /** Returns the overlay root element, creating it if needed */
  getRoot() {
    if (this._root) return this._root;
    this._root = this._createDOM();
    document.body.appendChild(this._root);
    return this._root;
  }

  _createDOM() {
    const root = document.createElement("div");
    root.id = OVERLAY_ROOT_ID;
    root.setAttribute("tabindex", "-1");
    root.setAttribute("aria-hidden", "true");

    const curveWrap = document.createElement("div");
    curveWrap.id = "crt-curve-wrap";

    const curveInner = document.createElement("div");
    curveInner.id = "crt-curve-inner";

    const layers = ["crt-scanlines", "crt-vignette", "crt-chromatic", "crt-glitch-phase"];
    layers.forEach((id) => {
      const layer = document.createElement("div");
      layer.id = id;
      curveInner.appendChild(layer);
    });
    const noiseWrap = document.createElement("div");
    noiseWrap.id = "crt-glitch-noise-wrap";
    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.id = "crt-glitch-noise";
    noiseWrap.appendChild(noiseCanvas);
    curveInner.appendChild(noiseWrap);

    curveWrap.appendChild(curveInner);
    root.appendChild(curveWrap);
    return root;
  }

  /**
   * Apply intensity options to the overlay (CSS variables, curvature, glitches).
   */
  applyOptions(options = {}) {
    const root = this.getRoot();
    const inner = root.querySelector(CURVE_INNER_SELECTOR);
    if (!inner) return;

    inner.style.setProperty(
      "--crt-scanline",
      String(options.scanline ?? DEFAULT_OPTIONS[STORAGE_KEYS.SCANLINE])
    );
    inner.style.setProperty(
      "--crt-vignette",
      String(options.vignette ?? DEFAULT_OPTIONS[STORAGE_KEYS.VIGNETTE])
    );
    inner.style.setProperty(
      "--crt-glow",
      String(options.glow ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLOW])
    );

    const curvature = options.curvature ?? DEFAULT_OPTIONS[STORAGE_KEYS.CURVATURE];
    const radius = Math.max(0, CURVATURE_MIN_RADIUS + curvature * CURVATURE_RANGE);
    inner.style.borderRadius = `${radius}%`;

    const glitches = options.vhsGlitches ?? DEFAULT_OPTIONS[STORAGE_KEYS.VHS_GLITCHES];
    const phaseLevel = options.glitchPhaseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_PHASE_LEVEL];
    const noiseLevel = options.glitchNoiseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_NOISE_LEVEL];
    if (glitches) {
      root.setAttribute("data-glitches", "true");
      root.style.setProperty("--crt-glitch-phase", String(phaseLevel));
      root.style.setProperty("--crt-glitch-noise", String(noiseLevel));
      this._startNoiseCanvas(noiseLevel);
    } else {
      root.removeAttribute("data-glitches");
      this._stopNoiseCanvas();
    }
  }

  _noiseFrameId = null;
  _noiseCanvas = null;

  _startNoiseCanvas(level) {
    this._stopNoiseCanvas();
    const wrap = this.getRoot().querySelector("#crt-glitch-noise-wrap");
    const canvas = this.getRoot().querySelector("#crt-glitch-noise");
    if (!wrap || !canvas) return;
    this._noiseCanvas = canvas;
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    wrap.style.display = "block";
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, size, size);
    const d = imageData.data;
    const draw = () => {
      if (!this._noiseCanvas || !this.getRoot().hasAttribute("data-glitches")) return;
      const opacity = parseFloat(this.getRoot().style.getPropertyValue("--crt-glitch-noise") || "0.15");
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.floor(Math.random() * 256);
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = Math.floor(opacity * 80);
      }
      ctx.putImageData(imageData, 0, 0);
      this._noiseFrameId = requestAnimationFrame(draw);
    };
    draw();
  }

  _stopNoiseCanvas() {
    if (this._noiseFrameId != null) {
      cancelAnimationFrame(this._noiseFrameId);
      this._noiseFrameId = null;
    }
    const wrap = this.getRoot().querySelector("#crt-glitch-noise-wrap");
    if (wrap) wrap.style.display = "none";
    this._noiseCanvas = null;
  }

  setVisible(visible) {
    const root = this.getRoot();
    if (visible) {
      root.setAttribute("data-visible", "true");
      if (root.hasAttribute("data-glitches")) this._startNoiseCanvas(parseFloat(root.style.getPropertyValue("--crt-glitch-noise") || "0.15"));
    } else {
      root.removeAttribute("data-visible");
      this._stopNoiseCanvas();
    }
  }

  /** Load state from storage and apply; show overlay if enabled */
  initFromStorage(data) {
    const options = {};
    for (const key of OPTION_SLIDER_KEYS) {
      const name = STORAGE_KEY_TO_OPTION[key];
      if (name) options[name] = data[key] ?? DEFAULT_OPTIONS[key];
    }
    options.vhsGlitches = data[STORAGE_KEYS.VHS_GLITCHES] ?? DEFAULT_OPTIONS[STORAGE_KEYS.VHS_GLITCHES];
    options.glitchPhaseLevel = data[STORAGE_KEYS.GLITCH_PHASE_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_PHASE_LEVEL];
    options.glitchNoiseLevel = data[STORAGE_KEYS.GLITCH_NOISE_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_NOISE_LEVEL];
    this.getRoot();
    this.applyOptions(options);
    if (data[STORAGE_KEYS.ENABLED]) {
      this.setVisible(true);
    }
  }

  /**
   * Handle incoming message. Returns messageResponse(ok, data) or Promise<messageResponse> for async.
   * Listener must return true when handler returns a Promise so sendResponse stays valid.
   */
  handleMessage(msg) {
    if (msg.type === MESSAGE.TOGGLE) {
      this.setVisible(msg.enabled);
      return messageResponse(true);
    }
    if (msg.type === MESSAGE.SET_OPTIONS) {
      const opts = msg.options || {};
      this.applyOptions(opts);
      this.setVisible(msg.visible !== false);
      return messageResponse(true);
    }
    if (msg.type === MESSAGE.GET_STATE) {
      return new Promise((resolve) => {
        storage.get(STORAGE_KEYS.ENABLED, (data) => {
          resolve(messageResponse(true, { enabled: !!data[STORAGE_KEYS.ENABLED] }));
        });
      });
    }
    return null;
  }
}

const overlay = new CRTOverlay();
const soundFilter = new VHSSoundFilter();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const response = overlay.handleMessage(msg);
  if (msg.type === MESSAGE.SET_OPTIONS && msg.options) {
    const opts = msg.options;
    soundFilter.setEnabled(opts.soundFilter, opts.soundEffectLevel, opts.soundNoiseLevel);
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
    soundFilter.setEnabled(!!soundEnabled, effectLevel, noiseLevel);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runWhenReady);
} else {
  runWhenReady();
}
