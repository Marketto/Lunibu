import { S } from './state.js';
import { bus, noiseSource, softLowpass, lfo } from './graph.js';
import { midi, PENTA, BRAHMS, FRA_MARTINO } from './melodies.js';
import { musicBox, marimba, softBass, shaker, bubble, padVoice, sequencer, melodyLoop } from './instruments.js';

// Generatori live (ripiego se il file pre-renderizzato non si carica; usati anche per il rendering offline).

export function startNoise(type, cutoff) {
  const out = bus(0.9);
  const src = noiseSource(type);
  const hp = S.ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 30; // niente rimbombi inudibili
  const lp = softLowpass(cutoff);
  src.connect(hp).connect(lp.input);
  lp.output.connect(out);
  return { out, stop: () => src.stop() };
}

// Viaggio in auto: rombo basso della strada, motore lontano e qualche piccolo sobbalzo
export function startCar() {
  const out = bus(1);
  const road = noiseSource('brown');
  const rlp = softLowpass(220);
  const rg = S.ctx.createGain(); rg.gain.value = 1;
  road.connect(rlp.input); rlp.output.connect(rg).connect(out);
  const tyres = noiseSource('pink');
  const tlp = softLowpass(700);
  const tg = S.ctx.createGain(); tg.gain.value = 0.18;
  const l1 = lfo(0.05, 0.06, tg.gain, 0.18);
  tyres.connect(tlp.input); tlp.output.connect(tg).connect(out);
  const eng = S.ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 42;
  const vib = lfo(0.13, 2.5, eng.frequency, 42);
  const elp = S.ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 110;
  const eg = S.ctx.createGain(); eg.gain.value = 0.05;
  eng.connect(elp).connect(eg).connect(out); eng.start();
  const stopSeq = sequencer((i, t) => {
    if (Math.random() < 0.5) return;
    const o = S.ctx.createOscillator(); o.frequency.value = 38;
    const g = S.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
  }, () => 5 + Math.random() * 8);
  return { out, stop: () => { road.stop(); tyres.stop(); eng.stop(); l1.stop(); vib.stop(); stopSeq(); } };
}

// Asciugacapelli: soffio d'aria nelle frequenze medie e ronzio del motorino, senza fischio acuto
export function startDryer() {
  const out = bus(0.9);
  const air = noiseSource('pink');
  const bp = S.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
  const alp = softLowpass(2400);
  const ag = S.ctx.createGain(); ag.gain.value = 1.2;
  air.connect(bp).connect(alp.input); alp.output.connect(ag).connect(out);
  const body = noiseSource('brown');
  const blp = softLowpass(400);
  const bg = S.ctx.createGain(); bg.gain.value = 0.5;
  body.connect(blp.input); blp.output.connect(bg).connect(out);
  const motor = S.ctx.createOscillator(); motor.type = 'triangle'; motor.frequency.value = 118;
  const m2 = S.ctx.createOscillator(); m2.type = 'sine'; m2.frequency.value = 236;
  const mg = S.ctx.createGain(); mg.gain.value = 0.03;
  motor.connect(mg); m2.connect(mg); mg.connect(out);
  motor.start(); m2.start();
  return { out, stop: () => { air.stop(); body.stop(); motor.stop(); m2.stop(); } };
}

export function startFan() {
  const out = bus(1);
  const a = noiseSource('brown');
  const b = noiseSource('pink');
  const lp = S.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  const bg = S.ctx.createGain();
  bg.gain.value = 0.35;
  a.connect(lp);
  b.connect(bg).connect(lp);
  const am = S.ctx.createGain();
  am.gain.value = 0.9;
  const l = lfo(0.9, 0.05, am.gain, 0.9);
  lp.connect(am).connect(out);
  return { out, stop: () => { a.stop(); b.stop(); l.stop(); } };
}

export function startShush() {
  const out = bus(0.8);
  const src = noiseSource('white');
  const bp = S.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 0.7;
  const am = S.ctx.createGain();
  am.gain.value = 0.5;
  const l = lfo(0.45, 0.45, am.gain, 0.5);
  src.connect(bp).connect(am).connect(out);
  return { out, stop: () => { src.stop(); l.stop(); } };
}

export function startWomb() {
  const out = bus(1);
  const src = noiseSource('brown');
  const lp = S.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 320;
  const ng = S.ctx.createGain();
  ng.gain.value = 0.9;
  src.connect(lp).connect(ng).connect(out);
  // battito: "lub-dub" a ~68 bpm
  const stopSeq = sequencer((i, t) => {
    [0, 0.28].forEach((off, k) => {
      const o = S.ctx.createOscillator();
      o.frequency.setValueAtTime(k ? 58 : 52, t + off);
      o.frequency.exponentialRampToValueAtTime(32, t + off + 0.15);
      const g = S.ctx.createGain();
      g.gain.setValueAtTime(0, t + off);
      g.gain.linearRampToValueAtTime(k ? 0.35 : 0.5, t + off + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.22);
      o.connect(g).connect(out);
      o.start(t + off);
      o.stop(t + off + 0.25);
    });
  }, 60 / 68);
  return { out, stop: () => { src.stop(); stopSeq(); } };
}

export function startRain() {
  const out = bus(0.9, 0.15);
  const src = noiseSource('pink');
  const hp = S.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400;
  const lp = softLowpass(3000);
  const g = S.ctx.createGain();
  g.gain.value = 0.7;
  src.connect(hp).connect(lp.input);
  lp.output.connect(g).connect(out);
  // gocce
  const stopSeq = sequencer((i, t) => {
    const n = Math.random() < 0.6 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const tt = t + Math.random() * 0.12;
      const o = S.ctx.createOscillator();
      const f = 1200 + Math.random() * 1600;
      o.frequency.setValueAtTime(f, tt);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, tt + 0.03);
      const dg = S.ctx.createGain();
      dg.gain.setValueAtTime(0.025 + Math.random() * 0.03, tt);
      dg.gain.exponentialRampToValueAtTime(0.0005, tt + 0.04);
      o.connect(dg).connect(out);
      o.start(tt);
      o.stop(tt + 0.05);
    }
  }, () => 0.04 + Math.random() * 0.12);
  return { out, stop: () => { src.stop(); stopSeq(); } };
}

export function startWaves() {
  const out = bus(1, 0.2);
  const src = noiseSource('brown');
  const src2 = noiseSource('pink');
  const lp = S.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  const l1 = lfo(0.08, 500, lp.frequency, 800);
  const g = S.ctx.createGain();
  g.gain.value = 0.5;
  const l2 = lfo(0.08, 0.42, g.gain, 0.5);
  const sg = S.ctx.createGain();
  sg.gain.value = 0.25;
  src.connect(lp);
  src2.connect(sg).connect(lp);
  lp.connect(g).connect(out);
  return { out, stop: () => { src.stop(); src2.stop(); l1.stop(); l2.stop(); } };
}

export function startMusicBox(melody, bpm) {
  const out = bus(0.9, 0.6);
  const stop = melodyLoop(melody, bpm, (t, f) => musicBox(t, f * 2, out, 0.2), { pause: 3 });
  return { out, stop };
}

export function startCarillon() {
  const out = bus(0.9, 0.7);
  let pos = 2;
  const stop = sequencer((i, t) => {
    if (Math.random() < 0.18) return; // respiri
    pos = Math.max(0, Math.min(PENTA.length - 1, pos + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    musicBox(t, midi(PENTA[pos] + 12), out, 0.16);
    if (i % 8 === 0) musicBox(t, midi(PENTA[0] - 12 + 12), out, 0.08);
  }, () => 0.55 + Math.random() * 0.5);
  return { out, stop };
}

const CHORDS = [
  [48, 52, 55, 59, 62], // Cmaj9
  [45, 48, 52, 55, 59], // Am9
  [41, 45, 48, 52, 55], // Fmaj9
  [43, 50, 52, 57]      // G6/9 sus
];

export function startAmbient(level = 1) {
  const out = bus(0.9 * level, 0.8);
  const stop = sequencer((i, t) => {
    padVoice(t, CHORDS[i % CHORDS.length].map(midi), 7, out, 0.035);
    // qualche campanella pentatonica
    for (let k = 0; k < 3; k++) {
      if (Math.random() < 0.55) musicBox(t + 1 + Math.random() * 6, midi(PENTA[Math.floor(Math.random() * PENTA.length)] + 12), out, 0.05);
    }
  }, 8);
  return { out, stop };
}

export function startBubbles() {
  const out = bus(0.8, 0.4);
  const stop = sequencer((i, t) => {
    if (Math.random() < 0.7) bubble(t, out);
    if (i % 6 === 0) musicBox(t, midi(PENTA[Math.floor(Math.random() * 5)] + 12), out, 0.1);
  }, () => 0.22 + Math.random() * 0.4);
  return { out, stop };
}

const GROOVE_BASS = [36, 33, 29, 31];
const GROOVE_MEL = [
  [0, 4, 7, 4, 9, 7, 4, null], [9, 7, 4, 0, 4, 7, null, 4],
  [5, 9, 12, 9, 7, 5, 4, null], [7, 4, 2, 4, 7, null, 11, 12]
];

export function startGroove(bpm, withShaker) {
  const out = bus(0.85, 0.25);
  const eighth = 60 / bpm / 2;
  const stop = sequencer((i, t) => {
    const bar = Math.floor(i / 8) % 4;
    const step = i % 8;
    if (step === 0 || step === 4) softBass(t, midi(GROOVE_BASS[bar]), eighth * 3.5, out);
    const n = GROOVE_MEL[bar][step];
    if (n != null) marimba(t, midi(60 + n + (Math.floor(i / 32) % 2 ? 0 : 0)), out, 0.22);
    if (withShaker && step % 2 === 1) shaker(t, out, 0.04);
  }, eighth);
  return { out, stop };
}

export function startFraMartino() {
  const out = bus(0.85, 0.3);
  const stop = melodyLoop(FRA_MARTINO, 104, (t, f, d) => {
    marimba(t, f * 2, out, 0.26);
    softBass(t, f / 2, Math.min(d, 0.9), out, 0.08);
  }, { pause: 1.2 });
  return { out, stop };
}

export function startMarimbaSong(melody, bpm) {
  const out = bus(0.85, 0.3);
  const stop = melodyLoop(melody, bpm, (t, f) => marimba(t, f * 2, out, 0.26), { pause: 1 });
  return { out, stop };
}
