import { useState } from 'react';
import { Refs } from '../Common.jsx';
import { findPlan, medKey, planKey, vitDDayTotal, vitDLimit } from '../../lib/meds.js';
import { LOCALE } from '../../lib/i18n.js';
import { uid } from '../../lib/util.js';

export const PLAN_UNITS = ['mg', 'ml', 'gocce', 'UI', 'compresse', 'bustine', 'supposte', 'spruzzi', 'other'];

export function MyMeds({ s, lang, kid, months, mine, medPlans, setMedPlans, giveDose, again }) {
  const [pf, setPf] = useState(null);
  const plans = medPlans.filter((p) => p.kidId === kid.id);
  const nowMs = Date.now();
  const groups = new Map();
  for (const e of [...mine].sort((a, b) => b.at.localeCompare(a.at))) {
    const k = medKey(e);
    if (!groups.has(k)) groups.set(k, { key: k, name: e.active ? s.names[e.active] || e.name : e.name, active: e.active || null, last: e, n24: 0, sample: e });
    if (nowMs - new Date(e.at).getTime() < 86400000 && new Date(e.at).getTime() <= nowMs) groups.get(k).n24++;
  }
  for (const g of groups.values()) g.plan = findPlan(plans, g.sample);
  for (const p of plans) {
    if ([...groups.values()].some((g) => g.plan === p)) continue;
    groups.set(planKey(p), { key: planKey(p), name: p.active ? s.names[p.active] || p.name : p.name, active: p.active || null, last: null, n24: 0, plan: p });
  }
  const list = [...groups.values()];
  const startPlan = (g) => {
    const p = g.plan;
    setPf({ id: p?.id, name: g.name, active: g.active || null, intervalH: p?.intervalH ?? '', maxPerDay: p?.maxPerDay ?? '', amount: p?.dose?.amount ?? '', unit: p?.dose?.unit || 'mg', until: p?.until || '', note: p?.note || '', fixedName: !!g.name });
  };
  const savePlan = () => {
    const name = pf.name.trim();
    if (!name) return;
    const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return n > 0 ? n : undefined; };
    const rec = { id: pf.id || uid(), kidId: kid.id, name, ...(pf.active ? { active: pf.active } : {}) };
    const iv = num(pf.intervalH), mx = num(pf.maxPerDay), am = num(pf.amount);
    if (iv) rec.intervalH = iv;
    if (mx) rec.maxPerDay = Math.floor(mx);
    if (am) rec.dose = { amount: am, unit: pf.unit };
    if (pf.until) rec.until = pf.until;
    if (pf.note.trim()) rec.note = pf.note.trim();
    setMedPlans([...medPlans.filter((p) => p.id !== rec.id), rec]);
    setPf(null);
  };
  return (
    <details className="ga my-meds">
      <summary>{s.myMeds}{list.length ? ` (${list.length})` : ''}</summary>
      <ul className="diary-list">
        {!list.length && <li className="empty">{s.myMedsEmpty}</li>}
        {list.map((g) => (
          <li key={g.key}>
            <div className="dl-head"><strong>{g.name}</strong></div>
            <div className="dl-vals">
              <span className="chip">{s.lastGiven}: {g.last ? new Date(g.last.at).toLocaleString(LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' }) : s.never}</span>
              {g.n24 > 0 && <span className="chip">{s.in24(g.n24)}</span>}
              {g.plan && <span className="chip">{s.yourPlan}: {s.planSummary(g.plan, s) || '—'}</span>}
              {g.plan?.note && <span className="chip muted">{g.plan.note}</span>}
            </div>
            {g.active === 'vitaminaD' && (() => {
              const day = vitDDayTotal(mine, kid.id, new Date().toISOString());
              const ul = months != null ? vitDLimit(months) : null;
              const rec = months != null && s.c.vitDRec({ period: months < 12 ? 'infant' : 'child' });
              return (
                <div className="small muted">
                  <p>{s.vitDToday(day.iu, ul?.iu)}{day.missing ? ` (${s.vitDPartial})` : ''} <Refs ids={ul?.src} /></p>
                  {rec && <p>{rec} <Refs ids={months < 12 ? ['V4', 'V5', 'V6'] : ['V3', 'V4', 'V5', 'V6']} /></p>}
                </div>
              );
            })()}
            <div className="row">
              <button className="btn small" onClick={() => startPlan(g)}>{g.plan ? s.editPlan : s.setPlan}</button>
              <button className="btn small" onClick={() => giveDose(g)}>{s.giveDose}</button>
              {g.plan && <button className="btn small ghost" onClick={() => setMedPlans(medPlans.filter((p) => p.id !== g.plan.id))}>{s.delPlan}</button>}
            </div>
          </li>
        ))}
      </ul>
      {pf ? (
        <div className="diary-form">
          <p className="small muted">{s.planCopy}</p>
          <label className="field"><span>{s.planName}</span>
            <input value={pf.name} maxLength={60} readOnly={pf.fixedName} onChange={(e) => setPf({ ...pf, name: e.target.value })} /></label>
          <div className="field-row">
            <label className="field"><span>{s.planEvery}</span>
              <input inputMode="decimal" value={pf.intervalH} onChange={(e) => setPf({ ...pf, intervalH: e.target.value })} /></label>
            <label className="field"><span>{s.planMax}</span>
              <input inputMode="numeric" value={pf.maxPerDay} onChange={(e) => setPf({ ...pf, maxPerDay: e.target.value })} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>{s.planDose}</span>
              <input inputMode="decimal" value={pf.amount} onChange={(e) => setPf({ ...pf, amount: e.target.value })} /></label>
            <label className="field narrow"><span>{s.unit}</span>
              <select value={pf.unit} onChange={(e) => setPf({ ...pf, unit: e.target.value })}>
                {PLAN_UNITS.map((u) => <option key={u} value={u}>{s.units[u]}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{s.planUntil}</span>
            <input type="date" value={pf.until} onChange={(e) => setPf({ ...pf, until: e.target.value })} /></label>
          <label className="field"><span>{s.planNote}</span>
            <input value={pf.note} maxLength={120} onChange={(e) => setPf({ ...pf, note: e.target.value })} /></label>
          <div className="row">
            <button className="btn ghost" onClick={() => setPf(null)}>{s.cancel}</button>
            <button className="btn primary" onClick={savePlan} disabled={!pf.name.trim()}>{s.save}</button>
          </div>
        </div>
      ) : <button className="btn ghost wide" onClick={() => setPf({ name: '', active: null, intervalH: '', maxPerDay: '', amount: '', unit: 'mg', until: '', note: '', fixedName: false })}>{s.addPlanMed}</button>}
    </details>
  );
}

