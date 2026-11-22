import { describe, it, expect, beforeEach } from 'vitest';
import { clearState, saveState, loadState } from '../src/lib/storage.js';

function fakeStorage() {
  const m = new Map();
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k)
  };
}

describe('clearState', () => {
  beforeEach(() => { globalThis.localStorage = fakeStorage(); });
  it('rimuove tutte le chiavi lunibu: e lascia le altre', () => {
    saveState({ kids: [{ id: 'a' }] });
    for (const k of ['drive', 'fever-prefs', 'fever-reminder', 'medmap', 'calibration', 'tour', 'version']) localStorage.setItem('lunibu:' + k, '{}');
    localStorage.setItem('altro', 'x');
    clearState();
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('altro')).toBe('x');
    expect(loadState().kids).toEqual([]);
  });
});
