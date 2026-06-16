/**
 * CRT overlay: DOM, resize, applyOptions, glitch canvases, message handling.
 */
import {
  STORAGE_KEYS,
  DEFAULT_OPTIONS,
  STORAGE_KEY_TO_OPTION,
  OPTION_SLIDER_KEYS,
  MESSAGE,
  messageResponse,
} from "../shared/config.js";
import { storage } from "../shared/chrome-facade.js";

const OVERLAY_ROOT_ID = "crt-overlay-root";
const CURVE_INNER_SELECTOR = "#crt-curve-inner";

export class CRTOverlay {
  constructor() {
    this._root = null;
    this._lastOptions = {};
    this._tapeCounterValue = 0;
    this._lastCounterSecond = -1;
    // JS-loop handles
    this._flickerRaf = null;
    this._flickerActive = false;
    this._signalBandsRaf = null;
    this._signalBandsActive = false;
    this._hudInterval = null;
    this._hudOpts = {};
    this._signalBands = [];
  }

  _ensureSharpenFilter() {
    if (document.getElementById("crt-sharpen-defs")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "crt-sharpen-defs";
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    svg.innerHTML = `<defs><filter id="crt-sharpen" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="0.6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" result="sharp"/>
    </filter></defs>`;
    (document.head || document.documentElement).appendChild(svg);
    this._sharpenFilter = svg.querySelector("feComposite");
  }

  _applyPageFilters(options) {
    this._ensureSharpenFilter();
    const sat = options.filterSaturation ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_SATURATION] ?? 1;
    const con = options.filterContrast ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_CONTRAST] ?? 1;
    const sharp = options.filterSharpness ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_SHARPNESS] ?? 0;
    const hue = options.filterHue ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_HUE] ?? 0;

    if (this._sharpenFilter) {
      const k2 = 1 + sharp;
      const k3 = -sharp;
      this._sharpenFilter.setAttribute("k2", String(k2));
      this._sharpenFilter.setAttribute("k3", String(k3));
    }

    const parts = [];
    if (sharp > 0.01) parts.push("url(#crt-sharpen)");
    if (Math.abs(sat - 1) > 0.01) parts.push(`saturate(${sat.toFixed(3)})`);
    if (Math.abs(con - 1) > 0.01) parts.push(`contrast(${con.toFixed(3)})`);
    if (hue > 0.5) parts.push(`hue-rotate(${Math.round(hue)}deg)`);

    document.body.style.filter = parts.length ? parts.join(" ") : "";
  }

  getRoot() {
    if (this._root) return this._root;
    this._root = this._createDOM();
    document.documentElement.appendChild(this._root);
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
    const rgbWrap = document.createElement("div");
    rgbWrap.id = "crt-vhs-rgb-overlay";
    const rgbRed = document.createElement("div");
    rgbRed.id = "crt-vhs-rgb-red";
    const rgbGreen = document.createElement("div");
    rgbGreen.id = "crt-vhs-rgb-green";
    const rgbBlue = document.createElement("div");
    rgbBlue.id = "crt-vhs-rgb-cyan";
    rgbWrap.appendChild(rgbRed);
    rgbWrap.appendChild(rgbGreen);
    rgbWrap.appendChild(rgbBlue);
    curveInner.appendChild(rgbWrap);
    const rewindLayer = document.createElement("div");
    rewindLayer.id = "crt-vhs-rewind";
    curveInner.appendChild(rewindLayer);
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

    const interlaceLayer = document.createElement("div");
    interlaceLayer.id = "crt-interlace-layer";
    curveInner.appendChild(interlaceLayer);

    const signalBandsCanvas = document.createElement("canvas");
    signalBandsCanvas.id = "crt-signal-bands";
    curveInner.appendChild(signalBandsCanvas);

    curveWrap.appendChild(curveInner);
    root.appendChild(curveWrap);

    // Flicker layer lives outside curve-wrap; not subject to any curve distortion
    const flickerLayer = document.createElement("div");
    flickerLayer.id = "crt-flicker-layer";
    root.appendChild(flickerLayer);

    return root;
  }

  _resizeOverlay() {
    if (!this._root) return;
    const el = document.documentElement;
    const w = Math.max(el.scrollWidth, el.clientWidth);
    const h = Math.max(el.scrollHeight, el.clientHeight);
    this._root.style.width = w + "px";
    this._root.style.height = h + "px";
  }

  applyOptions(options = {}) {
    this._lastOptions = options;
    this._applyPageFilters(options);
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
    inner.style.setProperty(
      "--crt-phosphor",
      String(options.phosphor ?? DEFAULT_OPTIONS[STORAGE_KEYS.PHOSPHOR])
    );

    const glitches = options.vhsGlitches ?? DEFAULT_OPTIONS[STORAGE_KEYS.VHS_GLITCHES];
    const phaseLevel = options.glitchPhaseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_PHASE_LEVEL];
    const noiseLevel = options.glitchNoiseLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_NOISE_LEVEL];
    const trackingLevel = options.glitchTrackingLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_TRACKING_LEVEL];
    const wobbleLevel = options.glitchWobbleLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_WOBBLE_LEVEL];
    const headswitchLevel = options.glitchHeadswitchLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_HEADSWITCH_LEVEL];
    const rgbLevel = options.glitchRgbLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_RGB_LEVEL];
    const dropoutLevel = options.glitchDropoutLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_DROPOUT_LEVEL];
    const rewindLevel = options.glitchRewindLevel ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_REWIND_LEVEL];

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
      root.style.setProperty("--crt-rewind", String(rewindLevel));
      const rewindEl = root.querySelector("#crt-vhs-rewind");
      if (rewindEl) rewindEl.style.display = rewindLevel > 0.01 ? "block" : "none";
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
      const rewindEl = root.querySelector("#crt-vhs-rewind");
      if (rewindEl) rewindEl.style.display = "none";
      this._stopNoiseCanvas();
      this._stopDropoutCanvas();
      this._applyRgbFilter(0);
      document.body.classList.remove("crt-body-wobble");
      document.body.style.removeProperty("--crt-wobble-px");
    }

    // New visual effects — update regardless of glitches state
    this._applyInterlace(!!options.interlace);
    const visible = root.hasAttribute("data-visible");
    const fi = options.flickerIntensity ?? 0;
    if (fi > 0 && visible) {
      this._startFlicker(fi);
    } else if (fi <= 0) {
      this._stopFlicker();
    }
    if (options.signalBands && visible) {
      this._startSignalBands();
    } else if (!options.signalBands) {
      this._stopSignalBands();
    }
    if (visible) {
      this._startHUD({ vhsTimestamp: !!options.vhsTimestamp, tapeCounter: !!options.tapeCounter });
    }
  }

  _applyRgbFilter(level) {
    const root = this.getRoot();
    const px = Math.round(level * 14);
    const opacity = Math.min(1, 0.25 + level * 0.7);
    root.style.setProperty("--crt-rgb-px", String(px));
    root.style.setProperty("--crt-rgb-opacity", String(opacity));
    const overlay = root.querySelector("#crt-vhs-rgb-overlay");
    if (overlay) overlay.style.display = level > 0.01 ? "block" : "none";
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
    const size = 320;
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
      const baseAlpha = Math.floor(opacity * 120);
      const t = this._noiseFrameCount * 0.02;
      for (let y = 0; y < size; y++) {
        const band = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(y * 0.05 + t));
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const rnd = Math.random();
          if (rnd < 0.1) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 0; continue; }
          const choice = Math.random();
          if (choice < 0.25) { d[i] = 255; d[i + 1] = 0; d[i + 2] = 0; }
          else if (choice < 0.5) { d[i] = 0; d[i + 1] = 255; d[i + 2] = 0; }
          else if (choice < 0.75) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 255; }
          else { d[i] = d[i + 1] = d[i + 2] = (Math.random() * 256) | 0; }
          d[i + 3] = Math.floor(baseAlpha * band * (0.5 + 0.5 * Math.random()));
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
      const n = 8 + Math.floor(level * 24);
      for (let k = 0; k < n; k++) {
        const y = Math.floor(Math.random() * (h - 10));
        const isThickBar = Math.random() < 0.15;
        const thick = isThickBar ? 4 + Math.floor(Math.random() * 5) : (Math.random() > 0.6 ? 2 : 1);
        const alpha = isThickBar ? 0.7 + Math.random() * 0.3 : 0.35 + Math.random() * 0.5;
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(0, y, w, thick);
      }
      this._dropoutTimeoutId = setTimeout(() => {
        this._dropoutFrameId = requestAnimationFrame(tick);
      }, 50 + Math.random() * 80);
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

  // ── Flicker ──────────────────────────────────────────────────────────────

  _startFlicker(intensity) {
    this._stopFlicker();
    if (!intensity || intensity <= 0) return;
    const layer = this._root?.querySelector("#crt-flicker-layer");
    if (!layer) return;
    this._flickerActive = true;
    const tick = () => {
      if (!this._flickerActive) return;
      const r = Math.random();
      let alpha = 0;
      if (r < 0.012 * intensity) {
        alpha = 0.25 + Math.random() * 0.25 * intensity; // occasional deep dip
      } else if (r < 0.055 * intensity) {
        alpha = 0.04 + Math.random() * 0.08 * intensity; // subtle shimmer
      }
      layer.style.opacity = String(alpha);
      this._flickerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  _stopFlicker() {
    this._flickerActive = false;
    if (this._flickerRaf != null) {
      cancelAnimationFrame(this._flickerRaf);
      this._flickerRaf = null;
    }
    const layer = this._root?.querySelector("#crt-flicker-layer");
    if (layer) layer.style.opacity = "0";
  }

  // ── Interlace ─────────────────────────────────────────────────────────────

  _applyInterlace(enabled) {
    const root = this.getRoot();
    if (enabled) root.setAttribute("data-interlace", "true");
    else root.removeAttribute("data-interlace");
  }

  // ── Signal bands ──────────────────────────────────────────────────────────

  _startSignalBands() {
    this._stopSignalBands();
    const canvas = this._root?.querySelector("#crt-signal-bands");
    if (!canvas) return;
    canvas.style.display = "block";

    this._signalBands = Array.from({ length: 4 }, () => ({
      y: Math.random(),
      speed: 0.00015 + Math.random() * 0.00025,
      h: 0.04 + Math.random() * 0.06,
      alpha: 0.07 + Math.random() * 0.10,
      bright: Math.random() > 0.4,
    }));

    this._signalBandsActive = true;
    const draw = () => {
      if (!this._signalBandsActive) return;
      const W = canvas.offsetWidth || 320;
      const H = canvas.offsetHeight || 240;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      for (const b of this._signalBands) {
        b.y -= b.speed;
        if (b.y + b.h < 0) b.y = 1 + b.h;
        const yPx = b.y * H;
        const hPx = b.h * H;
        const c = b.bright
          ? `rgba(255,255,255,${b.alpha})`
          : `rgba(0,0,0,${b.alpha * 2})`;
        const grad = ctx.createLinearGradient(0, yPx, 0, yPx + hPx);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.2, c);
        grad.addColorStop(0.8, c);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, yPx, W, hPx);
      }
      this._signalBandsRaf = requestAnimationFrame(draw);
    };
    draw();
  }

  _stopSignalBands() {
    this._signalBandsActive = false;
    if (this._signalBandsRaf != null) {
      cancelAnimationFrame(this._signalBandsRaf);
      this._signalBandsRaf = null;
    }
    const canvas = this._root?.querySelector("#crt-signal-bands");
    if (canvas) canvas.style.display = "none";
  }

  // ── VHS HUD (timestamp + tape counter) ───────────────────────────────────

  _getOrCreateHudCanvas() {
    if (!this._hudCanvasEl) {
      const canvas = document.createElement("canvas");
      canvas.id = "crt-hud-canvas";
      canvas.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483645",
        "pointer-events:none",
        "display:none",
      ].join(";");
      document.documentElement.appendChild(canvas);
      this._hudCanvasEl = canvas;
    }
    return this._hudCanvasEl;
  }

  _startHUD(opts) {
    this._stopHUD();
    this._hudOpts = opts;
    if (!opts.vhsTimestamp && !opts.tapeCounter) return;
    const canvas = this._getOrCreateHudCanvas();
    canvas.style.display = "block";
    const draw = () => this._drawHUDFrame(canvas);
    draw();
    this._hudInterval = setInterval(draw, 250);
  }

  _drawHUDFrame(canvas) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const PAD = 20;
    const FONT = "bold 20px 'Courier New', Courier, monospace";
    ctx.font = FONT;

    const now = new Date();
    const blink = Date.now() % 1000 < 500;
    const hh24 = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const hours12 = now.getHours() % 12 || 12;
    const ampm = now.getHours() < 12 ? "AM" : "PM";
    const MONTHS = ["Jan.","Feb.","Mar.","Apr.","May ","Jun.","Jul.","Aug.","Sep.","Oct.","Nov.","Dec."];

    // shared shadow
    const setShadow = (color = "rgba(0,0,0,0.85)", blur = 5) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    };

    if (this._hudOpts.vhsTimestamp) {
      ctx.textBaseline = "top";
      setShadow();

      // ── TOP-LEFT: REC + blinking dot ─────────────────────────────────────
      ctx.fillStyle = "#ffffff";
      ctx.fillText("REC", PAD, PAD);
      const recW = ctx.measureText("REC ").width;
      if (blink) {
        const cx = PAD + recW + 5;
        const cy = PAD + 10;
        setShadow("rgba(220,0,0,0.7)", 10);
        ctx.fillStyle = "#ff2222";
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        setShadow();
      }

      // ── TOP-RIGHT: HH:MM:SS ───────────────────────────────────────────────
      const timeStr = `${hh24}:${mm}:${ss}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(timeStr, W - PAD - ctx.measureText(timeStr).width, PAD);

      // ── BOTTOM-RIGHT: AM/PM HH:MM  +  Date ───────────────────────────────
      ctx.textBaseline = "bottom";
      const ampmStr = `${ampm} ${String(hours12).padStart(2, "0")}:${mm}`;
      const dateStr = `${MONTHS[now.getMonth()]} ${String(now.getDate()).padStart(2, "0")} ${now.getFullYear()}`;
      const ampmW = ctx.measureText(ampmStr).width;
      const dateW = ctx.measureText(dateStr).width;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ampmStr, W - PAD - ampmW, H - PAD - 28);
      ctx.fillText(dateStr, W - PAD - dateW, H - PAD);
    }

    // ── BOTTOM-LEFT: tape counter ─────────────────────────────────────────
    if (this._hudOpts.tapeCounter) {
      const sec = now.getSeconds();
      if (sec !== this._lastCounterSecond) {
        this._lastCounterSecond = sec;
        this._tapeCounterValue++;
      }
      setShadow();
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`C ${String(this._tapeCounterValue).padStart(5, "0")}`, PAD, H - PAD);
    }
  }

  _stopHUD() {
    if (this._hudInterval != null) {
      clearInterval(this._hudInterval);
      this._hudInterval = null;
    }
    if (this._hudCanvasEl) this._hudCanvasEl.style.display = "none";
  }

  // ── Channel static (on SPA navigation) ───────────────────────────────────

  flashChannelStatic() {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;image-rendering:pixelated;";
    document.documentElement.appendChild(canvas);
    const scale = 4;
    const W = canvas.width = Math.ceil(window.innerWidth / scale);
    const H = canvas.height = Math.ceil(window.innerHeight / scale);
    const ctx = canvas.getContext("2d");
    let raf;
    const drawNoise = () => {
      const img = ctx.createImageData(W, H);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(drawNoise);
    };
    drawNoise();
    setTimeout(() => {
      cancelAnimationFrame(raf);
      canvas.style.transition = "opacity 180ms";
      canvas.style.opacity = "0";
      setTimeout(() => canvas.remove(), 180);
    }, 280);
  }

  // ── Keyboard shortcut on-page indicator ──────────────────────────────────

  showToggleIndicator(visible) {
    const existing = document.getElementById("crt-toggle-indicator");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.id = "crt-toggle-indicator";
    el.textContent = visible ? "CRT  ON" : "CRT  OFF";
    el.style.cssText = [
      "position:fixed",
      "top:18px",
      "left:50%",
      "transform:translateX(-50%)",
      "background:rgba(0,0,0,0.78)",
      "color:" + (visible ? "#90ff70" : "#ff7070"),
      "font:bold 13px 'Courier New',monospace",
      "letter-spacing:0.12em",
      "padding:5px 14px 5px 14px",
      "border-radius:4px",
      "z-index:2147483647",
      "pointer-events:none",
      "opacity:1",
      "transition:opacity 0.45s",
    ].join(";");
    document.documentElement.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 450);
    }, 1600);
  }

  setVisible(visible) {
    const root = this.getRoot();
    const opts = this._lastOptions;
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
      const fi = opts.flickerIntensity ?? 0;
      if (fi > 0) this._startFlicker(fi);
      if (opts.signalBands) this._startSignalBands();
      this._startHUD({ vhsTimestamp: !!opts.vhsTimestamp, tapeCounter: !!opts.tapeCounter });
    } else {
      root.removeAttribute("data-visible");
      this._stopNoiseCanvas();
      this._stopDropoutCanvas();
      this._stopFlicker();
      this._stopSignalBands();
      this._stopHUD();
      document.body.classList.remove("crt-body-wobble");
      document.body.style.removeProperty("--crt-wobble-px");
    }
  }

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
    options.glitchRewindLevel = data[STORAGE_KEYS.GLITCH_REWIND_LEVEL] ?? DEFAULT_OPTIONS[STORAGE_KEYS.GLITCH_REWIND_LEVEL];
    options.filterSaturation = data[STORAGE_KEYS.FILTER_SATURATION] ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_SATURATION];
    options.filterContrast = data[STORAGE_KEYS.FILTER_CONTRAST] ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_CONTRAST];
    options.filterSharpness = data[STORAGE_KEYS.FILTER_SHARPNESS] ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_SHARPNESS];
    options.filterHue = data[STORAGE_KEYS.FILTER_HUE] ?? DEFAULT_OPTIONS[STORAGE_KEYS.FILTER_HUE];
    options.flickerIntensity = data[STORAGE_KEYS.FLICKER_INTENSITY] ?? DEFAULT_OPTIONS[STORAGE_KEYS.FLICKER_INTENSITY];
    options.interlace = data[STORAGE_KEYS.INTERLACE] ?? DEFAULT_OPTIONS[STORAGE_KEYS.INTERLACE];
    options.signalBands = data[STORAGE_KEYS.SIGNAL_BANDS] ?? DEFAULT_OPTIONS[STORAGE_KEYS.SIGNAL_BANDS];
    options.vhsTimestamp = data[STORAGE_KEYS.VHS_TIMESTAMP] ?? DEFAULT_OPTIONS[STORAGE_KEYS.VHS_TIMESTAMP];
    options.tapeCounter = data[STORAGE_KEYS.TAPE_COUNTER] ?? DEFAULT_OPTIONS[STORAGE_KEYS.TAPE_COUNTER];
    this.getRoot();
    this.applyOptions(options);
    if (data[STORAGE_KEYS.ENABLED]) {
      this.setVisible(true);
    }
  }

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
