import { S } from './state.js';
import { midi, noteToMidi } from './melodies.js';
import { noiseBuffer } from './graph.js';

// Strumenti sintetici e sequencer (live con timer, offline con tutte le note pianificate subito).

// ---------- Strumenti ----------
export function musicBox(t, freq, out, vel = 0.25) {
  const g = S.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
  [[1, 1], [2.0, 0.22], [3.01, 0.08], [5.4, 0.03]].forEach(([h, a]) => {
    const o = S.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * h;
    const og = S.ctx.createGain();
    og.gain.value = a;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + 2.5);
  });
  g.connect(out);
}

export function marimba(t, freq, out, vel = 0.3) {
  const g = S.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  [[1, 1], [3.93, 0.12], [9.2, 0.03]].forEach(([h, a]) => {
    const o = S.ctx.createOscillator();
    o.frequency.value = freq * h;
    const og = S.ctx.createGain();
    og.gain.value = a;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + 0.8);
  });
  g.connect(out);
}

export function softBass(t, freq, dur, out, vel = 0.22) {
  const o = S.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = S.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function shaker(t, out, vel = 0.05) {
  const src = S.ctx.createBufferSource();
  src.buffer = noiseBuffer('white');
  const hp = S.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = S.ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(hp).connect(g).connect(out);
  src.start(t, Math.random() * 6, 0.1);
}

export function bubble(t, out) {
  const o = S.ctx.createOscillator();
  const g = S.ctx.createGain();
  const f0 = 500 + Math.random() * 600;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.12);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

export function padVoice(t, freqs, dur, out, vel = 0.05) {
  const g = S.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
  const lp = S.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.Q.value = 0.3;
  for (const f of freqs) {
    for (const det of [-6, 5]) {
      const o = S.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 3);
    }
  }
  lp.connect(g).connect(out);
}

// ---------- Sequencer ----------
export function sequencer(stepFn, stepDur) {
  let next = S.ctx.currentTime + 0.1;
  let i = 0;
  const run = (limit) => {
    while (next < limit) {
      stepFn(i, next);
      next += typeof stepDur === 'function' ? stepDur(i) : stepDur;
      i++;
    }
  };
  if (S.OFF) { run(S.OFF.len); return () => {}; } // offline: tutte le note pianificate subito, nessun timer
  let alive = true;
  const tick = () => {
    if (!alive) return;
    run(S.ctx.currentTime + 0.4);
    timer = setTimeout(tick, 80);
  };
  let timer = setTimeout(tick, 0);
  return () => { alive = false; clearTimeout(timer); };
}

// melodia: array di [nota|null, durata in battiti]
export function melodyLoop(melody, bpm, play, { pause = 2 } = {}) {
  const beat = 60 / bpm;
  const total = melody.length;
  return sequencer(
    (i, t) => {
      const [n, d] = melody[i % total];
      if (n) play(t, midi(noteToMidi(n)), d * beat);
    },
    (i) => {
      const d = melody[i % total][1] * beat;
      return (i % total === total - 1) ? d + pause : d;
    }
  );
}
