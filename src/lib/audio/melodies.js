// Note e melodie di pubblico dominio (puro: nessuna dipendenza da Web Audio).

export const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "E4", "C#5", "Bb3" → midi
export function noteToMidi(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// ---------- Melodie di pubblico dominio ----------
// Brahms, "Wiegenlied" op. 49 n. 4 (1868)
export const BRAHMS = [
  ['E4', .5], ['E4', .5], ['G4', 2], ['E4', .5], ['E4', .5], ['G4', 2], ['E4', .5], ['G4', .5], ['C5', 1], ['B4', 1.5], ['A4', .5], ['A4', 1], ['G4', 1],
  ['D4', .5], ['E4', .5], ['F4', 1], ['D4', 1], ['D4', .5], ['E4', .5], ['F4', 2], ['D4', .5], ['F4', .5], ['B4', .5], ['A4', .5], ['G4', 1], ['B4', 1], ['C5', 2],
  ['C4', .5], ['C4', .5], ['C5', 2], ['A4', .5], ['F4', .5], ['G4', 2], ['E4', .5], ['C4', .5], ['F4', 1], ['G4', 1], ['A4', 1], ['G4', 2],
  ['C4', .5], ['C4', .5], ['C5', 2], ['A4', .5], ['F4', .5], ['G4', 2], ['E4', .5], ['C4', .5], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 3]
];
// "Ah! vous dirai-je, maman" (XVIII sec.) — la melodia di "Brilla brilla la stellina"
export const TWINKLE = [
  ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
  ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
  ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
  ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
  ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
  ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2]
];
// "Frère Jacques" / "Fra Martino" (tradizionale, XVIII sec.)
export const FRA_MARTINO = [
  ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 1],
  ['E4', 1], ['F4', 1], ['G4', 2], ['E4', 1], ['F4', 1], ['G4', 2],
  ['G4', .5], ['A4', .5], ['G4', .5], ['F4', .5], ['E4', 1], ['C4', 1], ['G4', .5], ['A4', .5], ['G4', .5], ['F4', .5], ['E4', 1], ['C4', 1],
  ['C4', 1], ['G3', 1], ['C4', 2], ['C4', 1], ['G3', 1], ['C4', 2]
];

// durata di un giro completo della melodia (come in melodyLoop): serve a rendere il loop esatto
export function melodyPeriod(melody, bpm, pause) {
  return melody.reduce((a, [, d]) => a + d, 0) * (60 / bpm) + pause;
}

export const PENTA = [60, 62, 64, 67, 69, 72, 74, 76];
