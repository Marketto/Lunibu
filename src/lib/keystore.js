// Custodia del segreto di sincronizzazione (chiave di abbinamento o frase): mai in chiaro su disco.
//  - 'prf'    : cifrato con una chiave derivata da una passkey WebAuthn (estensione PRF), sbloccata dalla biometria.
//  - 'device' : ripiego, cifrato con una chiave AES-GCM non estraibile conservata in IndexedDB.
// In localStorage 'lunibu:keystore' c'è solo il testo cifrato. Il segreto sbloccato vive solo in memoria.
import { b64url, unb64url } from './sync.js';

const LS = 'lunibu:keystore';
const DB = 'lunibu';
const STORE = 'keys';
const DEV_ID = 'device';
const INFO = 'lunibu keystore v1';
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const subtle = () => globalThis.crypto.subtle;
const enc = (s) => new TextEncoder().encode(s);

/* ---------- chiave di abbinamento (pura, testabile) ---------- */
export const PAIR_PREFIX = 'lk1.';
export const newPairKey = () => PAIR_PREFIX + b64url(rand(32));
export const isPairKey = (s) => /^lk1\.[A-Za-z0-9_-]{43}$/.test(String(s || ''));
/** Legge `#pair=<chiave>` dall'hash; null se assente o malformato. */
export const pairFromHash = (hash) => { const m = /^#\/?pair=(lk1\.[A-Za-z0-9_-]{43})$/.exec(hash || ''); return m ? m[1] : null; };
export const pairLink = (base, key) => `${base}#pair=${key}`;

/* ---------- cifratura con una chiave AES (pura) ---------- */
export async function seal(key, secret) {
  const iv = rand(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc(secret)));
  return { iv: b64url(iv), ct: b64url(ct) };
}
export async function open(key, { iv, ct }) {
  try { return new TextDecoder().decode(await subtle().decrypt({ name: 'AES-GCM', iv: unb64url(iv) }, key, unb64url(ct))); } catch { throw new Error('locked'); }
}
/** Risultato PRF (32 byte) -> chiave AES-GCM via HKDF-SHA256. */
export async function keyFromPrf(bytes) {
  const base = await subtle().importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: enc(INFO) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/* ---------- ripiego 'device': chiave non estraibile in IndexedDB ---------- */
const idbDeviceStore = {
  open: () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }),
  async get() {
    const db = await this.open();
    return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(DEV_ID); q.onsuccess = () => { db.close(); res(q.result || null); }; q.onerror = () => { db.close(); rej(q.error); }; });
  },
  async put(k) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(k, DEV_ID); t.oncomplete = () => { db.close(); res(); }; t.onerror = () => { db.close(); rej(t.error); }; });
  }
};
let dev = idbDeviceStore;
/** Solo per i test: sostituisce IndexedDB con un archivio in memoria { get, put }. */
export const _setDeviceStore = (s) => { dev = s || idbDeviceStore; };

export async function deviceSeal(secret) {
  const key = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await dev.put(key);
  return { kind: 'device', ...(await seal(key, secret)) };
}
export async function deviceOpen(entry) {
  const key = await dev.get();
  if (!key) throw new Error('lost');
  return open(key, entry);
}

/** Elimina il database IndexedDB (Cancella tutti i dati). */
export const deleteDb = () => new Promise((res) => {
  try { const r = indexedDB.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch { res(); }
});

/* ---------- passkey WebAuthn + PRF (solo browser) ---------- */
export const prfAvailable = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials?.create;

async function prfCreate(salt) {
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { id: location.hostname, name: 'Lunibù' },
    user: { id: rand(16), name: 'Lunibù', displayName: 'Lunibù' },
    challenge: rand(32),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
    extensions: { prf: { eval: { first: salt } } }
  } });
  const prf = cred?.getClientExtensionResults?.().prf;
  if (!prf?.enabled) throw new Error('no-prf');
  return { id: new Uint8Array(cred.rawId), first: prf.results?.first ? new Uint8Array(prf.results.first) : null };
}
async function prfGet(credId, salt) {
  const a = await navigator.credentials.get({ publicKey: {
    challenge: rand(32), rpId: location.hostname, userVerification: 'required',
    allowCredentials: [{ type: 'public-key', id: credId }],
    extensions: { prf: { eval: { first: salt } } }
  } });
  const first = a?.getClientExtensionResults?.().prf?.results?.first;
  if (!first) throw new Error('no-prf');
  return new Uint8Array(first);
}

/** Voce 'prf' per un nuovo segreto, riusando credenziale e salt della voce precedente (pura). */
export async function sealPrfEntry(prev, first, secret) {
  return { kind: 'prf', credId: prev.credId, salt: prev.salt, ...(await seal(await keyFromPrf(first), secret)) };
}

/* ---------- stato e API ---------- */
let mem = null;
let ver = 0;
let inflight = null;
let autoUsed = false;
const subs = new Set();
const bump = () => { ver++; subs.forEach((f) => f()); };
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const snapshot = () => ver;

const readEntry = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch { return null; } };
const writeEntry = (e) => { try { localStorage.setItem(LS, JSON.stringify(e)); } catch { throw new Error('storage'); } };

export const hasSecret = () => Boolean(readEntry());
export const isUnlocked = () => mem !== null;
/** 'prf' | 'device' | null */
export const kind = () => readEntry()?.kind || null;
/** Concede una sola richiesta di sblocco automatica per apertura dell'app. */
export const takeAutoUnlock = () => { if (autoUsed) return false; autoUsed = true; return true; };

/** Segreto in chiaro (solo memoria). Errori: 'locked' (annullato/fallito), 'no-pass' (niente salvato o perso). */
export function unlock() {
  if (mem !== null) return Promise.resolve(mem);
  const e = readEntry();
  if (!e) return Promise.reject(new Error('no-pass'));
  inflight ||= (async () => {
    try {
      if (e.kind === 'prf') {
        let first;
        try { first = await prfGet(unb64url(e.credId), unb64url(e.salt)); } catch { throw new Error('locked'); }
        mem = await open(await keyFromPrf(first), e);
      } else {
        try { mem = await deviceOpen(e); } catch (x) {
          if (x.message === 'lost') { clear(); throw new Error('no-pass'); }
          throw x;
        }
      }
      bump();
      return mem;
    } finally { inflight = null; }
  })();
  return inflight;
}

/** Conserva il segreto cifrato: prima passkey PRF, altrimenti ripiego 'device'. Da chiamare da un tocco dell'utente. */
export async function store(secret) {
  let entry = null;
  const prev = readEntry();
  if (prev?.kind === 'prf' && prfAvailable()) {
    // riusa la passkey esistente (un solo sblocco) invece di accumularne di nuove
    try { entry = await sealPrfEntry(prev, await prfGet(unb64url(prev.credId), unb64url(prev.salt)), secret); } catch { entry = null; }
  }
  if (!entry && prfAvailable()) {
    try {
      const salt = rand(32);
      let { id, first } = await prfCreate(salt);
      first ||= await prfGet(id, salt);
      entry = { kind: 'prf', credId: b64url(id), salt: b64url(salt), ...(await seal(await keyFromPrf(first), secret)) };
    } catch { entry = null; }
  }
  entry ||= await deviceSeal(secret);
  writeEntry(entry);
  mem = secret;
  bump();
}

export function clear() {
  mem = null; inflight = null;
  try { localStorage.removeItem(LS); } catch { /* ignora */ }
  bump();
}
