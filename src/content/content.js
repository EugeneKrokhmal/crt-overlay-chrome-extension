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

class CRTOverlay {
  constructor() {
    this._root = null;
  }

  /** Returns the overlay root element, creating it if needed */
  getRoot() {
    if (this._root) return this._root;
    this._injectRgbFilterSvg();
    this._root = this._createDOM();
    document.body.appendChild(this._root);
    this._resizeOverlay();
    this._resizeObserver = new ResizeObserver(() => this._resizeOverlay());
    this._resizeObserver.observe(document.documentElement);
    this._resizeScrollListener = () => {
      if (this._resizeScrollTimer) clearTimeout(this._resizeScrollTimer);
      this._resizeScrollTimer = setTimeout(() => {
        this._resizeScrollTimer = null;
        this._resizeOverlay();
      }, 100);
    };
    window.addEventListener("scroll", this._resizeScrollListener, { passive: true });
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

    const layers = ["crt-scanlines", "crt-vignette", "crt-glow", "crt-chromatic", "crt-glitch-phase", "crt-tracking-lines", "crt-headswitch"];
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

    const dropoutWrap = document.createElement("div");
    dropoutWrap.id = "crt-glitch-dropout-wrap";
    const dropoutCanvas = document.createElement("canvas");
    dropoutCanvas.id = "crt-glitch-dropout";
    dropoutWrap.appendChild(dropoutCanvas);
    curveInner.appendChild(dropoutWrap);

    curveWrap.appendChild(curveInner);
    root.appendChild(curveWrap);
    return root;
  }

  /** Inject SVG filter into body (must be outside filtered element so url(#id) resolves). */
  _injectRgbFilterSvg() {
    if (document.getElementById("crt-vhs-rgb")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;visibility:hidden";
    svg.innerHTML = `
      <defs>
        <filter id="crt-vhs-rgb" x="-5%" y="-5%" width="110%" height="110%">
          <feColorMatrix in="SourceGraphic" type="matrix" result="r_src"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
          <feOffset id="crt-vhs-rgb-r-offset" in="r_src" dx="-2" result="r"/>
          <feColorMatrix in="SourceGraphic" type="matrix" result="g"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
          <feColorMatrix in="SourceGraphic" type="matrix" result="b_src"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
          <feOffset id="crt-vhs-rgb-b-offset" in="b_src" dx="2" result="b"/>
          <feBlend in="r" in2="g" mode="lighten" result="rg"/>
          <feBlend in="rg" in2="b" mode="lighten" result="rgbSplit"/>
          <feColorMatrix in="rgbSplit" type="matrix" result="rgbSplitAlpha"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0"/>
          <feBlend in="SourceGraphic" in2="rgbSplitAlpha" mode="normal" result="out"/>
        </filter>
      </defs>
    `;
    document.body.insertBefore(svg, document.body.firstChild);
  }

  _resizeOverlay() {
    if (!this._root) return;
    const el = document.documentElement;
    const w = Math.max(el.scrollWidth, el.clientWidth);
    const h = Math.max(el.scrollHeight, el.clientHeight);
    this._root.style.width = w + "px";
    this._root.style.height = h + "px";
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

    const glitches = options.vhsGlitches ?? DEFAULT_OPTIONS[STORAGE_KEYS.VHS_GLITCHES];
    const phaseLevel = options.glitchPhaseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_PHASE_LEVEL];
    const noiseLevel = options.glitchNoiseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_NOISE_LEVEL];
    const trackingLevel = options.glitchTrackingLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_TRACKING_LEVEL];
    const wobbleLevel = options.glitchWobbleLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL];
    const headswitchLevel = options.glitchHeadswitchLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL];
    const rgbLevel = options.glitchRgbLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_RGB_LEVEL];
    const dropoutLevel = options.glitchDropoutLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL];

    if (glitches) {
      root.setAttribute("data-glitches", "true");
      root.style.setProperty("--crt-glitch-phase", String(phaseLevel));
      root.style.setProperty("--crt-glitch-noise", String(noiseLevel));
      root.style.setProperty("--crt-tracking-lines", String(trackingLevel));
      root.style.setProperty(
        "--crt-wobble-px",
        wobbleLevel > 0.01 ? String(0.5 + wobbleLevel * 2.5) : "0"
      );
      root.style.setProperty("--crt-headswitch", String(headswitchLevel));
      root.style.setProperty("--crt-glitch-dropout", String(dropoutLevel));
      this._startNoiseCanvas(noiseLevel);
      this._applyRgbFilter(rgbLevel);
      this._startDropoutCanvas(dropoutLevel);
      if (wobbleLevel > 0.01 && root.hasAttribute("data-visible")) {
        document.body.classList.add("crt-body-wobble");
        document.body.style.setProperty("--crt-wobble-px", String(0.5 + wobbleLevel * 2.5));
      } else {
        document.body.classList.remove("crt-body-wobble");
        document.body.style.removeProperty("--crt-wobble-px");
      }
    } else {
      root.removeAttribute("data-glitches");
      this._stopNoiseCanvas();
      this._stopDropoutCanvas();
      this._applyRgbFilter(0);
      document.body.classList.remove("crt-body-wobble");
      document.body.style.removeProperty("--crt-wobble-px");
    }
  }

  _applyRgbFilter(level) {
    const px = Math.round(level * 5);
    const rOff = document.getElementById("crt-vhs-rgb-r-offset");
    const bOff = document.getElementById("crt-vhs-rgb-b-offset");
    if (rOff) rOff.setAttribute("dx", String(-px));
    if (bOff) bOff.setAttribute("dx", String(px));
    const target = document.documentElement;
    if (level > 0.01) {
      target.style.filter = "url(#crt-vhs-rgb)";
    } else {
      target.style.filter = "";
    }
  }

  _noiseFrameId = null;
  _noiseCanvas = null;
  _noiseFrameCount = 0;

  _startNoiseCanvas(level) {
    this._stopNoiseCanvas();
    const wrap = this.getRoot().querySelector("#crt-glitch-noise-wrap");
    const canvas = this.getRoot().querySelector("#crt-glitch-noise");
    if (!wrap || !canvas) return;
    this._noiseCanvas = canvas;
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    wrap.style.display = "block";
    const ctx = canvas.getContext("2d", { willReadFrequently: false, alpha: true });
    const imageData = ctx.createImageData(size, size);
    const d = imageData.data;
    this._noiseFrameCount = 0;
    const draw = () => {
      if (!this._noiseCanvas || !this.getRoot().hasAttribute("data-glitches")) return;
      this._noiseFrameCount++;
      if (this._noiseFrameCount % 2 !== 0) {
        this._noiseFrameId = requestAnimationFrame(draw);
        return;
      }
      const opacity = parseFloat(this.getRoot().style.getPropertyValue("--crt-glitch-noise") || "0.15");
      const baseAlpha = Math.floor(opacity * 80);
      const t = this._noiseFrameCount * 0.02;
      for (let y = 0; y < size; y++) {
        const band = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(y * 0.06 + t));
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const v = (Math.random() * 256) | 0;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = Math.random() > 0.12
            ? Math.floor(baseAlpha * band * (0.6 + 0.4 * Math.random()))
            : 0;
        }
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

  _dropoutFrameId = null;
  _dropoutTimeoutId = null;
  _dropoutCanvas = null;

  _startDropoutCanvas(level) {
    this._stopDropoutCanvas();
    if (level < 0.02) return;
    const wrap = this.getRoot().querySelector("#crt-glitch-dropout-wrap");
    const canvas = this.getRoot().querySelector("#crt-glitch-dropout");
    if (!wrap || !canvas) return;
    this._dropoutCanvas = canvas;
    const w = 256;
    const h = 256;
    canvas.width = w;
    canvas.height = h;
    wrap.style.display = "block";
    wrap.style.opacity = String(level);
    const ctx = canvas.getContext("2d", { willReadFrequently: false, alpha: true });
    const tick = () => {
      if (!this._dropoutCanvas || !this.getRoot().hasAttribute("data-glitches")) return;
      ctx.clearRect(0, 0, w, h);
      const n = 4 + Math.floor(level * 12);
      for (let k = 0; k < n; k++) {
        const y = Math.floor(Math.random() * h);
        const thick = Math.random() > 0.7 ? 2 : 1;
        ctx.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.5})`;
        ctx.fillRect(0, y, w, thick);
      }
      this._dropoutTimeoutId = setTimeout(() => {
        this._dropoutFrameId = requestAnimationFrame(tick);
      }, 80 + Math.random() * 120);
    };
    tick();
  }

  _stopDropoutCanvas() {
    if (this._dropoutFrameId != null) {
      cancelAnimationFrame(this._dropoutFrameId);
      this._dropoutFrameId = null;
    }
    if (this._dropoutTimeoutId != null) {
      clearTimeout(this._dropoutTimeoutId);
      this._dropoutTimeoutId = null;
    }
    const wrap = this.getRoot().querySelector("#crt-glitch-dropout-wrap");
    if (wrap) {
      wrap.style.display = "none";
      wrap.style.opacity = "";
    }
    this._dropoutCanvas = null;
  }

  setVisible(visible) {
    const root = this.getRoot();
    if (visible) {
      root.setAttribute("data-visible", "true");
      if (root.hasAttribute("data-glitches")) {
        this._startNoiseCanvas(parseFloat(root.style.getPropertyValue("--crt-glitch-noise") || "0.15"));
        const wobblePx = root.style.getPropertyValue("--crt-wobble-px");
        if (wobblePx && parseFloat(wobblePx) > 0) {
          document.body.classList.add("crt-body-wobble");
          document.body.style.setProperty("--crt-wobble-px", wobblePx);
        }
      }
    } else {
      root.removeAttribute("data-visible");
      this._stopNoiseCanvas();
      this._stopDropoutCanvas();
      document.body.classList.remove("crt-body-wobble");
      document.body.style.removeProperty("--crt-wobble-px");
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
    options.glitchTrackingLevel = data[STORAGE_KEYS.GLITCH_TRACKING_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_TRACKING_LEVEL];
    options.glitchWobbleLevel = data[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL];
    options.glitchHeadswitchLevel = data[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL];
    options.glitchRgbLevel = data[STORAGE_KEYS.GLITCH_RGB_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_RGB_LEVEL];
    options.glitchDropoutLevel = data[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL];
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
