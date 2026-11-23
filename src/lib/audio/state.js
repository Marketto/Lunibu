// Stato condiviso dei moduli audio (contesto live/offline, nodi master): un unico oggetto mutabile.
export const S = {
  ctx: null,       // contesto "corrente" per la sintesi: quello live, oppure (durante il rendering) quello offline
  live: null,      // contesto live (anteprima rapida, microfono, grafo iOS)
  OFF: null,       // { len, D, worklet } mentre si costruisce un grafo offline
  master: null,
  analyser: null,
  reverb: null,
  tracksIn: null
};
