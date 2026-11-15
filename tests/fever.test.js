import { describe, it, expect } from 'vitest';
import {
  completedMonths, ageDays, ageWarnings, feverDays, checklistHeader, amberItems, redItems, GREEN, AMBER, RED, isNight,
  DEFAULT_PREFS, normalizePrefs, baseMinutes, doseInWindow, followUpPhase, reminderPlan, buildIcs, H, MIN
} from '../src/lib/fever.js';
import { FEVER_TEXT } from '../src/lib/feverText.js';
import SOURCES from '../content/sources.json';

const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const iso = (ms) => new Date(ms).toISOString();
const P = DEFAULT_PREFS;
const T0 = at(2026, 11, 10, 8, 0);
const r = (min, value) => ({ at: iso(T0 + min * MIN), value });
const para = (min) => ({ kidId: 'k', active: 'paracetamolo', at: iso(T0 + min * MIN) });
const ibu = (min) => ({ kidId: 'k', active: 'ibuprofene', at: iso(T0 + min * MIN) });
const plan = (readings, meds = [], prefs = P) => reminderPlan({ readings, meds, kidId: 'k', prefs });

describe('età (cronologica, mesi compiuti)', () => {
  it('mesi compiuti sul calendario', () => {
    expect(completedMonths('2026-08-10', at(2026, 11, 9))).toBe(2);
    expect(completedMonths('2026-08-10', at(2026, 11, 10))).toBe(3);
    expect(completedMonths('2026-01-31', at(2026, 2, 28))).toBe(0);
    expect(completedMonths('xx', at(2026, 2, 28))).toBeNull();
  });
});

describe('avvisi per età', () => {
  const kinds = (birth, when, value, extra = {}) => ageWarnings({ birth, at: iso(when), value, ...extra }).map((w) => w.kind);
  it('sotto i 3 mesi: b1 con 38 o più, o "sembra caldo"; strict', () => {
    expect(kinds('2026-09-01', T0, 37.9)).toEqual([]);
    expect(kinds('2026-09-01', T0, 38)).toEqual(['b1']);
    expect(kinds('2026-09-01', T0, null, { feelsHot: true })).toEqual(['b1']);
    expect(ageWarnings({ birth: '2026-09-01', at: iso(T0), value: 38.4 })[0].strict).toBe(true);
  });
  it('confine dei 3 mesi: il giorno prima b1, il giorno dei 3 mesi b2 solo da 39', () => {
    // nato 2026-08-10: 3 mesi compiuti il 10 novembre
    expect(kinds('2026-08-10', at(2026, 11, 9), 38.5)).toEqual(['b1']);
    expect(kinds('2026-08-10', at(2026, 11, 10), 38.5)).toEqual([]);
    expect(kinds('2026-08-10', at(2026, 11, 10), 39)).toEqual(['b2']);
    expect(kinds('2026-08-10', at(2026, 11, 10), 38.9)).toEqual([]);
  });
  it('"sembra caldo" da 3 a 6 mesi attiva b2 (anche senza valore)', () => {
    expect(kinds('2026-08-10', at(2026, 11, 10), null, { feelsHot: true })).toEqual(['b2']);
    expect(kinds('2025-06-01', T0, null, { feelsHot: true })).toEqual(['b4']);
  });
  it('sotto i 3 mesi anche per giorni di vita (< 91): nato 31/12, misurato 31/3', () => {
    expect(ageDays('2025-12-31', at(2026, 3, 31))).toBe(90);
    expect(kinds('2025-12-31', at(2026, 3, 31), 38.5)).toEqual(['b1']);
    expect(kinds('2025-12-31', at(2026, 4, 1), 38.5)).toEqual([]);
  });
  it('b2 vale per tutto il 6° mese (mesi compiuti 3..6), poi b4', () => {
    // nato 2026-01-10 -> 6 mesi compiuti il 10 luglio, 7 il 10 agosto
    expect(kinds('2026-01-10', at(2026, 7, 9), 39.2)).toEqual(['b2']);
    expect(kinds('2026-01-10', at(2026, 7, 10), 39.2)).toEqual(['b2']);
    expect(kinds('2026-01-10', at(2026, 8, 9), 39.2)).toEqual(['b2']);
    expect(kinds('2026-01-10', at(2026, 8, 10), 39.2)).toEqual(['b4']);
  });
  it('oltre i 6 mesi: solo b4 (info), nessun b1/b2', () => {
    expect(kinds('2025-06-01', T0, 40)).toEqual(['b4']);
    expect(ageWarnings({ birth: '2025-06-01', at: iso(T0), value: 40 })[0].strict).toBeUndefined();
  });
  it('b3: febbre da 5 giorni o più, con misure >= 38 nelle ultime 24 h', () => {
    const hist = [0, 1, 2, 3, 4].map((d) => ({ at: iso(T0 + d * 24 * H), value: 38.3 }));
    const cur = T0 + 5 * 24 * H;
    expect(ageWarnings({ birth: '2025-06-01', at: iso(cur), value: 38.1, history: hist }).map((w) => w.kind)).toEqual(['b3', 'b4']);
    // solo 4 giorni
    expect(ageWarnings({ birth: '2025-06-01', at: iso(T0 + 4 * 24 * H), value: 38.1, history: hist.slice(0, 4) }).map((w) => w.kind)).toEqual(['b4']);
    // misura corrente sotto 38: b3 resta (l'ultima febbre è nelle 24 h precedenti)
    expect(ageWarnings({ birth: '2025-06-01', at: iso(cur), value: 37.2, history: hist }).map((w) => w.kind)).toEqual(['b3', 'b4']);
  });
  it('b3: "sembra caldo" conta come giorno di febbre (NICE 1.1.6)', () => {
    const hist = [0, 1, 2, 3, 4].map((d) => ({ at: iso(T0 + d * 24 * H), value: null, feelsHot: true }));
    expect(feverDays(hist, { at: iso(T0 + 5 * 24 * H), value: null, feelsHot: true })).toBeCloseTo(5, 5);
  });
  it('b3: un buco di oltre 48 h interrompe l\'episodio', () => {
    const hist = [{ at: iso(T0), value: 38.5 }, { at: iso(T0 + 24 * H), value: 38.5 }, { at: iso(T0 + 4 * 24 * H), value: 38.5 }];
    expect(feverDays(hist, { at: iso(T0 + 5 * 24 * H), value: 38.2 })).toBeCloseTo(1, 5);
  });
  it('b3: nessuna misura >= 38 nelle ultime 24 h -> 0', () => {
    expect(feverDays([{ at: iso(T0), value: 39 }], { at: iso(T0 + 3 * 24 * H), value: 38.1 })).toBe(0);
    expect(feverDays([{ at: iso(T0), value: 39 }, { at: iso(T0 + 4 * 24 * H), value: 37 }], { at: iso(T0 + 5 * 24 * H), value: 37.5 })).toBe(0);
  });
});

describe('intestazione "Come sta?"', () => {
  it('5-12 anni: testo NHS/AAP al posto del NICE', () => {
    expect(checklistHeader('2021-11-09', iso(T0))).toBe('h5to12');   // 5 anni compiuti
    expect(checklistHeader('2021-11-11', iso(T0))).toBe('h');        // 4 anni e 364 giorni
    expect(checklistHeader('2015-01-01', iso(T0))).toBe('h5to12');
    expect(checklistHeader('2026-01-01', iso(T0))).toBe('h');
  });
});

describe('elenchi per età e notte', () => {
  it('voci solo per età: a2 sotto i 12 mesi, r11 sotto i 18', () => {
    expect(amberItems(11)).toContain('a2'); expect(amberItems(12)).not.toContain('a2');
    expect(redItems(17)).toContain('r11'); expect(redItems(18)).not.toContain('r11');
  });
  it('notte: 21:00-07:00', () => {
    expect(isNight(new Date(2026, 10, 10, 21, 0))).toBe(true);
    expect(isNight(new Date(2026, 10, 10, 6, 59))).toBe(true);
    expect(isNight(new Date(2026, 10, 10, 7, 0))).toBe(false);
    expect(isNight(new Date(2026, 10, 10, 20, 59))).toBe(false);
  });
});

describe('intervalli dei promemoria (scelte personali)', () => {
  it('soglie predefinite: 37,5 -> 10, 37,0 -> 20, 36,5 -> 30, sotto nessuno', () => {
    expect(baseMinutes(39, P)).toBe(10);
    expect(baseMinutes(37.5, P)).toBe(10);
    expect(baseMinutes(37.4, P)).toBe(20);
    expect(baseMinutes(37.0, P)).toBe(20);
    expect(baseMinutes(36.9, P)).toBe(30);
    expect(baseMinutes(36.5, P)).toBe(30);
    expect(baseMinutes(36.4, P)).toBeNull();
    expect(baseMinutes(null, P)).toBeNull();
  });
  it('sotto 36,5 nessun promemoria per una misura isolata, anche dopo una dose e con preferenze strane', () => {
    expect(plan([r(0, 36.4)], [para(-30)])).toBeNull();
    const weird = normalizePrefs({ tiers: [{ min: 30, minutes: 5 }, { min: 30, minutes: 5 }, { min: 20, minutes: 5 }] });
    expect(baseMinutes(36.2, weird)).toBeNull();
    expect(plan([r(0, 35.0)])).toBeNull();
  });
  it('preferenze personalizzate e normalizzazione', () => {
    const p = normalizePrefs({ tiers: [{ min: 38, minutes: 15 }, { min: 37, minutes: 25 }, { min: 36.5, minutes: 45 }], windowH: '6', okBelow: '37,2' });
    expect(baseMinutes(38.2, p)).toBe(15);
    expect(baseMinutes(37.1, p)).toBe(25);
    expect(p.windowH).toBe(6); expect(p.okBelow).toBe(37.2);
    expect(normalizePrefs(null)).toEqual(P);
    expect(normalizePrefs({ windowH: -3, okBelow: 99, tiers: [{ minutes: 0 }] }).windowH).toBe(4);
  });
  it('senza dosi: intervallo di soglia, dueAt = ora + minuti', () => {
    const x = plan([r(0, 38.4)]);
    expect(x).toMatchObject({ minutes: 10, reason: 'threshold', doubled: false, followUp: null });
    expect(x.dueAt).toBe(T0 + 10 * MIN);
  });
  it('dopo una dose di paracetamolo nella finestra: intervalli raddoppiati', () => {
    expect(plan([r(0, 38.4)], [para(-60)])).toMatchObject({ minutes: 20, reason: 'doubled', doubled: true });
    expect(plan([r(0, 37.2)], [para(-60)]).minutes).toBe(40);
    expect(plan([r(0, 36.8)], [para(-60)]).minutes).toBe(60);
  });
  it('finestra: dentro fino a N ore incluse, fuori no; dose futura non conta', () => {
    expect(doseInWindow([para(-240)], 'k', T0, P)).toBe(true);
    expect(doseInWindow([para(-241)], 'k', T0, P)).toBe(false);
    expect(doseInWindow([para(10)], 'k', T0, P)).toBe(false);
    const p6 = normalizePrefs({ windowH: 6 });
    expect(doseInWindow([para(-300)], 'k', T0, p6)).toBe(true);
    expect(doseInWindow([{ ...para(-30), kidId: 'altro' }], 'k', T0, P)).toBe(false);
  });
  it('ibuprofene conta solo se l\'utente lo spunta', () => {
    expect(plan([r(0, 38.4)], [ibu(-60)]).doubled).toBe(false);
    expect(plan([r(0, 38.4)], [ibu(-60)], normalizePrefs({ withIbuprofen: true })).doubled).toBe(true);
  });
  it('altri farmaci non raddoppiano', () => {
    expect(plan([r(0, 38.4)], [{ kidId: 'k', active: 'vitaminaD', at: iso(T0 - 30 * MIN) }]).doubled).toBe(false);
  });
});

describe('fase di controllo 2 h / 4 h dopo una dose', () => {
  // dose a -30, misure: 39.0 (0), 38.2 (60 min, più bassa) -> parte la fase
  const base = [r(0, 39.0), r(60, 38.2)];
  it('non parte senza dose o senza calo', () => {
    expect(followUpPhase(base, [], 'k', T0 + 60 * MIN, P)).toBeNull();
    expect(followUpPhase([r(0, 38.0), r(60, 38.6)], [para(-30)], 'k', T0 + 60 * MIN, P)).toBeNull();
    expect(followUpPhase([r(0, 38.0)], [para(-30)], 'k', T0, P)).toBeNull();
  });
  it('calo dopo la dose: fase di 24 h; da "ok sotto" in su vale la soglia raddoppiata', () => {
    const fu = followUpPhase(base, [para(-30)], 'k', T0 + 60 * MIN, P);
    expect(fu).toMatchObject({ startAt: T0 + 60 * MIN, endAt: T0 + 60 * MIN + 24 * H, okChecks: 0, minutes: 120 });
    // a 38.2 la soglia (10 min, raddoppiata 20) è più corta: prevale
    expect(plan(base, [para(-30)])).toMatchObject({ minutes: 20, reason: 'doubled' });
    // un valore sotto "ok sotto" (anche sotto 36,5) in fase di controllo -> 2 h, non la soglia
    expect(plan([r(0, 37.6), r(60, 36.8)], [para(-30)])).toMatchObject({ minutes: 120, reason: 'followup2h' });
  });
  it('sotto "ok sotto" la fase di controllo prevale sulla soglia (scelta voluta); fuori fase vale la soglia raddoppiata', () => {
    const long = normalizePrefs({ tiers: [{ min: 37.5, minutes: 200 }, { min: 37, minutes: 200 }, { min: 36.5, minutes: 200 }] });
    expect(plan(base, [para(-30)], long)).toMatchObject({ minutes: 400, reason: 'doubled' });
    expect(plan([r(0, 39), r(60, 37.2)], [para(-30)], long)).toMatchObject({ minutes: 120, reason: 'followup2h' });
  });
  it('due controlli consecutivi sotto "ok sotto" -> ogni 4 h (se la soglia non è più corta)', () => {
    const long = normalizePrefs({ tiers: [{ min: 37.5, minutes: 300 }, { min: 37, minutes: 300 }, { min: 36.5, minutes: 300 }] });
    const one = [...base, r(180, 37.3)];
    expect(followUpPhase(one, [para(-30)], 'k', T0 + 180 * MIN, P)).toMatchObject({ okChecks: 1, minutes: 120 });
    const two = [...one, r(300, 37.0)];
    const fu = followUpPhase(two, [para(-30)], 'k', T0 + 300 * MIN, P);
    expect(fu).toMatchObject({ okChecks: 2, minutes: 240 });
    expect(plan(two, [para(-30)], long)).toMatchObject({ minutes: 240, reason: 'followup4h' });
    expect(plan(two, [para(-30)])).toMatchObject({ minutes: 240, reason: 'followup4h' });
    // un controllo da "ok sotto" in su torna alla soglia
    expect(plan([...two, r(420, 37.9)], [para(-30)]).minutes).toBe(10);
  });
  it('la misura che avvia la fase conta come primo controllo ok se è sotto "ok sotto"', () => {
    const rs = [r(0, 39), r(60, 37.2)];
    expect(followUpPhase(rs, [para(-30)], 'k', T0 + 60 * MIN, P)).toMatchObject({ okChecks: 1, minutes: 120 });
    const two = [...rs, r(180, 37.1)];
    expect(followUpPhase(two, [para(-30)], 'k', T0 + 180 * MIN, P)).toMatchObject({ okChecks: 2, minutes: 240 });
    expect(plan(two, [para(-30)])).toMatchObject({ minutes: 240, reason: 'followup4h' });
    // se la misura di avvio non è sotto "ok sotto" non conta
    expect(followUpPhase([r(0, 39), r(60, 38.2), r(180, 37.1)], [para(-30)], 'k', T0 + 180 * MIN, P).okChecks).toBe(1);
  });
  it('un controllo non OK azzera il conteggio', () => {
    const rs = [...base, r(180, 37.3), r(300, 37.9), r(420, 37.2)];
    expect(followUpPhase(rs, [para(-30)], 'k', T0 + 420 * MIN, P).okChecks).toBe(1);
  });
  it('"ok sotto" personalizzato', () => {
    const p = normalizePrefs({ okBelow: 37.0 });
    const rs = [...base, r(180, 37.3), r(300, 36.9)];
    expect(followUpPhase(rs, [para(-30)], 'k', T0 + 300 * MIN, p).okChecks).toBe(1);
  });
  it('tempi della fase personalizzabili (2 h, 4 h, 24 h)', () => {
    const p = normalizePrefs({ followMin: 90, longMin: 180, followHours: 12 });
    expect(p).toMatchObject({ followMin: 90, longMin: 180, followHours: 12 });
    expect(normalizePrefs({ followMin: 0, longMin: 'x', followHours: 500 })).toMatchObject({ followMin: 120, longMin: 240, followHours: 24 });
    expect(plan([r(0, 39), r(60, 37.2)], [para(-30)], p)).toMatchObject({ minutes: 90, reason: 'followup2h' });
    expect(followUpPhase([r(0, 39), r(60, 37.2), r(14 * 60, 37)], [para(-30)], 'k', T0 + 14 * 60 * MIN, p)).toBeNull();
  });
  it('finisce dopo 24 h', () => {
    const later = [...base, r(60 + 24 * 60 + 1, 37.0)];
    expect(followUpPhase(later, [para(-30)], 'k', T0 + (60 + 24 * 60 + 1) * MIN, P)).toBeNull();
    const inside = [...base, r(60 + 24 * 60, 37.0)];
    expect(followUpPhase(inside, [para(-30)], 'k', T0 + (60 + 24 * 60) * MIN, P)).not.toBeNull();
    const long = normalizePrefs({ tiers: [{ min: 37.5, minutes: 200 }, { min: 37, minutes: 200 }, { min: 36.5, minutes: 200 }] });
    expect(plan(later, [para(-30)], long)).toMatchObject({ minutes: 200, reason: 'threshold', followUp: null });
  });
  it('sotto 36,5: nessun promemoria fuori fase, controllo a 2 h in fase', () => {
    expect(plan([r(0, 36.2)])).toBeNull();
    expect(plan([...base, r(180, 36.2)], [para(-30)])).toMatchObject({ minutes: 120, reason: 'followup2h' });
  });
  it('il calo deve avvenire dopo la dose (entro 24 h)', () => {
    expect(followUpPhase([r(0, 39), r(60, 38.2)], [para(120)], 'k', T0 + 60 * MIN, P)).toBeNull();
    expect(followUpPhase([r(0, 39), r(60, 38.2)], [para(-25 * 60)], 'k', T0 + 60 * MIN, P)).toBeNull();
  });
});

describe('.ics', () => {
  const ics = buildIcs({ at: Date.UTC(2026, 10, 10, 9, 30), now: Date.UTC(2026, 10, 10, 9, 0), uid: 'abc123', lang: 'it' });
  it('struttura: evento con allarme all\'ora indicata, righe CRLF', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261110T093000Z');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:PT0S');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
    expect(ics).not.toMatch(/[^\r]\n/);
  });
  it('contiene solo il titolo generico, senza nome o valori', () => {
    expect(ics).toContain('SUMMARY:Lunibù: controllo temperatura');
    for (const l of ['it', 'ru', 'en']) {
      const x = buildIcs({ at: T0, uid: 'u', lang: l });
      const text = x.split('\r\n').filter((l) => /^(SUMMARY|DESCRIPTION)/.test(l)).join(' ');
      expect(text).not.toMatch(/\d|°/);
      expect(text).not.toMatch(/Mario|Sofia|bimb|ребён|child/i);
    }
    const lines = ics.split('\r\n').filter((l) => /^(SUMMARY|DESCRIPTION)/.test(l));
    expect(lines).toEqual(['SUMMARY:Lunibù: controllo temperatura', 'DESCRIPTION:Lunibù: controllo temperatura']);
  });
  it('uid casuale se assente e senza caratteri speciali', () => {
    const a = buildIcs({ at: T0 }), b = buildIcs({ at: T0 });
    expect(a).toMatch(/UID:[A-Za-z0-9-]+@lunibu/);
    expect(a).not.toBe(b);
  });
});

describe('testi', () => {
  it('IT/RU/EN completi, con fonti esistenti e 112 come link tel:', () => {
    const keys = (o) => Object.keys(o).sort();
    expect(keys(FEVER_TEXT.ru)).toEqual(keys(FEVER_TEXT.it));
    expect(keys(FEVER_TEXT.en)).toEqual(keys(FEVER_TEXT.it));
    for (const l of ['it', 'ru', 'en']) {
      for (const k of [...GREEN, ...AMBER, ...RED]) expect(FEVER_TEXT[l].items[k], `${l} ${k}`).toBeTruthy();
    }
    for (const id of ['M1', 'M8', 'M10', 'M11', 'M12', 'E27']) expect(SOURCES[id], id).toBeTruthy();
  });
  it('nessun testo promette o suggerisce un tempo di effetto', () => {
    const all = JSON.stringify(FEVER_TEXT);
    expect(all).not.toMatch(/doveva già|dovrebbe già|should have (dropped|come down)|должна была/i);
  });
  it('EN usa diapers, non nappies', () => {
    expect(JSON.stringify(FEVER_TEXT.en)).not.toMatch(/nappies/);
  });
});

describe('sincronizzazione delle temperature', () => {
  it('unione con id, updatedAt e lapidi', async () => {
    const { mergeData, buildQuickPayload } = await import('../src/lib/sync.js');
    const t = (id, u, v = 38) => ({ id, kidId: 'k', at: '2026-11-10T08:00:00.000Z', value: v, updatedAt: u });
    const local = { kids: [{ id: 'k', birth: '2025-01-01' }], temps: [t('a', '2026-11-10T09:00:00Z'), t('c', '2026-11-10T09:00:00Z')], deleted: {} };
    const remote = { kids: [{ id: 'k', birth: '2025-01-01' }], temps: [t('a', '2026-11-10T10:00:00Z', 39), t('b', '2026-11-10T09:00:00Z')], deleted: { c: '2026-11-10T11:00:00Z' } };
    const m = mergeData(local, remote);
    expect(m.temps.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(m.temps.find((x) => x.id === 'a').value).toBe(39);
    expect(m.stats.addedTemps).toBe(1);
    const q = buildQuickPayload({ kids: local.kids, temps: [t('a', new Date().toISOString())], deleted: {} });
    expect(q.temps).toHaveLength(1);
  });
});
