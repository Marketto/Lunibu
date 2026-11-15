// Registro della temperatura: logica pura (nessun accesso a React, DOM o rete).
//
// Cosa contiene: avvisi per età, intestazione per età, elenchi per età, intervalli dei promemoria
// (SCELTE PERSONALI dell'utente, non evidenza scientifica), raddoppio dopo una dose registrata,
// fase di controllo a 2 h / 4 h, generazione del file .ics.
// Nessun tempo di effetto del farmaco e nessun "doveva già scendere": le fonti non lo indicano (NICE 1.4.8).

export const H = 3600000;
export const MIN = 60000;

/** Soglia di febbre secondo NHS (38 °C o più). */
export const FEVER_C = 38;
/** Valori accettati dal modulo (°C, una cifra decimale). */
export const TEMP_MIN = 30;
export const TEMP_MAX = 43;

export const SITES = ['axilla', 'ear', 'forehead', 'mouth', 'rectum', 'other'];

/* ---------- età (cronologica; l'età corretta NON è usata) ---------- */

/** Mesi compiuti (calendario) tra nascita (YYYY-MM-DD) e istante `at`. */
export function completedMonths(birth, at) {
  const bp = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth || ''));
  const a = new Date(at);
  if (!bp || isNaN(a)) return null;
  const by = +bp[1], bm = +bp[2] - 1, bd = +bp[3];
  const ay = a.getFullYear(), am = a.getMonth(), ad = a.getDate();
  let m = (ay - by) * 12 + (am - bm);
  if (ad < bd) m -= 1;
  return Math.max(0, m);
}

export const completedYears = (birth, at) => {
  const m = completedMonths(birth, at);
  return m == null ? null : Math.floor(m / 12);
};

/* ---------- avvisi per età ---------- */

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Giorni di vita (giorni di calendario locali) alla data di `at`. */
export function ageDays(birth, at) {
  const bp = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth || ''));
  const a = new Date(at);
  if (!bp || isNaN(a)) return null;
  return Math.round((dayStart(a) - new Date(+bp[1], +bp[2] - 1, +bp[3]).getTime()) / 86400000);
}

/**
 * Avvisi da mostrare per una misura.
 *  b1  sotto i 3 mesi (mesi compiuti < 3 oppure < 91 giorni) e (>= 38 oppure "sembra caldo") -> strict
 *  b2  da 3 mesi a tutto il 6° mese (mesi compiuti 3..6) e (>= 39 oppure "sembra caldo") -> strict
 *  b3  febbre da almeno 5 giorni (vedi feverDays), anche se la misura corrente è sotto 38
 *  b4  oltre i 6 mesi (mesi compiuti >= 7): informazione
 * `history`: misure precedenti del bambino [{ at, value, feelsHot }].
 */
export function ageWarnings({ birth, at, value = null, feelsHot = false, history = [] }) {
  const months = completedMonths(birth, at);
  if (months == null) return [];
  const days = ageDays(birth, at);
  const v = typeof value === 'number' && isFinite(value) ? value : null;
  const under3 = months < 3 || (days != null && days < 91);
  const out = [];
  if (under3 && ((v != null && v >= FEVER_C) || feelsHot)) out.push({ kind: 'b1', strict: true });
  if (!under3 && months <= 6 && ((v != null && v >= 39) || feelsHot)) out.push({ kind: 'b2', strict: true });
  if (feverDays(history, { at, value: v, feelsHot }) >= 5) out.push({ kind: 'b3' });
  if (months >= 7) out.push({ kind: 'b4' });
  return out;
}

const isFeverReading = (r) => (typeof r.value === 'number' && r.value >= FEVER_C) || r.feelsHot === true;

/**
 * Giorni di febbre continua fino ad `current.at`.
 * Episodio di febbre: misure >= 38 (o "sembra caldo") a non più di 48 h l'una dall'altra; l'ultima deve essere
 * nelle 24 h prima di `current.at`. La misura corrente conta se è febbre, ma non è necessaria.
 * Restituisce i giorni (24 h) dall'inizio dell'episodio, 0 se non c'è.
 */
export function feverDays(history, current) {
  const pts = [...(history || []), ...(current ? [current] : [])]
    .filter(isFeverReading)
    .map((r) => new Date(r.at).getTime())
    .filter((t) => isFinite(t))
    .sort((a, b) => a - b);
  if (!pts.length) return 0;
  const now = current ? new Date(current.at).getTime() : pts[pts.length - 1];
  const upto = pts.filter((t) => t <= now);
  if (!upto.length || now - upto[upto.length - 1] > 24 * H) return 0;
  let start = upto[upto.length - 1];
  for (let i = upto.length - 2; i >= 0; i--) {
    if (start - upto[i] > 48 * H) break;
    start = upto[i];
  }
  return (now - start) / (24 * H);
}

/** Intestazione "Come sta?": 5-12 anni usa il testo NHS/AAP al posto di quello NICE. */
export const checklistHeader = (birth, at) => ((completedYears(birth, at) ?? 0) >= 5 ? 'h5to12' : 'h');

/* ---------- elenchi di consultazione (statici) ---------- */

export const GREEN = ['g1', 'g2', 'g3', 'g4', 'g5'];
export const AMBER = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
export const RED = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
/** a2 (mangia o beve poco) solo lattanti < 12 mesi; r11 (fontanella) solo < 18 mesi. */
export const amberItems = (months) => AMBER.filter((k) => k !== 'a2' || (months ?? 0) < 12);
export const redItems = (months) => RED.filter((k) => k !== 'r11' || (months ?? 0) < 18);

/** Tra le 21:00 e le 07:00 (ora locale) "Dorme" è mostrato in evidenza. */
export const isNight = (d = new Date()) => { const h = d.getHours(); return h >= 21 || h < 7; };

/* ---------- promemoria: preferenze dell'utente ---------- */

export const DEFAULT_PREFS = {
  tiers: [{ min: 37.5, minutes: 10 }, { min: 37.0, minutes: 20 }, { min: 36.5, minutes: 30 }],
  windowH: 4,        // "finestra dopo il farmaco": scelta personale, NON la durata d'effetto del farmaco
  withIbuprofen: false,
  okBelow: 37.5,     // "ok sotto": soglia scelta dall'utente per la fase a 2 h / 4 h
  followMin: 120,    // controlli della fase dopo una dose (minuti): scelta personale
  longMin: 240,      // dopo due controlli ok di fila (minuti)
  followHours: 24    // durata della fase (ore)
};
export const FLOOR_C = 36.5; // sotto questo valore nessun intervallo, salvo la fase di controllo dopo una dose

const num = (v, d) => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v; return typeof n === 'number' && isFinite(n) ? n : d; };

const inRange = (n, lo, hi, d) => (n >= lo && n <= hi ? n : d);

/** Preferenze valide: valori mancanti o assurdi tornano al predefinito. */
export function normalizePrefs(p) {
  const d = DEFAULT_PREFS;
  const tiers = d.tiers.map((t, i) => {
    const src = p?.tiers?.[i];
    const minutes = Math.round(num(src?.minutes, t.minutes));
    const min = Math.max(FLOOR_C, num(src?.min, t.min));
    return { min, minutes: minutes >= 1 && minutes <= 720 ? minutes : t.minutes };
  }).sort((a, b) => b.min - a.min);
  const windowH = num(p?.windowH, d.windowH);
  const okBelow = num(p?.okBelow, d.okBelow);
  return {
    tiers,
    windowH: windowH > 0 && windowH <= 24 ? windowH : d.windowH,
    withIbuprofen: !!p?.withIbuprofen,
    okBelow: okBelow >= FLOOR_C && okBelow <= 40 ? okBelow : d.okBelow,
    followMin: inRange(Math.round(num(p?.followMin, d.followMin)), 1, 720, d.followMin),
    longMin: inRange(Math.round(num(p?.longMin, d.longMin)), 1, 1440, d.longMin),
    followHours: inRange(num(p?.followHours, d.followHours), 1, 72, d.followHours)
  };
}

/** Intervallo di base (minuti) dalla soglia; null sotto 36,5 °C. */
export function baseMinutes(value, prefs = DEFAULT_PREFS) {
  if (typeof value !== 'number' || !isFinite(value) || value < FLOOR_C) return null;
  const t = [...prefs.tiers].sort((a, b) => b.min - a.min).find((x) => value >= x.min);
  return t ? t.minutes : null;
}

const doseTimes = (meds, kidId, prefs) => (meds || [])
  .filter((e) => e.kidId === kidId && (e.active === 'paracetamolo' || (prefs.withIbuprofen && e.active === 'ibuprofene')))
  .map((e) => new Date(e.at).getTime())
  .filter((t) => isFinite(t))
  .sort((a, b) => a - b);

/** Dose registrata (paracetamolo, o anche ibuprofene se scelto) entro la finestra personale prima di `atMs`. */
export function doseInWindow(meds, kidId, atMs, prefs = DEFAULT_PREFS) {
  return doseTimes(meds, kidId, prefs).some((t) => t <= atMs && atMs - t <= prefs.windowH * H);
}

/**
 * Fase di controllo dopo una dose: scatta alla prima misura con valore più basso della precedente
 * registrata dopo una dose (entro 24 h dalla dose). Per le 24 h successive si propone un controllo ogni 2 h;
 * dopo 2 controlli consecutivi sotto "ok sotto" (la misura che avvia la fase conta come il primo, se è sotto) si passa a ogni 4 h. Finisce dopo 24 h.
 * `readings`: misure con valore, qualsiasi ordine. Restituisce null se la fase non è attiva a `nowMs`.
 */
export function followUpPhase(readings, meds, kidId, nowMs, prefs = DEFAULT_PREFS) {
  const rs = (readings || []).filter((r) => typeof r.value === 'number' && isFinite(r.value))
    .map((r) => ({ t: new Date(r.at).getTime(), v: r.value })).filter((r) => isFinite(r.t) && r.t <= nowMs).sort((a, b) => a.t - b.t);
  const doses = doseTimes(meds, kidId, prefs).filter((t) => t <= nowMs);
  if (rs.length < 2 || !doses.length) return null;
  // per ogni dose (dalla più recente) il primo calo successivo avvia la fase; vince la più recente ancora attiva
  let phase = null;
  for (const dose of [...doses].reverse()) {
    for (let k = 1; k < rs.length; k++) {
      if (rs[k].t < dose || !(rs[k].v < rs[k - 1].v)) continue;
      if (rs[k].t - dose <= 24 * H && nowMs - rs[k].t <= prefs.followHours * H) phase = { startAt: rs[k].t, k };
      break;
    }
    if (phase) break;
  }
  if (!phase) return null;
  let ok = 0;
  // la misura che avvia la fase (primo calo dopo la dose) conta come primo controllo ok se è sotto "ok sotto"
  for (let i = rs.length - 1; i >= phase.k; i--) { if (rs[i].v < prefs.okBelow) ok++; else break; }
  return { startAt: phase.startAt, endAt: phase.startAt + prefs.followHours * H, okChecks: ok, minutes: ok >= 2 ? prefs.longMin : prefs.followMin };
}

/**
 * Intervallo proposto dopo aver salvato una misura.
 * `readings` include la misura appena salvata (l'ultima in ordine di tempo è quella corrente).
 * Restituisce { minutes, dueAt, reason, doubled, followUp } oppure null (nessun promemoria).
 *  - In fase di controllo dopo una dose: valore sotto "ok sotto" (anche sotto 36,5) -> 2 h, o 4 h dopo
 *    due controlli OK consecutivi; valore da "ok sotto" in su -> intervallo di soglia (raddoppiato nella finestra).
 *  - Fuori dalla fase: intervallo di soglia (raddoppiato nella finestra); sotto 36,5 °C nessun promemoria.
 * reason: 'threshold' | 'doubled' | 'followup2h' | 'followup4h'
 */
export function reminderPlan({ readings, meds, kidId, prefs = DEFAULT_PREFS }) {
  const rs = (readings || []).filter((r) => typeof r.value === 'number' && isFinite(r.value))
    .map((r) => ({ ...r, t: new Date(r.at).getTime() })).filter((r) => isFinite(r.t)).sort((a, b) => a.t - b.t);
  if (!rs.length) return null;
  const cur = rs[rs.length - 1];
  const fu = followUpPhase(rs, meds, kidId, cur.t, prefs);
  if (fu && cur.value < prefs.okBelow) {
    return { minutes: fu.minutes, dueAt: cur.t + fu.minutes * MIN, reason: fu.okChecks >= 2 ? 'followup4h' : 'followup2h', doubled: false, followUp: fu };
  }
  const base = baseMinutes(cur.value, prefs);
  if (base == null) return null; // fuori dalla fase, sotto 36,5 °C: nessun intervallo
  const doubled = doseInWindow(meds, kidId, cur.t, prefs);
  const minutes = doubled ? base * 2 : base;
  return { minutes, dueAt: cur.t + minutes * MIN, reason: doubled ? 'doubled' : 'threshold', doubled, followUp: fu };
}

/* ---------- .ics ---------- */

const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
export const ICS_TITLE = {
  it: 'Lunibù: controllo temperatura',
  ru: 'Lunibù: измерение температуры',
  en: 'Lunibù: temperature check'
};

/**
 * Evento di calendario con un allarme all'ora indicata. Contiene SOLO il titolo generico:
 * né nome del bambino né valori. `uid` è casuale (nessun dato personale).
 */
export function buildIcs({ at, now = Date.now(), uid, lang = 'it' }) {
  const title = icsEscape(ICS_TITLE[lang] || ICS_TITLE.it);
  const id = String(uid || Math.random().toString(36).slice(2) + now.toString(36)).replace(/[^A-Za-z0-9-]/g, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lunibu//Temperature reminder//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${id}@lunibu`, `DTSTAMP:${icsDate(now)}`, `DTSTART:${icsDate(at)}`, `DTEND:${icsDate(at + 5 * MIN)}`,
    `SUMMARY:${title}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:PT0S', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ];
  return lines.join('\r\n') + '\r\n';
}
