import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Refs, tap } from '../Common.jsx';
import { Character } from '../Characters.jsx';
import { monthsAt } from '../../lib/growth.js';
import { ACTIVE, MED_SOURCES, checkDose, checkPlan, filterLog, findPlan, latestWeight, medKey, normName, toMg } from '../../lib/meds.js';
import { LOCALE } from '../../lib/i18n.js';
import { uid, nowLocal, localDate } from '../../lib/util.js';
import { DIARY_TEXT } from './text.js';
import { fmt, COLORS } from './utils.js';
import { SourceList } from './SourceList.jsx';
import { MyMeds } from './MyMeds.jsx';
import { downloadCsv } from './downloadCsv.js';

function CheckList({ results, s, active }) {
  const level = results.some((r) => r.level === 'stop') ? 'stop' : results.some((r) => r.level === 'warn') ? 'warn' : 'ok';
  const msgs = results.filter((r) => r.kind !== 'ok' && !r.kind.startsWith('plan'));
  const plan = results.filter((r) => r.kind.startsWith('plan'));
  const text = (r) => { const m = s.c[r.kind]; return typeof m === 'function' ? m(r, s) : m; };
  return (
    <div className={`dose-check ${level}`} role={level !== 'ok' ? 'alert' : undefined}>
      <strong>{s.check}</strong>
      <ul>
        {msgs.map((r, i) => (
          <li key={i} className={r.level}>{text(r)} <Refs ids={r.refs ?? ACTIVE[active]?.refs?.[r.kind] ?? (r.level !== 'info' ? ACTIVE[active]?.src : null)} /></li>
        ))}
        {level === 'ok' && !msgs.some((r) => r.kind === 'noCheck') && !plan.length && <li>{s.c.ok}</li>}
      </ul>
      {plan.length > 0 && (
        <>
          <strong>{s.yourPlan}</strong>
          <ul>{plan.map((r, i) => <li key={i} className={r.level}>{text(r)}</li>)}</ul>
        </>
      )}
    </div>
  );
}

export function Meds({ lang, kid, months, meds, setMeds, growth, medPlans, setMedPlans, temps }) {
  const s = DIARY_TEXT[lang];
  const [form, setForm] = useState(null);
  const [fMed, setFMed] = useState('');
  const [fDays, setFDays] = useState(30);
  const formRef = React.useRef(null);
  const openForm = (f) => {
    setForm(f);
    setTimeout(() => formRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 60);
  };

  const entryFrom = (f) => {
    const a = ACTIVE[f.active];
    const conc = f.unit === 'ml' && !(a?.kind === 'daily') ? (f.conc === 'other' ? parseFloat(String(f.concOther).replace(',', '.')) : +f.conc) : null;
    const concIU = a?.kind === 'daily' && (f.unit === 'gocce' || f.unit === 'ml') ? parseFloat(String(f.concIU || '').replace(',', '.')) || null : null;
    return {
      id: f.id || 'draft', kidId: kid.id, at: new Date(f.at).toISOString(), active: a ? f.active : null,
      name: a ? s.names[f.active] : (f.name || '').trim(), route: a ? f.route || 'oral' : null,
      amount: parseFloat(String(f.amount || '').replace(',', '.')) || null, unit: f.unit, conc: a?.kind === 'daily' ? null : conc, ...(a?.kind === 'daily' ? { concIU } : {}), flags: f.flags || [], note: f.note || ''
    };
  };
  const draft = form && entryFrom(form);
  const results = useMemo(() => {
    if (!draft || (!draft.active && !draft.name)) return [];
    const weight = latestWeight(growth, kid.id, draft.at);
    const r = [...checkDose(draft, meds, { months: monthsAt(kid.birth, draft.at), weight }), ...checkPlan(draft, meds, findPlan(medPlans, draft))];
    for (const c of ACTIVE[draft.active]?.cautions || []) if (draft.flags.includes(c)) r.push({ kind: 'caution', level: 'warn', flag: c });
    return r;
  }, [JSON.stringify(draft), meds, growth, medPlans]); // eslint-disable-line

  const save = () => {
    if (!draft.active && !draft.name) return;
    // stesso farmaco già registrato con altre maiuscole/spazi: usa la grafia esistente
    const known = !draft.active && mine.find((m) => !m.active && normName(m.name) === normName(draft.name));
    const e = { ...draft, ...(known ? { name: known.name } : {}), id: form.id || uid() };
    setMeds([...meds.filter((m) => m.id !== e.id), e]);
    setForm(null);
  };

  const mine = meds.filter((m) => m.kidId === kid.id);
  const names = [...new Map([...mine.filter((m) => !m.active).map((m) => m.name), ...medPlans.filter((p) => p.kidId === kid.id && !p.active).map((p) => p.name)].map((n) => [normName(n), n])).values()];
  const keys = [...new Set(mine.map(medKey))];
  const label = (k) => s.names[k] || mine.find((m) => medKey(m) === k)?.name || k;
  const color = (k) => COLORS[keys.indexOf(k) % COLORS.length];
  const shown = filterLog(mine, { kidId: kid.id, med: fMed, days: fDays });

  // Grafico: dosi al giorno (ultimi N giorni, max 30 barre)
  const nDays = Math.min(fDays || 30, 30);
  const daysArr = Array.from({ length: nDays }, (_, i) => localDate(new Date(Date.now() - (nDays - 1 - i) * 86400000)));
  const perDay = daysArr.map((d) => {
    const items = shown.filter((e) => localDate(new Date(e.at)) === d);
    const by = {};
    items.forEach((e) => { by[medKey(e)] = (by[medKey(e)] || 0) + 1; });
    return { d, by, n: items.length };
  });
  const maxN = Math.max(3, ...perDay.map((p) => p.n));

  const exportCsv = () => downloadCsv({ kid, lang, meds, growth, temps });

  const a = form && ACTIVE[form.active];
  const giveDose = (g) => {
    const d = g.plan?.dose;
    const act = g.active && ACTIVE[g.active] ? g.active : '';
    const daily = ACTIVE[act]?.kind === 'daily';
    const unit = d?.unit && (!act || (daily ? ['gocce', 'ml', 'UI', 'µg'] : ['mg', 'ml']).includes(d.unit)) ? d.unit : act ? (daily ? 'gocce' : 'ml') : d?.unit || 'other';
    openForm({ active: act, name: act ? '' : g.name, route: 'oral', unit, amount: d?.amount ? String(d.amount) : '', conc: '', at: nowLocal(), flags: [] });
  };
  // "Di nuovo": stessa medicina, quantità, unità, concentrazione e via; ora = adesso
  const again = (e) => {
    const A = ACTIVE[e.active];
    const known = A?.conc && e.conc && A.conc.includes(e.conc);
    openForm({
      active: A ? e.active : '', name: A ? '' : e.name, route: e.route || 'oral', unit: e.unit || 'other', amount: e.amount ? String(e.amount) : '',
      concIU: e.concIU ? String(e.concIU) : '', conc: e.unit === 'ml' && A?.conc && e.conc ? (known ? e.conc : 'other') : '', concOther: e.unit === 'ml' && A?.conc && e.conc && !known ? String(e.conc) : '',
      at: nowLocal(), flags: [], note: ''
    });
  };
  return (
    <div>
      <p className="lead small">{s.medsIntro}</p>
      <div className="med-never"><strong>ℹ️</strong><div><p>{s.medsNever}</p>
        <ul className="med-rules">{s.medsRules.map((r, i) => <li key={i}>{r} <Refs ids={[['M5', 'M6'], ['M2', 'M5'], ['M1', 'M8'], ['M5']][i]} /></li>)}</ul></div></div>

      <AnimatePresence>
        {form ? (
          <motion.div className="diary-form" ref={formRef} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <label className="field"><span>{s.med}</span>
              <select value={form.active} onChange={(e) => setForm({ ...form, active: e.target.value, route: 'oral', flags: [], conc: '', concIU: '', unit: ACTIVE[e.target.value]?.kind === 'daily' ? 'gocce' : form.unit === 'gocce' ? 'ml' : form.unit })}>
                {Object.keys(ACTIVE).map((k) => <option key={k} value={k}>{s.names[k]}</option>)}
                <option value="">{s.other}</option>
              </select></label>
            {!a && <label className="field"><span>{s.otherName}</span>
              <input value={form.name || ''} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} list="med-names" />
              <datalist id="med-names">{names.map((n) => <option key={n} value={n} />)}</datalist></label>}
            {a?.routes && Object.keys(a.routes).length > 1 && (
              <div className="seg small">
                {Object.keys(a.routes).map((r) => <button key={r} className={form.route === r ? 'on' : ''} onClick={() => setForm({ ...form, route: r, unit: r === 'rectal' ? 'mg' : form.unit })}><span>{s[r]}</span></button>)}
              </div>
            )}
            <div className="field-row">
              <label className="field"><span>{s.amount}</span>
                <input inputMode="decimal" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
              <label className="field narrow"><span>{s.unit}</span>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {a?.kind === 'daily' ? ['gocce', 'ml', 'UI', 'µg'].map((u) => <option key={u} value={u}>{s.units[u]}</option>) : <><option value="mg">mg</option>{form.route !== 'rectal' && <option value="ml">ml</option>}</>}
                  {!a && ['gocce', 'UI', 'compresse', 'bustine', 'supposte', 'spruzzi', 'other'].map((u) => <option key={u} value={u}>{s.units[u]}</option>)}
                </select></label>
            </div>
            {a?.kind === 'daily' && (form.unit === 'gocce' || form.unit === 'ml') && (
              <label className="field"><span>{s.concIU[form.unit]}</span>
                <input inputMode="decimal" value={form.concIU || ''} onChange={(e) => setForm({ ...form, concIU: e.target.value })} /></label>
            )}
            {form.unit === 'ml' && a?.conc && (
              <label className="field"><span>{s.conc}</span>
                <div className="chips">
                  {[...a.conc, 'other'].map((c) => (
                    <button key={c} className={`chip ${String(form.conc) === String(c) ? 'on' : ''}`} onClick={() => setForm({ ...form, conc: c })}>
                      {c === 'other' ? s.concOther : `${c} mg/ml`}</button>
                  ))}
                  {form.conc === 'other' && <input className="mini-input" inputMode="decimal" value={form.concOther || ''} placeholder="mg/ml" onChange={(e) => setForm({ ...form, concOther: e.target.value })} />}
                </div></label>
            )}
            <label className="field"><span>{s.when}</span>
              <input type="datetime-local" value={form.at} max={nowLocal()} onChange={(e) => setForm({ ...form, at: e.target.value })} /></label>
            {a && (
              <fieldset className="flags"><legend>{s.flags}</legend>
                {[...(a.contra || []), ...(a.cautions || [])].map((f) => (
                  <label key={f} className="check"><input type="checkbox" checked={form.flags?.includes(f) || false}
                    onChange={(e) => setForm({ ...form, flags: e.target.checked ? [...(form.flags || []), f] : form.flags.filter((x) => x !== f) })} /><span className="box">{form.flags?.includes(f) ? '✓' : ''}</span> {s.flag[f]}</label>
                ))}
              </fieldset>
            )}
            <label className="field"><span>{s.note}</span>
              <input value={form.note || ''} maxLength={120} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            {results.length > 0 && <CheckList results={results} s={s} active={draft.active} />}
            <div className="row">
              <button className="btn ghost" onClick={() => setForm(null)}>{s.cancel}</button>
              <motion.button className="btn primary" onClick={save} disabled={!draft.active && !draft.name} {...tap}>
                {results.some((r) => r.level !== 'info') ? s.saveAnyway : s.save}</motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.button className="btn primary wide" {...tap}
            onClick={() => openForm({ active: Object.keys(ACTIVE)[0], route: 'oral', unit: 'ml', conc: '', at: nowLocal(), flags: [] })}>＋ {s.addMed}</motion.button>
        )}
      </AnimatePresence>

      <MyMeds s={s} lang={lang} kid={kid} months={months} mine={mine} medPlans={medPlans} setMedPlans={setMedPlans} giveDose={giveDose} again={again} />

      {mine.length > 0 && (
        <>
          <div className="filters">
            <select value={fMed} onChange={(e) => setFMed(e.target.value)} aria-label={s.med}>
              <option value="">{s.allMeds}</option>
              {keys.map((k) => <option key={k} value={k}>{label(k)}</option>)}
            </select>
            <div className="seg small">
              {[7, 30, 90, 0].map((d) => <button key={d} className={fDays === d ? 'on' : ''} onClick={() => setFDays(d)}><span>{s.days(d)}</span></button>)}
            </div>
          </div>
          <div className="chart-card">
            <h3>{s.perDay}</h3>
            <svg className="bar-chart" viewBox="0 0 340 120" role="img" aria-label={s.perDay}>
              {perDay.map((p, i) => {
                const bw = 320 / nDays;
                let y0 = 100;
                return (
                  <g key={p.d}>
                    {Object.entries(p.by).map(([k, n]) => {
                      const h = (n / maxN) * 90; y0 -= h;
                      return <motion.rect key={k} x={14 + i * bw + 1} width={Math.max(2, bw - 2)} y={y0} height={h} rx={2} fill={color(k)}
                        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ transformOrigin: `0 100px` }} transition={{ delay: i * 0.01 }} />;
                    })}
                    {(i === 0 || i === nDays - 1 || (i % 7 === 0 && nDays - 1 - i >= 4)) && <text x={14 + i * bw + bw / 2} y={114} className="axis" textAnchor="middle">{lang === 'en' ? `${p.d.slice(5, 7)}/${p.d.slice(8, 10)}` : `${p.d.slice(8, 10)}/${p.d.slice(5, 7)}`}</text>}
                  </g>
                );
              })}
              <line x1="14" x2="334" y1="100" y2="100" className="base" />
              <text x="10" y={100 - 90 + 4} className="axis" textAnchor="end">{maxN}</text>
            </svg>
            <div className="legend">{keys.map((k) => <span key={k}><i style={{ background: color(k) }} />{label(k)}</span>)}</div>
          </div>
        </>
      )}

      <ul className="diary-list">
        {!shown.length && <li className="empty"><Character name="drop" size={56} /> {s.noMeds}</li>}
        {shown.map((e) => {
          const w = latestWeight(growth, kid.id, e.at);
          const mg = toMg(e);
          const r = [...checkDose(e, meds, { months: monthsAt(kid.birth, e.at), weight: w }), ...checkPlan(e, meds, findPlan(medPlans, e))].filter((x) => x.level !== 'info');
          return (
            <motion.li key={e.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="dl-head">
                <i className="dot" style={{ background: color(medKey(e)) }} />
                <strong>{e.name}</strong>
                <span className="muted small">{new Date(e.at).toLocaleString(LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' })}</span>
                <button className="link-btn" onClick={() => setMeds(meds.filter((x) => x.id !== e.id))} aria-label={s.del}>✕</button>
              </div>
              <div className="dl-vals">
                {e.amount && <span className="chip">{fmt(e.amount, 2)} {e.unit === 'other' ? '' : s.units[e.unit] ?? e.unit}{e.conc ? ` (${e.conc} mg/ml)` : ''}{e.concIU ? ` (${e.concIU} ${s.iuPer[e.unit] || ''})` : ''}{e.route === 'rectal' ? ` · ${s.rectal}` : ''}</span>}
                {mg && e.unit === 'ml' && <span className="chip">{fmt(mg)} mg</span>}
                {mg && w && e.active && <span className="chip">{s.perKg(mg / w.kg, w)}</span>}
                {e.note && <span className="chip muted">{e.note}</span>}
                <button className="chip" onClick={() => again(e)}>{s.again}</button>
              </div>
              {r.length > 0 && <CheckList results={r} s={s} active={e.active} />}
            </motion.li>
          );
        })}
      </ul>
      {mine.length > 0 && <button className="btn ghost wide" onClick={exportCsv}>⤓ {s.export}</button>}
      <SourceList ids={MED_SOURCES} lang={lang} />
    </div>
  );
}

