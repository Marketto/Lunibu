import * as R from './realistic.js';
import { makeLoop, encodeWav, envelope } from './loop.js';
import { S } from './state.js';
import { getContext, makeChain, makeReverb } from './graph.js';
import { NORM } from './catalog.js';

// ---------- Rendering dei loop (SOLO in fase di build: scripts/render-audio.mjs) ----------
// Il suono NON è più sintetizzato sul telefono: ogni traccia è renderizzata una volta (npm run audio:render) con la
// stessa sintesi e la stessa catena master in un OfflineAudioContext di Chromium, codificata in AAC (public/audio/*.m4a)
// e riprodotta da un <audio> persistente: nessun timer, nessuna sintesi né rendering mentre suona (schermo spento ok).
// Stessa frequenza di campionamento del contesto live: i generatori di rumore (bianco/rosa/bruno) dipendono
// dal sample rate, con un altro rate cambierebbero timbro e volume rispetto alle tracce normalizzate.
const TAIL = 6;         // secondi di coda per la giunzione del loop (riverbero + code delle note)
const RANDOM_LOOP = 60; // durata dei loop non periodici (rumori, natura, note casuali)
function loopSpec(track) {
  if (track.period) {
    // durata = numero intero di giri della melodia (>= 30 s): il loop È la ripetizione della melodia
    return { D: track.period * Math.ceil(30 / track.period), X: TAIL, periodic: true };
  }
  return { D: RANDOM_LOOP, X: TAIL, periodic: false };
}

function buildGraph(track, off, spec, worklet) {
  const prev = { ctx: S.ctx, tracksIn: S.tracksIn, reverb: S.reverb, OFF: S.OFF };
  try {
    S.ctx = off;
    S.OFF = { len: spec.D + spec.X, D: spec.D, worklet };
    S.tracksIn = makeChain(off);
    S.tracksIn.output.connect(off.destination);
    S.tracksIn = S.tracksIn.input;
    S.reverb = makeReverb(3.2);
    S.reverb.connect(S.tracksIn);
    const h = track.start();
    h.out.gain.value *= NORM[track.id] ?? 1; // normalizzazione incorporata: il file ha già il livello finale
  } finally {
    ({ ctx: S.ctx, tracksIn: S.tracksIn, reverb: S.reverb, OFF: S.OFF } = prev);
  }
}

// Usata dallo script di build (tramite window.__ppAudio.renderLoop, con ?debug)
export async function renderLoop(track) {
  getContext();
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const SR = S.live.sampleRate;
  const spec = loopSpec(track);
  const len = Math.round(spec.D * SR);
  const xf = Math.round(spec.X * SR);
  const off = new OAC(2, len + xf, SR);
  const worklet = await R.prepareWorklet(off);
  buildGraph(track, off, spec, worklet);
  const rb = await off.startRendering();
  const chans = makeLoop([rb.getChannelData(0), rb.getChannelData(1)], len, xf, spec.periodic);
  return { chans, sr: SR, dur: spec.D, periodic: spec.periodic };
}

// per scripts/render-audio.mjs: loop senza giunzione (WAV 16 bit in base64) + inviluppo RMS a 20 Hz (uint8)
export async function renderLoopEncoded(track) {
  const r = await renderLoop(track);
  const wav = new Uint8Array(encodeWav(r.chans, r.sr));
  let s = '';
  for (let i = 0; i < wav.length; i += 0x8000) s += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
  const env = envelope(r.chans, r.sr, 0.05);
  const e8 = Uint8Array.from(env, (v) => Math.max(0, Math.min(255, Math.round((v / 0.5) * 255))));
  let es = '';
  for (const v of e8) es += String.fromCharCode(v);
  return { wav: btoa(s), env: btoa(es), sr: r.sr, dur: r.dur, periodic: r.periodic };
}
