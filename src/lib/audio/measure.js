import { S } from './state.js';

// Misura spettrale dell'analizzatore (pesature K e A) per i controlli di loudness (solo con ?debug).

export function measure() {
  const ctx = S.live;
  const n = S.analyser.frequencyBinCount;
  const f = new Float32Array(n);
  S.analyser.getFloatFrequencyData(f);
  let pw = 0, cw = 0, aw = 0, kw = 0;
  // pesatura K (ITU-R BS.1770, approssimata): shelf +4 dB sopra ~1,7 kHz e passa-alto a 38 Hz
  const K = (fr) => {
    const x = (fr / 1681) ** 2;
    const shelf = (1 + x * 2.512) / (1 + x);
    const h = (fr / 38) ** 4;
    return shelf * (h / (1 + h));
  };
  const A = (fr) => {
    const f2 = fr * fr;
    const r = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
    return r * r * 1.2589; // +2 dB a 1 kHz
  };
  for (let i = 1; i < n; i++) {
    const fr = i * ctx.sampleRate / S.analyser.fftSize;
    const p = Math.pow(10, f[i] / 10);
    pw += p; cw += p * fr; aw += p * A(fr); kw += p * K(fr);
  }
  const t = new Float32Array(S.analyser.fftSize);
  S.analyser.getFloatTimeDomainData(t);
  let ss = 0, pk = 0;
  for (const v of t) { ss += v * v; pk = Math.max(pk, Math.abs(v)); }
  return { rmsDb: 10 * Math.log10(ss / t.length + 1e-12), aDb: 10 * Math.log10(aw + 1e-20), kDb: 10 * Math.log10(kw + 1e-20), peak: pk, centroid: cw / (pw || 1) };
}
