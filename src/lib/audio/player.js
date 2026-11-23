import { S } from './state.js';
import { getContext } from './graph.js';
import { TRACKS, NORM, AMBIENT, AUDIO_FILE } from './catalog.js';
import { renderLoopEncoded } from './render.js';
import { measure } from './measure.js';

// Riproduzione tramite <audio> persistente + MediaSession, timer di spegnimento, dissolvenze e livello per le animazioni.

// ---------- Player ----------
// Regola: suona UNA sola cosa alla volta. Un solo <audio> persistente, riusato per tutte le tracce.
// Su tocco (dentro il gesto) src + play() sono sincroni. Il motore live resta solo come ripiego se il file non si carica.
const DEBUG = typeof window !== 'undefined' && /[?&]debug/.test(window.location.search);
const FADE_END_MS = 20000; // dissolvenza finale del timer
const FADE_IN_MS = 1500;
const active = new Set();  // handle live (solo ripiego) in riproduzione o in dissolvenza
let current = null;        // { id, ambient, handle, live }
let token = 0;
let userVol = 0.35;
let el = null, elGain = null, directVol = null;
let elFactor = 1;          // fattore di dissolvenza dell'elemento audio (0–1)
let fadeAnim = null;       // { from, to, t0, dur, then }
let curEnv = null;         // inviluppo del loop corrente (per le animazioni)
let envData = null;
let swapping = false, expectPause = false;
let tickTimer = null;
let timerEnd = 0, timerFadeStart = 0, timerCb = null, timerTimeout = null;
const listeners = new Set();
let titleOf = null;
let lastPlay = null;

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const notify = (playing) => listeners.forEach((fn) => fn({ playing }));
export function setTitleLookup(fn) { titleOf = fn; }

function fadeIn(node, to, sec = 1.5) {
  const g = node.gain;
  const now = S.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(0.0001, now);
  g.exponentialRampToValueAtTime(Math.max(to, 0.001), now + sec);
}

function kill(handle, sec = 0.8) {
  if (!handle || handle._dead) return;
  handle._dead = true;
  const g = handle.out.gain;
  const now = S.live.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.exponentialRampToValueAtTime(0.0001, now + sec);
  try { handle.stop(); } catch { /* già fermo */ }
  setTimeout(() => {
    try { handle.out.disconnect(); } catch { /* già scollegato */ }
    active.delete(handle);
  }, sec * 1000 + 80);
}

function killLive(sec) { for (const h of active) kill(h, sec); }

// iOS ignora HTMLMediaElement.volume: lì il volume passa dal grafo Web Audio (anche in ?debug, per l'analizzatore)
function probeDirect() {
  if (directVol == null) {
    const t = new Audio();
    t.volume = 0.5;
    directVol = t.volume === 0.5 && !(DEBUG && !/[?&]direct/.test(window.location.search));
  }
  return directVol;
}

function ensureEl() {
  if (el) return el;
  el = new Audio();
  el.loop = true;
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  if (!probeDirect()) {
    const c = getContext();
    elGain = c.createGain();
    c.createMediaElementSource(el).connect(elGain);
    elGain.connect(S.master);
    S.master.gain.value = userVol;
  }
  el.addEventListener('timeupdate', stepEl); // scandito dall'orologio audio, non dai timer
  el.addEventListener('playing', () => { swapping = false; });
  el.addEventListener('pause', () => {
    if (expectPause || swapping || !current || current.live) return;
    stop(); // pausa dal sistema (cuffie, chiamata, centro di controllo)
    notify(null);
  });
  el.addEventListener('error', () => { if (current && !current.live) fallbackLive(); });
  return el;
}

function applyEl() {
  if (!el) return;
  if (directVol) el.volume = Math.max(0, Math.min(1, userVol * elFactor));
  else if (elGain) elGain.gain.value = elFactor;
}

function fadeEl(to, sec, then) {
  fadeAnim = { from: elFactor, to, t0: Date.now(), dur: Math.max(1, sec * 1000), then };
  ensureTicker();
  stepEl();
}

function pauseEl() {
  if (!el || el.paused) return;
  expectPause = true;
  el.pause();
  setTimeout(() => { expectPause = false; }, 50);
}

// Passo di dissolvenza/timer calcolato sull'ora reale: se il browser ritarda i timer a schermo spento,
// al passo successivo (anche 'timeupdate' dell'audio) il volume salta semplicemente al valore giusto.
function stepEl() {
  const now = Date.now();
  if (fadeAnim) {
    const k = Math.min(1, (now - fadeAnim.t0) / fadeAnim.dur);
    elFactor = fadeAnim.from + (fadeAnim.to - fadeAnim.from) * k;
    if (k >= 1) { const f = fadeAnim.then; fadeAnim = null; f?.(); }
  }
  if (timerEnd) {
    if (now >= timerEnd) { finishTimer(); return; }
    if (now > timerFadeStart) elFactor = Math.min(elFactor, ((timerEnd - now) / FADE_END_MS) ** 2);
  }
  applyEl();
  if (!fadeAnim && !timerEnd && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

function ensureTicker() { if (!tickTimer) tickTimer = setInterval(stepEl, 250); }

function finishTimer() {
  const cb = timerCb;
  timerEnd = 0; timerCb = null; clearTimeout(timerTimeout);
  stop();
  cb?.();
  notify(null);
}

// Ripiego: il file non si carica (cache corrotta, formato non supportato): si usa il motore live
function fallbackLive() {
  const c = current;
  if (!c || c.live) return;
  const track = c.ambient ? AMBIENT : TRACKS.find((t) => t.id === c.id);
  if (!track) return;
  c.live = true;
  swapping = true;
  try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* */ }
  getContext();
  S.master.gain.value = userVol;
  const handle = track.start();
  fadeIn(handle.out, handle.out.gain.value * (NORM[track.id] ?? 1), 1.5);
  active.add(handle);
  c.handle = handle;
}

async function loadEnv(id, my) {
  try {
    if (!envData) {
      const r = await fetch(new URL('audio/env.json', document.baseURI));
      envData = await r.json();
    }
    const b = envData[AUDIO_FILE(id).replace('.m4a', '')];
    if (b && my === token) {
      const bin = atob(b);
      curEnv = Float32Array.from(bin, (ch) => (ch.charCodeAt(0) / 255) * 0.5);
    }
  } catch { /* le animazioni ripiegano sull'analizzatore */ }
}

function setSession(track) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  const ms = navigator.mediaSession;
  const base = import.meta.env?.BASE_URL || '/';
  ms.metadata = new MediaMetadata({
    title: (track.id !== AMBIENT.id && titleOf?.(track.id)) || 'Lunibù',
    artist: 'Lunibù',
    artwork: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }
    ]
  });
  ms.playbackState = 'playing';
  const set = (a, f) => { try { ms.setActionHandler(a, f); } catch { /* azione non supportata */ } };
  set('play', () => { if (lastPlay && !current) { play(lastPlay.id, lastPlay.opts); notify(lastPlay.opts.ambient ? null : lastPlay.id); } });
  set('pause', () => { stop(); notify(null); });
  set('stop', () => { stop(); notify(null); });
  for (const a of ['seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack']) set(a, null);
}

// Dentro il gesto dell'utente: tutto sincrono (src + play), nessun await prima di play()
export function play(id, opts = {}) {
  const track = opts.ambient ? AMBIENT : TRACKS.find((t) => t.id === id);
  if (!track) return;
  const my = ++token;
  clearTimeout(timerTimeout); timerEnd = 0; timerCb = null;
  killLive(0.3);
  ensureEl();
  if (!directVol) getContext(); // iOS/debug: riprende il contesto Web Audio nel gesto
  lastPlay = { id: track.id, opts: { ambient: !!opts.ambient } };
  current = { id: track.id, ambient: !!opts.ambient, handle: null, live: false };
  curEnv = null;
  swapping = true;
  elFactor = 0.02; applyEl();
  el.src = new URL('audio/' + AUDIO_FILE(track.id), document.baseURI).href;
  el.loop = true;
  fadeAnim = { from: 0.02, to: 1, t0: Date.now(), dur: opts.ambient ? 3000 : FADE_IN_MS, then: null };
  ensureTicker();
  const p = el.play();
  p?.catch((e) => {
    if (my !== token) return;
    if (e?.name === 'AbortError') return; // un altro play() ha sostituito la sorgente
    if (e?.name === 'NotAllowedError') { stop(); notify(null); return; }
    fallbackLive();
  });
  setSession(track);
  loadEnv(track.id, my);
}

export function stop() {
  token++;
  clearTimeout(timerTimeout); timerEnd = 0; timerCb = null;
  killLive(0.8);
  current = null;
  if (el && !el.paused) {
    const my = token;
    fadeEl(0, 0.8, () => { if (my === token) pauseEl(); });
  }
  try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'; } catch { /* */ }
}

export function currentId() { return current && !current.ambient ? current.id : null; }

export function setVolume(v) {
  userVol = v;
  if (S.master) S.master.gain.setTargetAtTime(v, S.live.currentTime, 0.1);
  applyEl();
}

// Timer di spegnimento: tutto calcolato sull'ora reale, con la dissolvenza in coda (20 s).
// Un timeout in ritardo a schermo spento è innocuo: lo scatto successivo (timeupdate) porta il volume al valore giusto.
export function setSleepTimer(minutes, onEnd) {
  clearTimeout(timerTimeout);
  timerEnd = 0; timerCb = null;
  if (!minutes) return;
  timerFadeStart = Date.now() + minutes * 60000;
  timerEnd = timerFadeStart + FADE_END_MS;
  timerCb = onEnd;
  timerTimeout = setTimeout(() => { stepEl(); if (timerEnd) finishTimer(); }, timerEnd - Date.now() + 100);
  ensureTicker();
}

// Musica di sottofondo dell'app: parte solo se non c'è un'altra traccia
export function setAmbient(on) {
  if (on && !current) play(AMBIENT.id, { ambient: true });
  else if (!on && current?.ambient) stop();
}

export function ambientOn() { return !!current?.ambient; }

// livello (0–1) per le animazioni che seguono il suono
const buf = new Uint8Array(1024);
export function level() {
  if (el && !el.paused && curEnv && !swapping) {
    const i = Math.floor(el.currentTime / 0.05);
    return Math.min(1, (curEnv[i % curEnv.length] || 0) * userVol * elFactor * 4);
  }
  if (!S.analyser) return 0;
  S.analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}

// Misure per i test automatici (solo con ?debug nell'indirizzo)
if (typeof window !== 'undefined' && /[?&]debug/.test(window.location.search)) {
  window.__ppAudio = {
    play, stop,
    state: () => ({ paused: el ? el.paused : null, vol: el ? el.volume : null, factor: elFactor, pos: el ? el.currentTime : null, direct: directVol, current: current && current.id, live: active.size, src: el ? el.src : null, mediaTitle: navigator.mediaSession?.metadata?.title }),
    setSleepTimer, setVolume,
    element: () => el,
    tracks: () => TRACKS.map((t) => t.id).concat('__ambient'),
    renderLoop(id) {
      const track = id === AMBIENT.id ? AMBIENT : TRACKS.find((t) => t.id === id);
      return renderLoopEncoded(track);
    },
    measure
  };
}
