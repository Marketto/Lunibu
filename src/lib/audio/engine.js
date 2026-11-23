// Motore audio interamente generativo (Web Audio API): nessun file, nessuna rete, nessun diritto d'autore.
// Rumori, suoni della natura, ninne nanne in carillon (melodie di pubblico dominio) e musiche originali.
// Il suono è pre-renderizzato in loop AAC (npm run audio:render) e riprodotto da un <audio> persistente.
//
// Punto d'ingresso: riesporta l'API pubblica dei moduli:
//   state.js       stato condiviso (contesti, nodi master)
//   graph.js       contesto, catena master, riverbero, rumori e helper di cablaggio
//   melodies.js    note e melodie di pubblico dominio
//   instruments.js strumenti sintetici e sequencer
//   generators.js  generatori delle tracce (live e offline)
//   catalog.js     TRACKS, NORM, AUDIO_FILE
//   render.js      rendering dei loop (solo build: scripts/render-audio.mjs)
//   player.js      <audio> persistente, MediaSession, timer, livello
//   measure.js     misure di loudness (?debug)
export { getContext, getAnalyser, prepare } from './graph.js';
export { noteToMidi } from './melodies.js';
export { TRACKS, NORM, AUDIO_FILE } from './catalog.js';
export {
  subscribe, setTitleLookup, play, stop, currentId, setVolume, setSleepTimer, setAmbient, ambientOn, level
} from './player.js';
