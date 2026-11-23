import * as R from './realistic.js';
import { S } from './state.js';

// Grafo Web Audio: contesto, catena master, riverbero, rumori di base e piccoli helper di cablaggio.

export function getContext() {
  if (!S.live) {
    const AC = window.AudioContext || window.webkitAudioContext;
    // 'playback': buffer grandi, meno rischio di buffer underrun (i crepitii) a scapito di qualche ms di latenza
    try { S.ctx = new AC({ latencyHint: 'playback' }); } catch { S.ctx = new AC(); }
    S.live = S.ctx;
    // iOS 16.4+: l'audio continua con schermo spento e ignora il tasto silenzioso
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* */ }
    S.master = S.ctx.createGain();
    S.master.gain.value = 0.35;
    S.analyser = S.ctx.createAnalyser();
    S.analyser.fftSize = 2048;
    // Addolcimento comune: meno acuti (sopra ~3,5 kHz) e niente picchi improvvisi
    const ch = makeChain(S.ctx);
    S.tracksIn = ch.input;
    ch.output.connect(S.master);
    S.master.connect(S.analyser).connect(S.ctx.destination);
    S.reverb = makeReverb(3.2);
    S.reverb.connect(S.tracksIn);
    R.initRealistic(S.ctx); // rumore continuo non ripetitivo (AudioWorklet), pronto in pochi ms
  }
  if (S.live.state === 'suspended') S.live.resume();
  return S.live;
}

// catena master: high-shelf -6 dB > 3,5 kHz, passa-basso 9 kHz, limitatore (identica live e nel rendering offline)
export function makeChain(c) {
  const input = c.createGain();
  const shelf = c.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = 3500;
  shelf.gain.value = -6;
  const top = c.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 9000;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -20;
  limiter.knee.value = 10;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.01;
  limiter.release.value = 0.3;
  input.connect(shelf).connect(top).connect(limiter);
  return { input, output: limiter };
}

export function getAnalyser() { return S.analyser; }

// da chiamare all'apertura della sezione Suoni: prepara il motore prima del primo tocco
export function prepare() { if (typeof window !== 'undefined' && /[?&]debug/.test(window.location.search)) getContext(); }

export function realTrack(fn, level = 1, wet = 0) {
  const out = bus(level, wet);
  const kit = R.makeKit(S.ctx, (type) => noiseSource(type), S.OFF);
  fn(S.ctx, kit, out, noiseBuffer('white'));
  return { out, stop: () => kit.stopAll() };
}

export function makeReverb(seconds) {
  const len = Math.floor(S.ctx.sampleRate * seconds);
  const ir = S.ctx.createBuffer(2, len, S.ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const conv = S.ctx.createConvolver();
  conv.buffer = ir;
  const wet = S.ctx.createGain();
  wet.gain.value = 0.55;
  conv.connect(wet);
  const input = S.ctx.createGain();
  input.connect(conv);
  return { connect: (n) => wet.connect(n), input };
}

const noiseCache = {};

export function noiseBuffer(type) {
  if (noiseCache[type]) return noiseCache[type];
  const len = S.ctx.sampleRate * 8;
  const buf = S.ctx.createBuffer(2, len, S.ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w * 0.5;
      else if (type === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    }
    // dissolvenza agli estremi per un loop senza click
    const f = 2000;
    for (let i = 0; i < f; i++) {
      const g = i / f;
      d[i] *= g; d[len - 1 - i] *= g;
    }
  }
  noiseCache[type] = buf;
  return buf;
}

export function noiseSource(type) {
  const src = S.ctx.createBufferSource();
  src.buffer = noiseBuffer(type);
  src.loop = true;
  src.loopStart = 0.05;
  src.loopEnd = 7.95;
  src.start(0, Math.random() * 7);
  return src;
}

export function lfo(freq, depth, target, offset = 0) {
  const o = S.ctx.createOscillator();
  o.frequency.value = freq;
  const g = S.ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(target);
  if (offset) target.value = offset;
  o.start();
  return o;
}

export function bus(level = 1, wet = 0) {
  const out = S.ctx.createGain();
  out.gain.value = level;
  out.connect(S.tracksIn);
  if (wet) {
    const send = S.ctx.createGain();
    send.gain.value = wet;
    out.connect(send).connect(S.reverb.input);
  }
  return out;
}

// Due filtri in cascata (24 dB/ottava) per un rumore morbido, senza sibilo acuto
export function softLowpass(cutoff) {
  const a = S.ctx.createBiquadFilter();
  a.type = 'lowpass'; a.frequency.value = cutoff; a.Q.value = 0.5;
  const b = S.ctx.createBiquadFilter();
  b.type = 'lowpass'; b.frequency.value = cutoff; b.Q.value = 0.5;
  a.connect(b);
  return { input: a, output: b };
}
