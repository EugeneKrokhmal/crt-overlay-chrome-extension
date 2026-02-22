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

/** Chorus: base delay (s), modulation depth (s), LFO rate (Hz). */
const CHORUS_BASE_MS = 20;
const CHORUS_DEPTH_MS = 8;
const CHORUS_RATE_HZ = 1.2;

/** Soft-clip curve for overdrive (0 = linear, higher = more saturation). */
function makeOverdriveCurve(amount) {
  if (amount <= 0) return null;
  const k = 2 * amount;
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

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
    this._overdriveLevel = 0;
    this._chorusLevel = 0;
    this._chorusDelays = new Set();
    this._chorusRafId = null;
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

    const waveshaper = ctx.createWaveShaper();
    const curve = makeOverdriveCurve(this._overdriveLevel);
    waveshaper.curve = curve;
    waveshaper.oversample = "2x";

    const effectGain = ctx.createGain();

    const chorusDelay = ctx.createDelay(0.06);
    chorusDelay.delayTime.value = CHORUS_BASE_MS / 1000;
    const chorusGain = ctx.createGain();
    chorusGain.gain.value = 0;
    source.connect(chorusDelay);
    chorusDelay.connect(chorusGain);
    chorusGain.connect(effectGain);
    this._chorusDelays.add(chorusDelay);

const noiseBuffer = createTapeNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = this._noiseLevel * NOISE_GAIN_MAX;

    source.connect(dryGain);
    dryGain.connect(ctx.destination);
    source.connect(lowpass);
    lowpass.connect(waveshaper);
    waveshaper.connect(effectGain);
    effectGain.connect(ctx.destination);
    noiseSource.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    try {
      noiseSource.start(0);
    } catch (err) {
      logExtensionWarning("VHS sound: noise source start failed", err);
    }

    return { dryGain, effectGain, noiseGain, waveshaper, chorusGain };
  }

  _chorusLfoTick() {
    const ctx = this._ctx;
    if (!ctx || this._chorusDelays.size === 0 || this._chorusLevel <= 0) return;
    const t = ctx.currentTime;
    const delaySec = CHORUS_BASE_MS / 1000 + (CHORUS_DEPTH_MS / 1000) * Math.sin(2 * Math.PI * CHORUS_RATE_HZ * t);
    this._chorusDelays.forEach((d) => {
      d.delayTime.setTargetAtTime(delaySec, t, 0.01);
    });
    this._chorusRafId = requestAnimationFrame(() => this._chorusLfoTick());
  }

  _startChorusLfo() {
    if (this._chorusRafId != null || this._chorusLevel <= 0) return;
    this._chorusRafId = requestAnimationFrame(() => this._chorusLfoTick());
  }

  _stopChorusLfo() {
    if (this._chorusRafId != null) {
      cancelAnimationFrame(this._chorusRafId);
      this._chorusRafId = null;
    }
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
    if (chain.waveshaper) {
      const curve = makeOverdriveCurve(enabled ? this._overdriveLevel : 0);
      chain.waveshaper.curve = curve;
    }
    const chorusT = enabled ? Math.pow(this._chorusLevel, 0.9) * 0.4 : 0;
    if (chain.chorusGain) chain.chorusGain.gain.value = chorusT;
    if (enabled && this._chorusLevel > 0) this._startChorusLfo();
    else if (this._chorusLevel <= 0) this._stopChorusLfo();
  }

  /** Update effect/noise/overdrive/chorus levels (0–1) and apply to all hooked chains */
  setLevels(effectLevel, noiseLevel, overdriveLevel, chorusLevel) {
    this._effectLevel = Math.max(0, Math.min(1, Number(effectLevel) || 0));
    this._noiseLevel = Math.max(0, Math.min(1, Number(noiseLevel) || 0));
    this._overdriveLevel = Math.max(0, Math.min(1, Number(overdriveLevel) ?? 0));
    this._chorusLevel = Math.max(0, Math.min(1, Number(chorusLevel) ?? 0));
    if (this._chorusLevel <= 0) this._stopChorusLfo();
    document.querySelectorAll("audio, video").forEach((el) => {
      const chain = this._nodesByElement.get(el);
      if (chain) this._setChainEnabled(chain, this._enabled);
    });
  }

  _scanAndHook() {
    const list = document.querySelectorAll("audio, video");
    list.forEach((el) => this._hookElement(el));
  }

  setEnabled(enabled, effectLevel, noiseLevel, overdriveLevel, chorusLevel) {
    if (enabled !== undefined) this._enabled = !!enabled;
    if (effectLevel !== undefined) this._effectLevel = Math.max(0, Math.min(1, Number(effectLevel) || 0));
    if (noiseLevel !== undefined) this._noiseLevel = Math.max(0, Math.min(1, Number(noiseLevel) || 0));
    if (overdriveLevel !== undefined) this._overdriveLevel = Math.max(0, Math.min(1, Number(overdriveLevel) ?? 0));
    if (chorusLevel !== undefined) this._chorusLevel = Math.max(0, Math.min(1, Number(chorusLevel) ?? 0));
    if (!this._enabled || this._chorusLevel <= 0) this._stopChorusLfo();
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
