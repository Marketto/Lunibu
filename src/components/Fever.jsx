// Diario → Temperatura. Registro + "Come sta?" + promemoria facoltativi (scelte personali dell'utente).
// La logica è in src/lib/fever.js; i testi verificati in src/lib/feverText.js.
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Refs, tap } from './Common.jsx';
import { Character } from './Characters.jsx';
import { LOCALE } from '../lib/i18n.js';
import { FEVER_REFS, FEVER_SOURCES, FEVER_TEXT } from '../lib/feverText.js';
import {
  DEFAULT_PREFS, FEVER_C, GREEN, MIN, SITES, TEMP_MAX, TEMP_MIN, ageWarnings, amberItems, buildIcs, checklistHeader,
  completedMonths, isNight, normalizePrefs, redItems, reminderPlan
} from '../lib/fever.js';
import { clearPrefs, loadRawPrefs, loadReminder, saveRawPrefs, saveReminder } from '../lib/feverStore.js';
import SOURCES from '../../content/sources.json';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const parseVal = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? Math.round(n * 10) / 10 : null; };
const validVal = (n) => n != null && n >= TEMP_MIN && n <= TEMP_MAX;
const dec = (n, lang) => (n == null ? '–' : n.toFixed(1).replace('.', lang === 'en' ? '.' : ','));
const pad2 = (n) => String(n).padStart(2, '0');
const when = (iso, lang) => new Date(iso).toLocaleString(LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' });
const RANGES = [1, 3, 7];

function Block({ k, s, className = '', children }) {
  return <p className={`fever-info ${className}`}>{children ?? s[k]} <Refs ids={FEVER_REFS[k]} /></p>;
}

function Warnings({ list, s, onlyAlerts = false }) {
  const shown = list.filter((w) => !onlyAlerts || w.kind !== 'b4');
  if (!shown.length) return null;
  return (
    <>
      {shown.map((w) => (
        <div key={w.kind} className={`fever-warn ${w.strict ? 'strict' : ''}`} role={w.strict ? 'alert' : 'note'}>
          <strong aria-hidden="true">{w.strict ? '⚠️' : 'ℹ️'}</strong>
          <p>{s[w.kind]} <Refs ids={FEVER_REFS[w.kind]} />{w.kind === 'b3' && <><br /><small>{s.b3note}</small></>}</p>
        </div>
      ))}
    </>
  );
}

/** Elenchi statici di consultazione (verde / giallo / rosso + "Dorme"): nessun risultato calcolato dai dati inseriti. */
function ReadingLists({ s, months, header, night }) {
  const list = (cls, title, keys, refs, result, extra) => (
    <section className={`fever-result ${cls}`} aria-label={title}>
      <h4>{title} <Refs ids={refs} /></h4>
      <ul>{keys.map((k) => <li key={k}>{s.items[k]}</li>)}</ul>
      <p><span className="small">{s.lead}</span> <strong>{result}</strong></p>
      {extra}
    </section>
  );
  return (
    <div className="fever-sheet">
      <h3>{s.how}</h3>
      <Block k={header} s={s} className="small muted" />
      <p className="small muted">{s.howIntro}</p>
      {list('green', s.greenTitle, GREEN, FEVER_REFS.green, s.results.green)}
      {list('amber', s.amberTitle, amberItems(months), FEVER_REFS.amber, s.results.amber, <p className="small">{s.amberNote} <Refs ids={['M1', 'M10']} /></p>)}
      {list('red', s.redTitle, redItems(months), FEVER_REFS.red, s.results.red, <a className="btn danger fever-112" href="tel:112">📞 {s.call112}</a>)}
      <details className="fever-asleep" open={night}>
        <summary>{s.asleep} <Refs ids={FEVER_REFS.asleep} /></summary>
        <p className="small">{s.results.asleep}</p>
        <a className="btn ghost fever-112-soft" href="tel:112">📞 {s.call112}</a>
      </details>
    </div>
  );
}

function CheckItem({ checked, onChange, children }) {
  return (
    <label className="check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box" aria-hidden="true">{checked ? '✓' : ''}</span> <span>{children}</span></label>
  );
}

/* ---------- grafico ---------- */
function FeverChart({ readings, doses, days, s, lang }) {
  const W = 340, Hh = 200, P = { l: 30, r: 10, t: 16, b: 26 };
  const end = Date.now(), start = end - days * 86400000;
  const pts = readings.filter((r) => r.t >= start && r.t <= end);
  if (pts.length < 2) return <p className="small muted">{s.chartEmpty}</p>;
  const vs = pts.map((p) => p.value);
  const yMin = Math.min(36, Math.floor(Math.min(...vs) - 0.5)), yMax = Math.max(39, Math.ceil(Math.max(...vs) + 0.5));
  const x = (t) => P.l + ((t - start) / (end - start)) * (W - P.l - P.r);
  const y = (v) => Hh - P.b - ((v - yMin) / (yMax - yMin)) * (Hh - P.t - P.b);
  const ticks = []; for (let v = Math.ceil(yMin); v <= yMax; v += 1) ticks.push(v);
  const marks = doses.filter((d) => d.t >= start && d.t <= end);
  const fmtT = (t) => new Date(t).toLocaleDateString(LOCALE[lang], { day: '2-digit', month: '2-digit' });
  const label = `${s.chart}: ${pts.map((p) => `${dec(p.value, lang)} °C ${when(new Date(p.t).toISOString(), lang)}`).join('; ')}`;
  return (
    <svg className="growth-chart fever-chart" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label={label}>
      {ticks.map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" /><text x={P.l - 4} y={y(v) + 3} className="axis" textAnchor="end">{v}</text></g>)}
      <line x1={P.l} x2={W - P.r} y1={y(FEVER_C)} y2={y(FEVER_C)} className="fever-line" />
      <text x={P.l + 3} y={y(FEVER_C) - 3} className="axis">38 °C</text>
      {marks.map((d) => (
        <g key={d.id}>
          <line x1={x(d.t)} x2={x(d.t)} y1={P.t} y2={Hh - P.b} className="dose-mark" />
          <text x={x(d.t)} y={P.t - 4} className="dose-letter" textAnchor="middle">{d.active === 'ibuprofene' ? 'I' : 'P'}</text>
          <title>{`${d.active === 'ibuprofene' ? s.drugI : s.drugP} ${when(new Date(d.t).toISOString(), lang)}`}</title>
        </g>
      ))}
      {pts.length > 1 && <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join('')} className="kid-line" />}
      {pts.map((p) => <circle key={p.id} cx={x(p.t)} cy={y(p.value)} r={5} className={`kid-pt ${p.value >= FEVER_C ? 'warn' : ''}`} />)}
      <text x={P.l} y={Hh - 7} className="axis">{fmtT(start)}</text>
      <text x={W - P.r} y={Hh - 7} className="axis" textAnchor="end">{fmtT(end)}</text>
    </svg>
  );
}

/* ---------- promemoria ---------- */
async function showNotification(title, body) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) await reg.showNotification(title, { body, tag: 'lunibu-fever' });
    else new Notification(title, { body, tag: 'lunibu-fever' });
  } catch { /* le notifiche sono facoltative */ }
}

function downloadIcs(at, lang) {
  const text = buildIcs({ at, lang });
  const blob = new Blob([text], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lunibu-promemoria.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function ReminderBanner({ reminder, setReminder, s, lang }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!reminder) return null;
  const rem = reminder.dueAt - now;
  const due = rem <= 0;
  return (
    <div className={`fever-banner ${due ? 'due' : ''}`} role="timer" aria-live="off">
      <strong>⏱ {due ? s.bannerDue : s.bannerIn(pad2(Math.floor(rem / MIN)), pad2(Math.floor((rem % MIN) / 1000)))}</strong>
      <div className="row">
        <button className="btn small" onClick={() => downloadIcs(reminder.dueAt, lang)}>📅 {s.calendar}</button>
        <button className="btn small ghost" onClick={() => setReminder(null)}>{due ? s.dismiss : s.cancelRem}</button>
      </div>
    </div>
  );
}

function ReminderPrompt({ plan, s, lang, hours, prefs, onAccept, onDecline }) {
  const [changing, setChanging] = useState(false);
  const [set, setSet] = useState(null); // { dueAt } dopo il "Sì"
  const [mins, setMins] = useState(String(plan.minutes));
  const [notif, setNotif] = useState('');
  const m = Math.round(parseVal(mins) ?? 0);
  const accept = async (minutes) => {
    // il permesso delle notifiche si chiede solo qui, al primo "Sì"
    let msg = '';
    if (typeof Notification === 'undefined') msg = s.notifUnsupported;
    else {
      let p = Notification.permission;
      if (p === 'default') { try { p = await Notification.requestPermission(); } catch { p = 'denied'; } }
      msg = p === 'granted' ? s.notifOn : s.notifDenied;
    }
    setNotif(msg);
    const r = { dueAt: Date.now() + minutes * MIN, notified: false };
    setSet({ ...r, minutes });
    onAccept(r);
  };
  if (set) {
    return (
      <div className="fever-prompt">
        <p><strong>⏱ {s.bannerIn(pad2(set.minutes), '00')}</strong></p>
        <p className="small muted">{notif}</p>
        <button className="btn small" onClick={() => downloadIcs(set.dueAt, lang)}>📅 {s.calendar}</button>
        <p className="small fever-disclaimer">{s.remindDisclaimer}</p>
      </div>
    );
  }
  const why = plan.reason === 'doubled' ? s.why.doubled(hours) : typeof s.why[plan.reason] === 'function' ? s.why[plan.reason](plan.minutes, prefs.followHours) : s.why[plan.reason];
  return (
    <div className="fever-prompt">
      <p><strong>{s.remindQ(changing ? (m || plan.minutes) : plan.minutes)}</strong></p>
      <p className="small muted">{why}</p>
      {changing && (
        <label className="field"><span>{s.minutes}</span>
          <input inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} /></label>
      )}
      <div className="fever-prompt-btns">
        <motion.button className="btn primary" onClick={() => accept(changing ? Math.min(720, Math.max(1, m || plan.minutes)) : plan.minutes)} {...tap}>{changing ? s.setMinutes : s.yes}</motion.button>
        <button className="btn" onClick={onDecline}>{s.no}</button>
        {!changing && <button className="btn ghost" onClick={() => setChanging(true)}>{s.change}</button>}
      </div>
      <p className="small fever-disclaimer">{s.remindDisclaimer}</p>
    </div>
  );
}

/* ---------- preferenze ---------- */
function Prefs({ raw, setRaw, s, lang }) {
  const p = normalizePrefs(raw);
  const set = (patch) => setRaw({ ...(raw || {}), ...patch });
  const tiers = (raw?.tiers?.length ? raw.tiers : DEFAULT_PREFS.tiers.map((t) => ({ minutes: t.minutes })));
  return (
    <details className="ga fever-prefs">
      <summary>{s.prefs}</summary>
      <p className="small muted">{s.prefsNote}</p>
      <Block k="e" s={s} className="small" />
      {DEFAULT_PREFS.tiers.map((t, i) => (
        <label key={t.min} className="field"><span>{s.tierLabel(dec(t.min, lang))}</span>
          <input inputMode="numeric" value={tiers[i]?.minutes ?? ''} onChange={(e) => set({ tiers: DEFAULT_PREFS.tiers.map((d, j) => ({ min: d.min, minutes: j === i ? e.target.value : tiers[j]?.minutes ?? d.minutes })) })} /></label>
      ))}
      <p className="small muted">{s.prefsFloor}</p>
      <label className="field"><span>{s.windowLabel}</span>
        <input inputMode="decimal" value={raw?.windowH ?? DEFAULT_PREFS.windowH} onChange={(e) => set({ windowH: e.target.value })} /></label>
      <CheckItem checked={p.withIbuprofen} onChange={(v) => set({ withIbuprofen: v })}>{s.ibuLabel}</CheckItem>
      <label className="field"><span>{s.okLabel}</span>
        <input inputMode="decimal" value={raw?.okBelow ?? DEFAULT_PREFS.okBelow} onChange={(e) => set({ okBelow: e.target.value })} /></label>
      <p className="small muted">{s.followText}</p>
      <label className="field"><span>{s.followMinLabel}</span>
        <input inputMode="numeric" value={raw?.followMin ?? DEFAULT_PREFS.followMin} onChange={(e) => set({ followMin: e.target.value })} /></label>
      <label className="field"><span>{s.longMinLabel}</span>
        <input inputMode="numeric" value={raw?.longMin ?? DEFAULT_PREFS.longMin} onChange={(e) => set({ longMin: e.target.value })} /></label>
      <label className="field"><span>{s.followHLabel}</span>
        <input inputMode="decimal" value={raw?.followHours ?? DEFAULT_PREFS.followHours} onChange={(e) => set({ followHours: e.target.value })} /></label>
      <button className="btn ghost wide" onClick={() => setRaw(null)}>{s.prefsReset}</button>
    </details>
  );
}

/* ---------- scheda ---------- */
export default function Fever({ lang, kid, temps, setTemps, meds, onExport }) {
  const s = FEVER_TEXT[lang];
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null); // { rec, plan } dopo il salvataggio
  const [days, setDays] = useState(3);
  const [reminder, setReminderState] = useState(loadReminder);
  const [rawPrefs, setRawPrefsState] = useState(loadRawPrefs);
  const prefs = useMemo(() => normalizePrefs(rawPrefs), [rawPrefs]);
  const setReminder = (r) => { setReminderState(r); saveReminder(r); };
  const setRawPrefs = (p) => { setRawPrefsState(p); if (p) saveRawPrefs(p); else clearPrefs(); };

  // notifica all'ora prevista, solo se l'utente l'ha consentita e l'app è ancora in memoria
  useEffect(() => {
    if (!reminder || reminder.notified) return undefined;
    const ms = reminder.dueAt - Date.now();
    if (ms <= 0) return undefined;
    const id = setTimeout(() => { showNotification(s.notifBody, s.bannerDue); setReminder({ ...reminder, notified: true }); }, ms);
    return () => clearTimeout(id);
  }, [reminder?.dueAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => temps.filter((t) => t.kidId === kid.id).sort((a, b) => a.at.localeCompare(b.at)), [temps, kid.id]);
  const history = (excludeId) => mine.filter((t) => t.id !== excludeId && (typeof t.value === 'number' || t.feelsHot)).map((t) => ({ at: t.at, value: t.value ?? null, feelsHot: !!t.feelsHot }));
  const kidDoses = useMemo(() => meds.filter((m) => m.kidId === kid.id && (m.active === 'paracetamolo' || m.active === 'ibuprofene')).map((m) => ({ id: m.id, active: m.active, t: new Date(m.at).getTime() })), [meds, kid.id]);
  const readings = mine.filter((t) => typeof t.value === 'number').map((t) => ({ id: t.id, t: new Date(t.at).getTime(), value: t.value }));

  const startForm = () => { setSaved(null); setForm({ at: nowLocal(), value: '', feelsHot: false, site: 'axilla', note: '' }); };
  const v = form ? parseVal(form.value) : null;
  const hasVal = !!form && String(form.value).trim() !== '';
  const ready = form && (hasVal ? validVal(v) : form.feelsHot);
  const atISO = form && form.at && !isNaN(new Date(form.at)) ? new Date(form.at).toISOString() : null;
  const draftWarn = useMemo(() => (ready && atISO ? ageWarnings({ birth: kid.birth, at: atISO, value: hasVal ? v : null, feelsHot: form.feelsHot, history: history(form.id) }) : []), [form, atISO, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!ready || !atISO) return;
    const rec = { id: form.id || uid(), kidId: kid.id, at: atISO, value: hasVal ? v : null, feelsHot: !!form.feelsHot, ...(hasVal ? { site: form.site } : {}), ...(form.note.trim() ? { note: form.note.trim().slice(0, 500) } : {}) };
    setTemps([...temps.filter((t) => t.id !== rec.id), rec]);
    const rs = [...readings.filter((r) => r.id !== rec.id), ...(rec.value != null ? [{ id: rec.id, t: new Date(rec.at).getTime(), value: rec.value }] : [])].map((r) => ({ at: new Date(r.t).toISOString(), value: r.value }));
    const plan = rec.value != null ? reminderPlan({ readings: rs, meds, kidId: kid.id, prefs }) : null;
    setSaved({ rec, plan, warn: ageWarnings({ birth: kid.birth, at: rec.at, value: rec.value, feelsHot: rec.feelsHot, history: history(rec.id) }) });
    setForm(null);
  };

  const night = isNight();
  const nowISO = new Date().toISOString();
  const kidMonths = completedMonths(kid.birth, nowISO);
  const header = checklistHeader(kid.birth, nowISO);
  const dosesShown = kidDoses.some((d) => d.t >= Date.now() - days * 86400000);

  return (
    <div className="fever">
      <details className="ga fever-limits">
        <summary>ℹ️ {s.limits}</summary>
        <div className="med-never"><strong>ℹ️</strong><div>
          <p>{s.legal}</p>
          <p>{s.reminderLimit}</p>
        </div></div>
      </details>
      <Block k="a" s={s} className="lead small" />
      <details className="ga">
        <summary>{s.infoSummary}</summary>
        <Block k="c" s={s} />
        <Block k="f" s={s} />
        <Block k="g" s={s} />
      </details>

      {!saved && <ReadingLists s={s} months={kidMonths} header={header} night={night} />}

      <ReminderBanner reminder={reminder} setReminder={setReminder} s={s} lang={lang} />

      <AnimatePresence initial={false}>
        {form ? (
          <motion.div key="form" className="diary-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <CheckItem checked={form.feelsHot} onChange={(on) => setForm({ ...form, feelsHot: on })}>{s.feelsHot}</CheckItem>
            {form.feelsHot && <p className="small muted">{s.feelsHotNote} <Refs ids={['M1']} /></p>}
            {(
              <div className="field-row">
                <label className="field"><span>{s.value}</span>
                  <input inputMode="decimal" value={form.value} placeholder="37,0" aria-invalid={!!form.value && !validVal(v)} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
                <label className="field"><span>{s.site}</span>
                  <select value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })}>
                    {SITES.map((k) => <option key={k} value={k}>{s.sites[k]}</option>)}
                  </select></label>
              </div>
            )}
            {hasVal && !validVal(v) && <p className="small fever-bad" role="alert">{s.valueBad}</p>}
            <label className="field"><span>{s.date}</span>
              <input type="datetime-local" value={form.at} min={`${kid.birth}T00:00`} max={nowLocal()} onChange={(e) => setForm({ ...form, at: e.target.value })} /></label>
            <Warnings list={draftWarn} s={s} />
            <label className="field"><span>{s.note}</span>
              <textarea rows={2} maxLength={500} value={form.note} placeholder={s.notePh} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            <div className="row">
              <button className="btn ghost" onClick={() => setForm(null)}>{s.cancel}</button>
              <motion.button className="btn primary" onClick={save} disabled={!ready || !atISO} {...tap}>{s.save}</motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.button key="add" className="btn primary wide" onClick={startForm} {...tap}>＋ {s.add}</motion.button>
        )}
      </AnimatePresence>

      {saved && !form && (
        <div className="fever-saved">
          <Warnings list={saved.warn} s={s} />
          <ReadingLists s={s} months={completedMonths(kid.birth, saved.rec.at)} header={checklistHeader(kid.birth, saved.rec.at)} night={night} />
          {saved.plan && <ReminderPrompt key={saved.rec.id} plan={saved.plan} s={s} lang={lang} hours={prefs.windowH} prefs={prefs} onAccept={setReminder} onDecline={() => setSaved({ ...saved, plan: null })} />}
        </div>
      )}

      {mine.length > 0 && (
        <div className="chart-card">
          <h3>{s.chart} <small>(°C)</small></h3>
          <div className="seg small" role="radiogroup" aria-label={s.chart}>
            {RANGES.map((d) => <button key={d} role="radio" aria-checked={days === d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}><span>{s.range(d)}</span></button>)}
          </div>
          <FeverChart readings={readings} doses={kidDoses} days={days} s={s} lang={lang} />
          {kidDoses.length > 0 && <p className="small muted">{s.chartDoses} <Refs ids={['M10']} /></p>}
          {dosesShown && <Block k="d" s={s} className="small muted" />}
        </div>
      )}

      <ul className="diary-list">
        {!mine.length && <li className="empty"><Character name="sun" size={56} /> {s.none}</li>}
        {[...mine].reverse().map((t) => {
          const warn = ageWarnings({ birth: kid.birth, at: t.at, value: t.value, feelsHot: t.feelsHot, history: history(t.id).filter((h) => h.at < t.at) });
          return (
            <motion.li key={t.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="dl-head">
                <strong>{t.value != null ? `${dec(t.value, lang)} °C` : s.hot}</strong>
                <span className="muted small">{when(t.at, lang)}</span>
                <button className="link-btn" onClick={() => { setTemps(temps.filter((x) => x.id !== t.id)); if (saved?.rec.id === t.id) setSaved(null); }} aria-label={s.del}>✕</button>
              </div>
              <div className="dl-vals">
                {t.site && <span className="chip">{s.sites[t.site]}</span>}
                {t.feelsHot && t.value != null && <span className="chip">{s.hot}</span>}
              </div>
              {t.note && <p className="small fever-note">{t.note}</p>}
              <Warnings list={warn} s={s} onlyAlerts />
            </motion.li>
          );
        })}
      </ul>

      <Prefs raw={rawPrefs} setRaw={setRawPrefs} s={s} lang={lang} />
      {mine.length > 0 && <button className="btn ghost wide" onClick={onExport}>⤓ {s.export}</button>}
      <details className="diary-sources">
        <summary>{s.sources} ({FEVER_SOURCES.length})</summary>
        <ol>{FEVER_SOURCES.filter((id) => SOURCES[id]).map((id) => <li key={id}><a href={SOURCES[id].url} target="_blank" rel="noreferrer">{SOURCES[id].label}</a> <small>[{id}]</small></li>)}</ol>
      </details>
    </div>
  );
}
