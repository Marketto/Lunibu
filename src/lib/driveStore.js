// Stato locale della sincronizzazione Drive: localStorage 'lunibu:drive' = { fileId, lastSync }.
// Il segreto (chiave di abbinamento o frase) sta nel keystore, cifrato: mai in chiaro qui.
import * as ks from './keystore.js';
import { syncOnce } from './driveSync.js';
import { transport } from './drive.js';
import { mergeData, syncShape } from './sync.js';

const KEY = 'lunibu:drive';
export const AUTO_MS = 5 * 60000;
let cache;
const subs = new Set();

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const getDrive = () => (cache ||= read());
export function setDrive(patch) {
  cache = patch === null ? {} : { ...getDrive(), ...patch };
  for (const k of Object.keys(cache)) if (cache[k] === undefined) delete cache[k];
  try { Object.keys(cache).length ? localStorage.setItem(KEY, JSON.stringify(cache)) : localStorage.removeItem(KEY); } catch { /* storage pieno/bloccato */ }
  subs.forEach((f) => f());
}
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
/** Frase in chiaro di versioni precedenti: spostata nel keystore e cancellata da qui. */
export async function migrateLegacyPass({ store = ks.store, get = getDrive, set = setDrive } = {}) {
  const pass = get().pass;
  if (!pass) return false;
  if (!ks.hasSecret()) await store(pass);
  set({ pass: undefined, remember: undefined });
  return true;
}
/** C'è un segreto salvato (anche se ancora da sbloccare). */
export const hasPass = () => ks.hasSecret();
/** Dopo una frase digitata dall'utente: la conserva cifrata (se diversa da quella già sbloccata). */
export async function savePass(pass) { if (ks.isUnlocked() && (await ks.unlock()) === pass) return;
  await ks.store(pass); }
/** Frase sbagliata: la dimentica così non si riprova a ogni ritorno in primo piano. */
export const clearPass = () => ks.clear();
export const forget = () => { ks.clear(); setDrive(null); };

let busy = false;
/** Una sincronizzazione alla volta. `latest()` dà lo stato più recente per non perdere modifiche fatte durante la rete. */
export async function runSync({ latest, silent = false, fileId, pass, appVersion = '' }) {
  const d = getDrive();
  fileId ||= d.fileId;
  if (!fileId) throw new Error('no-pass');
  if (busy) throw new Error('busy');
  busy = true;
  try {
    const typed = Boolean(pass);
    pass ||= await ks.unlock();
    const r = await syncOnce({ transport: transport({ silent }), fileId, pass, local: latest(), appVersion });
    setDrive({ fileId, lastSync: Date.now() });
    if (typed) await savePass(pass);
    // modifiche locali fatte mentre si aspettava la rete: unione col risultato (le statistiche restano quelle di Drive)
    const m = mergeData(latest(), r.merged);
    return { merged: syncShape(m), stats: r.stats };
  } finally { busy = false; }
}
