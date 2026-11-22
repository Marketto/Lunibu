import { describe, it, expect } from 'vitest';
import { localDate, localDateTime, nowLocal, uid } from '../src/lib/util.js';
import { toCsv } from '../src/lib/meds.js';

describe('util date locali', () => {
  it('localDate usa i getter locali (indipendente dal fuso)', () => {
    const d = new Date(2026, 0, 5, 0, 7);
    expect(localDate(d)).toBe('2026-01-05');
    expect(localDateTime(d)).toBe('2026-01-05T00:07');
    const n = new Date();
    expect(localDate(n)).toBe(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`);
    expect(nowLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
  it('uid è diverso a ogni chiamata', () => { expect(uid()).not.toBe(uid()); });
});

describe('toCsv', () => {
  it('neutralizza le formule', () => {
    const out = toCsv([['=1+1', '+a', '-b', '@c', 'ok', 3, null]], ['h']);
    expect(out.split('\n')[1]).toBe(`"'=1+1";"'+a";"'-b";"'@c";"ok";"3";""`);
  });
});
