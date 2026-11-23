import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ks from '../src/lib/keystore.js';
import { migrateLegacyPass } from '../src/lib/driveStore.js';
import { exportEncrypted, importEncrypted, encodeQr, decodeQr, buildQuickPayload } from '../src/lib/sync.js';

const mkStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] }; };
const memDevice = () => { let k = null; return { get: async () => k, put: async (x) => { k = x; }, drop: () => { k = null; } }; };

describe('chiave di abbinamento', () => {
  it('formato: prefisso lk1., 43 caratteri base64url, casuale', () => {
    const a = ks.newPairKey(), b = ks.newPairKey();
    expect(a).toMatch(/^lk1\.[A-Za-z0-9_-]{43}$/);
    expect(a.length).toBe(47);
    expect(a).not.toBe(b);
    expect(ks.isPairKey(a)).toBe(true);
    expect(ks.isPairKey('una frase qualsiasi')).toBe(false);
  });
  it('parsing di #pair=', () => {
    const k = ks.newPairKey();
    expect(ks.pairFromHash(`#pair=${k}`)).toBe(k);
    expect(ks.pairFromHash(`#/pair=${k}`)).toBe(k);
    expect(ks.pairFromHash(`#pair=${k}x`)).toBeNull();
    expect(ks.pairFromHash('#pair=abc')).toBeNull();
    expect(ks.pairFromHash('#sync=abc')).toBeNull();
    expect(ks.pairFromHash('')).toBeNull();
    expect(ks.pairLink('https://x.y/App/', k)).toBe(`https://x.y/App/#pair=${k}`);
  });
  it('la chiave funziona come frase: file e QR compatibili', async () => {
    const k = ks.newPairKey();
    const st = { kids: [{ id: 'a', name: 'A', birth: '2024-01-01' }] };
    expect((await importEncrypted(await exportEncrypted(st, k), k)).kids).toHaveLength(1);
    const { data } = await encodeQr(buildQuickPayload(st), k);
    expect((await decodeQr(data, k)).quick).toBe(true);
    await expect(importEncrypted(await exportEncrypted(st, k), ks.newPairKey())).rejects.toThrow('bad-pass');
  });
});

describe('keystore (ripiego device)', () => {
  let dev;
  beforeEach(() => {
    vi.stubGlobal('localStorage', mkStorage());
    dev = memDevice(); ks._setDeviceStore(dev);
    ks.clear();
  });
  it('store/unlock round-trip senza testo in chiaro in localStorage', async () => {
    const k = ks.newPairKey();
    await ks.store(k);
    expect(ks.hasSecret()).toBe(true);
    expect(ks.kind()).toBe('device');
    const raw = localStorage.getItem('lunibu:keystore');
    expect(raw).not.toContain(k);
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['ct', 'iv', 'kind']);
    expect(await ks.unlock()).toBe(k);
  });
  it('dopo il riavvio (memoria persa) si sblocca dal testo cifrato; chiave persa -> no-pass e voce rimossa', async () => {
    await ks.store('frase lunga abbastanza');
    const saved = localStorage.getItem('lunibu:keystore');
    ks.clear(); localStorage.setItem('lunibu:keystore', saved);
    expect(ks.isUnlocked()).toBe(false);
    expect(await ks.unlock()).toBe('frase lunga abbastanza');
    ks.clear(); localStorage.setItem('lunibu:keystore', saved); dev.drop();
    await expect(ks.unlock()).rejects.toThrow('no-pass');
    expect(ks.hasSecret()).toBe(false);
  });
  it('senza segreto unlock dà no-pass; clear cancella', async () => {
    await expect(ks.unlock()).rejects.toThrow('no-pass');
    await ks.store('x'.repeat(10)); ks.clear();
    expect(ks.hasSecret()).toBe(false);
  });
  it('PRF: chiave derivata deterministica e cifratura round-trip', async () => {
    const bytes = new Uint8Array(32).fill(7);
    const a = await ks.keyFromPrf(bytes);
    const sealed = await ks.seal(a, 'segreto');
    expect(await ks.open(await ks.keyFromPrf(bytes), sealed)).toBe('segreto');
    await expect(ks.open(await ks.keyFromPrf(new Uint8Array(32).fill(8)), sealed)).rejects.toThrow('locked');
  });
});

describe('migrazione della frase in chiaro', () => {
  it('sposta pass nel keystore e lo toglie da lunibu:drive', async () => {
    vi.stubGlobal('localStorage', mkStorage()); ks.clear();
    let d = { fileId: 'f', pass: 'vecchia frase', remember: true, lastSync: 1 };
    const store = vi.fn(async () => {});
    expect(await migrateLegacyPass({ store, get: () => d, set: (p) => { d = { ...d, ...p }; for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k]; } })).toBe(true);
    expect(store).toHaveBeenCalledWith('vecchia frase');
    expect(d).toEqual({ fileId: 'f', lastSync: 1 });
  });
  it('senza pass in chiaro non fa nulla; se store fallisce la frase resta', async () => {
    expect(await migrateLegacyPass({ store: vi.fn(), get: () => ({ fileId: 'f' }), set: vi.fn() })).toBe(false);
    const set = vi.fn();
    await expect(migrateLegacyPass({ store: async () => { throw new Error('storage'); }, get: () => ({ pass: 'p' }), set })).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('riuso della passkey PRF', () => {
  it('nuova voce con stessi credId e salt, decifrabile con lo stesso risultato PRF', async () => {
    const first = new Uint8Array(32).fill(3);
    const prev = { kind: 'prf', credId: 'AAAA', salt: 'BBBB', iv: 'x', ct: 'y' };
    const e = await ks.sealPrfEntry(prev, first, 'nuovo segreto');
    expect([e.kind, e.credId, e.salt]).toEqual(['prf', 'AAAA', 'BBBB']);
    expect(await ks.open(await ks.keyFromPrf(first), e)).toBe('nuovo segreto');
  });
});
