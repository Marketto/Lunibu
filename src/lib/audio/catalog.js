import * as R from './realistic.js';
import { realTrack } from './graph.js';
import { BRAHMS, TWINKLE, FRA_MARTINO, melodyPeriod } from './melodies.js';
import { startMusicBox, startCarillon, startAmbient, startBubbles, startGroove, startFraMartino, startMarimbaSong } from './generators.js';

// Catalogo delle tracce, guadagni di normalizzazione e nome dei file pre-renderizzati.

// ---------- Catalogo ----------
// Ogni traccia: id, gruppo (sleep/play), tipo, fascia d'età in mesi [from, to), e una funzione che la avvia.
export const TRACKS = [
  // --- Per dormire: rumori e suoni ---
  { id: 'womb', group: 'sleep', kind: 'noise', from: 0, to: 6, hue: '#f1b4c3', start: () => realTrack(R.womb, 1) },
  { id: 'shush', group: 'sleep', kind: 'noise', from: 0, to: 6, hue: '#cfd6f6', start: () => realTrack(R.shush, 0.8) },
  { id: 'car', group: 'sleep', kind: 'noise', from: 0, to: 144, hue: '#c6cbe0', start: () => realTrack(R.car, 1) },
  { id: 'dryer', group: 'sleep', kind: 'noise', from: 0, to: 24, hue: '#f6cfd8', start: () => realTrack(R.dryer, 0.9) },
  { id: 'brown', group: 'sleep', kind: 'noise', from: 0, to: 144, hue: '#d9b99b', start: () => realTrack(R.brown, 1) },
  { id: 'pink', group: 'sleep', kind: 'noise', from: 3, to: 144, hue: '#f6cfd8', start: () => realTrack(R.pink, 1) },
  { id: 'white', group: 'sleep', kind: 'noise', from: 0, to: 144, hue: '#e8ecf7', start: () => realTrack(R.white, 1) },
  { id: 'fan', group: 'sleep', kind: 'noise', from: 0, to: 144, hue: '#bfe0d2', start: () => realTrack(R.fan, 1) },
  { id: 'rain', group: 'sleep', kind: 'nature', from: 6, to: 144, hue: '#a9c7ee', start: () => realTrack(R.rain, 1, 0.12) },
  { id: 'waves', group: 'sleep', kind: 'nature', from: 6, to: 144, hue: '#9ed3d6', start: () => realTrack(R.waves, 1, 0.2) },
  // --- Per dormire: musica ---
  { id: 'brahms', group: 'sleep', kind: 'music', from: 0, to: 144, hue: '#b9b2ec', period: melodyPeriod(BRAHMS, 66, 3), start: () => startMusicBox(BRAHMS, 66) },
  { id: 'twinkle', group: 'sleep', kind: 'music', from: 0, to: 144, hue: '#f7d79a', period: melodyPeriod(TWINKLE, 72, 3), start: () => startMusicBox(TWINKLE, 72) },
  { id: 'carillon', group: 'sleep', kind: 'music', from: 0, to: 144, hue: '#c9e3b8', start: startCarillon },
  { id: 'moon', group: 'sleep', kind: 'music', from: 12, to: 144, hue: '#8f8ad6', start: startAmbient },
  // --- Per giocare ---
  { id: 'bubbles', group: 'play', kind: 'music', from: 0, to: 12, hue: '#a9dcf0', start: startBubbles },
  { id: 'marimba', group: 'play', kind: 'music', from: 6, to: 144, hue: '#f7c48f', period: 960 / 96, start: () => startGroove(96, false) },
  { id: 'twinkle-play', group: 'play', kind: 'music', from: 6, to: 144, hue: '#f7d79a', period: melodyPeriod(TWINKLE, 108, 1), start: () => startMarimbaSong(TWINKLE, 108) },
  { id: 'fra-martino', group: 'play', kind: 'music', from: 12, to: 144, hue: '#f1b4c3', period: melodyPeriod(FRA_MARTINO, 104, 1.2), start: startFraMartino },
  { id: 'dance', group: 'play', kind: 'music', from: 18, to: 144, hue: '#a8d0be', period: 960 / 112, start: () => startGroove(112, true) }
];

// Guadagni di normalizzazione (misurati, vedi tests/audio): tutte le tracce a volume percepito simile
export const NORM = {'womb': 1.3, 'shush': 2.31, 'car': 1.1, 'dryer': 0.55, 'brown': 0.76, 'pink': 0.67, 'white': 0.5, 'fan': 0.66, 'rain': 0.79, 'waves': 0.95, 'brahms': 0.76, 'twinkle': 0.76, 'carillon': 1.07, 'moon': 1.17, 'bubbles': 3.0, 'marimba': 1.62, 'twinkle-play': 1.62, 'fra-martino': 1.68, 'dance': 1.32}; // misurati con pesatura K (BS.1770); waves ricalibrato dopo il passaggio ai loop renderizzati (inviluppo della schiuma corretto)

export const AMBIENT = { id: '__ambient', start: () => startAmbient(0.45) };
export const AUDIO_FILE = (id) => (id === AMBIENT.id ? 'ambient' : id) + '.m4a';
