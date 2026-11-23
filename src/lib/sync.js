// Condivisione con l'altro genitore: file cifrato o QR. Tutto locale: nessuna rete, nessun server.
// Le funzioni di trasporto (exportEncrypted / importEncrypted / encodeQr / decodeQr) sono indipendenti
// dal mezzo: un futuro trasporto (es. Google Drive) può riusarle così come sono.

export const MIN_PASS = 8;
/** Collezioni sincronizzate (elenchi di record con id): un'unica definizione per tutta l'app. */
export const COLLECTIONS = ['kids', 'growth', 'meds', 'medPlans', 'milestones', 'temps'];
/** Stato -> solo i dati sincronizzati (elenchi vuoti se assenti) + lapidi. */
export const syncShape = (st = {}) => ({ ...Object.fromEntries(COLLECTIONS.map((k) => [k, st[k] || []])), deleted: st.deleted || {} });
const ITER = 310000;
const H48 = 48 * 3600000;
const H24 = 24 * 3600000;
export const QR_MAX_CHARS = 2300;

/* ---------- base64 ---------- */
export function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

/* ---------- cifratura ---------- */
const subtle = () => globalThis.crypto.subtle;
async function deriveKey(pass, salt) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptBytes(plain, pass) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt), plain));
  return { salt, iv, ct };
}
async function decryptBytes(salt, iv, ct, pass) {
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt), ct));
  } catch {
    throw new Error('bad-pass');
  }
}

/* ---------- payload completo ---------- */
export function buildPayload(state, appVersion = '') {
  return {
    format: 'lunibu-sync', v: 1, exportedAt: new Date().toISOString(), appVersion,
    ...syncShape(state)
  };
}

/** Cifra lo stato -> Blob (file .lunibu). */
export async function exportEncrypted(state, pass, appVersion = '') {
  const { salt, iv, ct } = await encryptBytes(new TextEncoder().encode(JSON.stringify(buildPayload(state, appVersion))), pass);
  const env = { format: 'lunibu-sync-enc', v: 1, salt: b64(salt), iv: b64(iv), data: b64(ct) };
  return new Blob([JSON.stringify(env)], { type: 'application/octet-stream' });
}

/** File/Blob o testo -> dati decifrati. Errori: 'bad-file', 'bad-pass'. */
export async function importEncrypted(fileOrText, pass) {
  let env;
  try {
    const text = typeof fileOrText === 'string' ? fileOrText : await fileOrText.text();
    env = JSON.parse(text);
  } catch { throw new Error('bad-file'); }
  if (env?.format !== 'lunibu-sync-enc' || env.v !== 1 || !env.salt || !env.iv || !env.data) throw new Error('bad-file');
  let salt, iv, ct;
  try { salt = unb64(env.salt); iv = unb64(env.iv); ct = unb64(env.data); } catch { throw new Error('bad-file'); }
  const plain = await decryptBytes(salt, iv, ct, pass);
  return parsePayload(plain);
}

function parsePayload(plain) {
  let data;
  try { data = JSON.parse(new TextDecoder().decode(plain)); } catch { throw new Error('bad-file'); }
  if (data?.format !== 'lunibu-sync' || data.v !== 1) throw new Error('bad-file');
  return data;
}

/* ---------- QR rapido ---------- */
async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
export function canCompress() {
  try { new CompressionStream('deflate-raw'); new DecompressionStream('deflate-raw'); return true; } catch { return false; }
}

/** Aggiornamenti recenti: record creati/modificati nelle ultime 48 h + ultima misura per bimbo. */
export function buildQuickPayload(state, { now = Date.now(), medsOnly = false, appVersion = '' } = {}) {
  const since = new Date(now - H48).toISOString();
  const recent = (r) => (r.updatedAt || '') >= since;
  const meds = (state.meds || []).filter(recent);
  let growth = [];
  if (!medsOnly) {
    const latest = new Map();
    for (const g of state.growth || []) if (!latest.has(g.kidId) || g.date > latest.get(g.kidId).date) latest.set(g.kidId, g);
    const ids = new Set((state.growth || []).filter(recent).map((g) => g.id));
    for (const g of latest.values()) ids.add(g.id);
    growth = (state.growth || []).filter((g) => ids.has(g.id));
  }
  const kidIds0 = new Set([...growth, ...meds].map((r) => r.kidId));
  // gli schemi dei bimbi coinvolti viaggiano sempre (sono pochi e piccoli); quelli modificati di recente anche da soli se non è "solo medicine"
  const medPlans = (state.medPlans || []).filter((p) => kidIds0.has(p.kidId) || recent(p));
  // anche le tappe segnate di recente (pochi record piccoli)
  const milestones = (state.milestones || []).filter((x) => recent(x) && !medsOnly);
  // anche le temperature registrate di recente (dati sanitari del minore: viaggiano cifrate come il resto)
  const temps = (state.temps || []).filter((x) => recent(x) && !medsOnly);
  const kidIds = new Set([...kidIds0, ...medPlans.map((p) => p.kidId), ...milestones.map((x) => x.kidId), ...temps.map((x) => x.kidId)]);
  const kids = (state.kids || []).filter((k) => kidIds.has(k.id)).map(({ id, birth, name, sex }) => ({ id, birth, name, ...(sex ? { sex } : {}) }));
  const deleted = Object.fromEntries(Object.entries(state.deleted || {}).filter(([, t]) => t >= since));
  return { format: 'lunibu-sync', v: 1, quick: true, exportedAt: new Date(now).toISOString(), appVersion, kids, growth, meds, medPlans, milestones, temps, deleted };
}

/** payload -> stringa base64url per il frammento dell'URL. [flag compressione][salt 16][iv 12][cifrato] */
export async function encodeQr(payload, pass) {
  let plain = new TextEncoder().encode(JSON.stringify(payload));
  let z = 0;
  if (canCompress()) {
    try { plain = await pipe(plain, new CompressionStream('deflate-raw')); z = 1; } catch { /* nessuna compressione */ }
  }
  const { salt, iv, ct } = await encryptBytes(plain, pass);
  const out = new Uint8Array(1 + 16 + 12 + ct.length);
  out[0] = z; out.set(salt, 1); out.set(iv, 17); out.set(ct, 29);
  const data = b64url(out);
  return { data, length: data.length, tooLarge: data.length > QR_MAX_CHARS };
}

export async function decodeQr(data, pass) {
  let bytes;
  try { bytes = unb64url(String(data)); } catch { throw new Error('bad-file'); }
  if (bytes.length < 30) throw new Error('bad-file');
  let plain = await decryptBytes(bytes.slice(1, 17), bytes.slice(17, 29), bytes.slice(29), pass);
  if (bytes[0] === 1) {
    if (!canCompress()) throw new Error('bad-file');
    try { plain = await pipe(plain, new DecompressionStream('deflate-raw')); } catch { throw new Error('bad-file'); }
  }
  return parsePayload(plain);
}

/** Legge `#sync=<data>` dall'hash; null se assente. */
export const syncFromHash = (hash) => { const m = /^#\/?sync=([A-Za-z0-9_-]+)$/.exec(hash || ''); return m ? m[1] : null; };

/* ---------- unione ---------- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Eliminazione di bimbi con "lapide + cascata": per ogni bimbo tolto da `state.kids` registra una lapide
 * (id -> ISO) e rimuove i suoi record dalle altre collezioni, con una lapide per ciascun record
 * (l'altro telefono li cancella anche se non conosce la lapide del bimbo). Restituisce una patch dello stato.
 */
export function removeKidsCascade(state, nextKids, now = new Date().toISOString()) {
  const keep = new Set(nextKids.map((k) => k.id));
  const gone = new Set((state.kids || []).filter((k) => k.id && !keep.has(k.id)).map((k) => k.id));
  if (!gone.size) return { kids: nextKids };
  const deleted = { ...(state.deleted || {}) };
  for (const id of gone) deleted[id] = now;
  const patch = { kids: nextKids, deleted };
  for (const key of COLLECTIONS.filter((c) => c !== 'kids')) {
    patch[key] = (state[key] || []).filter((r) => {
      if (!gone.has(r.kidId)) return true;
      deleted[r.id] = now;
      return false;
    });
  }
  return patch;
}

export function mergeData(local, remote, { now = Date.now() } = {}) {
  // Lapidi unite (la più recente vince). Regola unica, come per i record: una lapide elimina l'elemento solo
  // se è più recente del suo updatedAt (assente = più vecchio). I bimbi oggi non hanno updatedAt: la lapide vince;
  // un bimbo ricreato ha un id nuovo e non è colpito.
  const deleted = { ...(local.deleted || {}) };
  for (const [id, t] of Object.entries(remote.deleted || {})) if (!deleted[id] || t > deleted[id]) deleted[id] = t;
  const isDead = (k) => !!deleted[k.id] && deleted[k.id] > (k.updatedAt || '');
  const deadIds = new Set(); // id (locali, dopo il remap) dei bimbi eliminati
  const lAll = local.kids || [];
  const lKids = lAll.filter((k) => !isDead(k));
  const deadLocal = lAll.filter(isDead);
  for (const k of deadLocal) deadIds.add(k.id);
  const kids = lKids.map((k) => ({ ...k }));
  const kidMap = {}; // id remoto -> id locale
  let addedKids = 0;
  const used = new Set(); // bimbi locali già abbinati in questa unione
  const norm = (s) => String(s || '').trim().toLowerCase();
  const rKids = remote.kids || [];
  const matched = new Map(); // remoto -> bimbo locale
  // passo A: stesso id (l'id vince sempre)
  for (const rk of rKids) {
    const m = kids.find((k) => k.id === rk.id && !used.has(k.id));
    if (m) { matched.set(rk, m); used.add(m.id); }
  }
  // passo B: per data di nascita, solo tra i bimbi locali originali (gemelli!)
  for (const rk of rKids) {
    if (matched.has(rk) || !rk.birth) continue;
    const cands = kids.slice(0, lKids.length).filter((k) => k.birth === rk.birth && !used.has(k.id));
    let m = null;
    if (cands.length === 1) {
      const c = cands[0];
      if (!(c.name && rk.name && norm(c.name) !== norm(rk.name))) m = c;
    } else if (cands.length > 1 && rk.name) {
      const byName = cands.filter((k) => norm(k.name) === norm(rk.name));
      if (byName.length === 1) m = byName[0];
    }
    if (m) { matched.set(rk, m); used.add(m.id); }
  }
  // bimbi remoti con lapide propria, o abbinabili per data di nascita (e nome compatibile) a un bimbo locale
  // eliminato e non ricreato: scartati insieme ai loro record. Il bimbo ricreato (id nuovo, vivo) ha la precedenza.
  const dropped = new Set();
  for (const rk of rKids) {
    if (matched.has(rk)) continue;
    if (isDead(rk)) { dropped.add(rk); deadIds.add(rk.id); continue; }
    if (!rk.birth) continue;
    const dead = deadLocal.filter((k) => k.birth === rk.birth && !(k.name && rk.name && norm(k.name) !== norm(rk.name)));
    if (dead.length === 1 && deleted[dead[0].id] > (rk.updatedAt || '')) { dropped.add(rk); kidMap[rk.id] = dead[0].id; }
  }
  for (const rk of rKids) {
    if (dropped.has(rk)) continue;
    const m = matched.get(rk);
    if (m) {
      used.add(m.id);
      kidMap[rk.id] = m.id;
      for (const f of ['sex', 'gaWeeks', 'name']) if (!m[f] && rk[f]) m[f] = rk[f];
    } else { kids.push({ ...rk }); kidMap[rk.id] = rk.id; addedKids++; }
  }
  const remap = (r) => (kidMap[r.kidId] && kidMap[r.kidId] !== r.kidId ? { ...r, kidId: kidMap[r.kidId] } : r);

  const mergeList = (lList = [], rList = [], prefixId = false) => {
    const out = new Map(lList.map((r) => [r.id, r]));
    const added = new Set(), updated = new Set();
    for (const r0 of rList) {
      let r = remap(r0);
      // id composti `<kidId>:<voce>`: segue il bimbo se è stato rimappato
      if (prefixId && r.kidId !== r0.kidId && r.id.startsWith(r0.kidId + ':')) r = { ...r, id: r.kidId + r.id.slice(r0.kidId.length) };
      const cur = out.get(r.id);
      if (!cur) { out.set(r.id, r); added.add(r.id); }
      else if (r.updatedAt && cur.updatedAt && r.updatedAt > cur.updatedAt && !same(r, cur)) { out.set(r.id, r); updated.add(r.id); }
      else if (r.updatedAt && !cur.updatedAt && !same(r, cur)) { out.set(r.id, r); updated.add(r.id); }
    }
    // lapidi: eliminano i record più vecchie della cancellazione
    for (const [id, r] of [...out]) if (deadIds.has(r.kidId) || (deleted[id] && deleted[id] > (r.updatedAt || ''))) { out.delete(id); added.delete(id); updated.delete(id); }
    return { list: [...out.values()], added, updated };
  };
  const g = mergeList(local.growth, remote.growth);
  const m = mergeList(local.meds, remote.meds);
  const mp = mergeList(local.medPlans, remote.medPlans);
  const ms = mergeList(local.milestones, remote.milestones, true);
  const tp = mergeList(local.temps, remote.temps);

  const since = now - H24;
  const recentDoses = m.list
    .filter((e) => m.added.has(e.id) && new Date(e.at).getTime() >= since && new Date(e.at).getTime() <= now + 3600000)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((e) => ({ id: e.id, kidId: e.kidId, name: e.name, at: e.at, amount: e.amount, unit: e.unit }));

  return {
    ...{ kids, growth: g.list, meds: m.list, medPlans: mp.list, milestones: ms.list, temps: tp.list }, deleted,
    stats: { addedGrowth: g.added.size, addedMeds: m.added.size, updated: g.updated.size + m.updated.size + mp.updated.size + ms.updated.size + tp.updated.size + tp.added.size, addedTemps: tp.added.size, addedMilestones: ms.added.size, addedPlans: mp.added.size, addedKids, removedKids: deadLocal.length, recentDoses }
  };
}
