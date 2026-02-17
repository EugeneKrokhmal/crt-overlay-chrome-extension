/**
 * Retro film / VHS-style sound filter: less high frequencies + lo-fi hiss.
 * Processes <audio> and <video> via Web Audio API (one MediaElementSource per element).
 */
import { logExtensionWarning } from "../shared/logger.js";

const DATA_ATTR_HOOKED = "data-crt-sound-hooked";

/** Lowpass: roll off highs for retro film (Hz). Lower = more muffled / intense. */
const LOWPASS_FREQ = 2000;
const LOWPASS_Q = 0.5;

/** Max lo-fi hiss (0–1). Kept low so min slider is subtle. */
const NOISE_GAIN_MAX = 0.06;
/** Max processed (effect) mix. 1 = full effect path at 100% slider. */
const EFFECT_GAIN_MAX = 1;

/** Create tape-style noise: lowpassed so it's more hiss/rumble than bright white noise */
function createTapeNoiseBuffer(ctx, durationSeconds = 3) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  // Simple pink-ish: weight lower freqs by smoothing random values
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = (Math.random() * 2 - 1) * 0.5;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    data[i] = b0 + b1 + b2;
  }
  return buffer;
}

export class VHSSoundFilter {
  constructor() {
    this._ctx = null;
    this._enabled = false;
    this._effectLevel = 0.8;
    this._noiseLevel = 0.6;
    this._nodesByElement = new WeakMap();
    this._observer = null;
    this._observerThrottleTimer = null;
    this._resumeOnInteraction = null;
  }

  _getContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  }

  _ensureContextRunning() {
    const ctx = this._ctx;
    if (!ctx) return Promise.resolve();
    if (ctx.state === "running") return Promise.resolve();
    const p = ctx.resume();
    if (p && typeof p.then === "function") {
      return p.catch((err) => logExtensionWarning("VHS sound: AudioContext resume failed", err));
    }
    return Promise.resolve();
  }

  _addResumeOnInteraction() {
    if (this._resumeOnInteraction) return;
    const once = () => {
      this._ensureContextRunning();
      document.removeEventListener("click", once);
      document.removeEventListener("touchstart", once);
      document.removeEventListener("keydown", once);
      this._resumeOnInteraction = null;
    };
    this._resumeOnInteraction = once;
    document.addEventListener("click", once, { passive: true });
    document.addEventListener("touchstart", once, { passive: true });
    document.addEventListener("keydown", once, { passive: true });
  }

  _createChain(ctx, source) {
    const dryGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = LOWPASS_FREQ;
    lowpass.Q.value = LOWPASS_Q;

    const effectGain = ctx.createGain();
    const noiseBuffer = createTapeNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = this._noiseLevel * NOISE_GAIN_MAX;

    source.connect(dryGain);
    dryGain.connect(ctx.destination);
    source.connect(lowpass);
    lowpass.connect(effectGain);
    effectGain.connect(ctx.destination);
    noiseSource.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    try {
      noiseSource.start(0);
    } catch (err) {
      logExtensionWarning("VHS sound: noise source start failed", err);
    }

    return { dryGain, effectGain, noiseGain };
  }

  _hookElement(el) {
    if (el.hasAttribute(DATA_ATTR_HOOKED)) return;
    try {
      const ctx = this._getContext();
      const source = ctx.createMediaElementSource(el);
      const chain = this._createChain(ctx, source);
      this._nodesByElement.set(el, { source, ...chain });
      el.setAttribute(DATA_ATTR_HOOKED, "1");
      this._setChainEnabled(chain, this._enabled);
    } catch (err) {
      logExtensionWarning("VHS sound: hook element failed (e.g. CORS)", err);
    }
  }

  _setChainEnabled(chain, enabled) {
    if (!chain) return;
    const t = enabled ? Math.pow(this._effectLevel, 0.85) : 0;
    const effect = t * EFFECT_GAIN_MAX;
    const dry = enabled ? Math.max(0, 1 - t) : 1;
    chain.dryGain.gain.value = dry;
    chain.effectGain.gain.value = effect;
    const noiseT = enabled ? Math.pow(this._noiseLevel, 1.6) : 0;
    chain.noiseGain.gain.value = noiseT * NOISE_GAIN_MAX;
  }

  /** Update effect/noise levels (0–1) and apply to all hooked chains */
  setLevels(effectLevel, noiseLevel) {
    this._effectLevel = Math.max(0, Math.min(1, Number(effectLevel) || 0));
    this._noiseLevel = Math.max(0, Math.min(1, Number(noiseLevel) || 0));
    document.querySelectorAll("audio, video").forEach((el) => {
      const chain = this._nodesByElement.get(el);
      if (chain) this._setChainEnabled(chain, this._enabled);
    });
  }

  _scanAndHook() {
    const list = document.querySelectorAll("audio, video");
    list.forEach((el) => this._hookElement(el));
  }

  setEnabled(enabled, effectLevel, noiseLevel) {
    if (enabled !== undefined) this._enabled = !!enabled;
    if (effectLevel !== undefined) this._effectLevel = Math.max(0, Math.min(1, Number(effectLevel) || 0));
    if (noiseLevel !== undefined) this._noiseLevel = Math.max(0, Math.min(1, Number(noiseLevel) || 0));
    if (this._enabled) {
      this._ensureContextRunning().then(() => {
        this._scanAndHook();
        this._observe();
      });
      this._addResumeOnInteraction();
    } else {
      this._disconnectObserver();
    }
    this.syncChains();
  }

  _observe() {
    if (this._observer) return;
    const root = document.body || document.documentElement;
    if (!root) return;
    const THROTTLE_MS = 250;
    this._observer = new MutationObserver(() => {
      if (!this._enabled) return;
      if (this._observerThrottleTimer != null) return;
      this._observerThrottleTimer = setTimeout(() => {
        this._observerThrottleTimer = null;
        this._scanAndHook();
      }, THROTTLE_MS);
    });
    this._observer.observe(root, { childList: true, subtree: true });
  }

  _disconnectObserver() {
    if (this._observerThrottleTimer != null) {
      clearTimeout(this._observerThrottleTimer);
      this._observerThrottleTimer = null;
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  syncChains() {
    document.querySelectorAll("audio, video").forEach((el) => {
      const chain = this._nodesByElement.get(el);
      if (chain) this._setChainEnabled(chain, this._enabled);
    });
  }
}
