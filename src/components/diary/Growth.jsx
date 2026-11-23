import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Refs, spring, tap } from '../Common.jsx';
import { Character } from '../Characters.jsx';
import { INDICATORS, INPUTS, bmiOf, GROWTH_SOURCES, assess, assessWfl, wflType, WFL_MAX_MONTHS, estimateHeight, dropWeightHigh, GROWTH_RULES, isCorrected, curve, monthsAt, growthAge, zScore, newbornCheck } from '../../lib/growth.js';
import { LOCALE } from '../../lib/i18n.js';
import { formatAge } from '../../lib/age.js';
import { uid } from '../../lib/util.js';
import { DIARY_TEXT } from './text.js';
import { today, fmt, hVal, GROWTH_REFS } from './utils.js';
import { SourceList } from './SourceList.jsx';
import { GrowthChart } from './GrowthChart.jsx';

function WarnBox({ warnings, s }) {
  if (!warnings.length) return null;
  return (
    <div className="growth-warn" role="alert">
      <strong>⚠️</strong>
      <div>
        {warnings.map((w, i) => <p key={i}>{typeof s.w[w.kind] === 'function' ? s.w[w.kind](w) : s.w[w.kind]} <Refs ids={GROWTH_REFS[w.kind]} /></p>)}
        <p className="small">{s.wFoot}</p>
      </div>
    </div>
  );
}

/* ---------- Crescita ---------- */
export function Growth({ lang, kid, growth, setGrowth }) {
  const s = DIARY_TEXT[lang];
  const [ind, setInd] = useState('weight');
  const [form, setForm] = useState(null);
  const sex = kid.sex;
  const ageNow = growthAge(kid, today());
  const mine = growth.filter((g) => g.kidId === kid.id).sort((a, b) => a.date.localeCompare(b.date));

  // peso alla nascita: misura registrata nei primi 3 giorni
  const birth = mine.find((g) => g.weight > 0 && monthsAt(kid.birth, g.date) * 30.4375 <= 3);
  const birthZ = birth ? zScore('weight', sex, growthAge(kid, birth.date), +birth.weight) : null;
  const withEval = useMemo(() => {
    const last = {};
    const heights = mine.filter((g) => g.height > 0).map((g) => ({ t: monthsAt(kid.birth, g.date), m: growthAge(kid, g.date), date: g.date, id: g.id }))
      .filter((q) => q.m >= 0 && q.m <= INDICATORS.height.maxMonths)
      .map((q) => ({ ...q, v: hVal(mine.find((g) => g.id === q.id), q.m) }));
    return mine.map((g) => {
      const m = growthAge(kid, g.date);
      const corr = isCorrected(kid, g.date);
      const ev = {};
      if (m < 0) return { ...g, m, ev, beforeTerm: true }; // prima del termine corretto le curve OMS non valgono (W13)
      for (const k of INPUTS) {
        if (!(g[k] > 0) || m > INDICATORS[k].maxMonths) continue;
        const v = k === 'height' ? hVal(g, m) : +g[k];
        ev[k] = assess(k, sex, m, v, last[k], { birthZ, corr });
        if (k === 'height' && g.heightPos === 'standing' && m < 9) ev[k].warnings.unshift({ kind: 'standingEarly', level: 'check' });
        if (k === 'weight' && birth && g.id !== birth.id) {
          const nb = newbornCheck(+birth.weight, monthsAt(kid.birth, g.date) * 30.4375, +g.weight);
          if (nb) ev[k].warnings.push(nb);
        }
        (last[k] = last[k] || []).push({ months: m, value: v, corr });
      }
      if (g.weight > 0 && g.height > 0 && m >= INDICATORS.bmi.minMonths && m <= INDICATORS.bmi.maxMonths) {
        const b = bmiOf(+g.weight, hVal(g, m));
        ev.bmi = { ...assess('bmi', sex, m, b), value: b };
      }
      if (g.weight > 0 && g.height > 0 && m <= WFL_MAX_MONTHS) {
        const w = assessWfl(sex, m, hVal(g, m), +g.weight);
        if (w.z != null) {
          ev.wfl = { ...w, value: +g.weight, cm: hVal(g, m), type: wflType(m) };
        }
      } else if (g.weight > 0 && !(g.height > 0) && m >= INDICATORS.bmi.minMonths && m <= INDICATORS.bmi.maxMonths) {
        // BMI stimato da misure non simultanee: solo posizione (W16)
        const est = estimateHeight(sex, heights, { t: monthsAt(kid.birth, g.date), m });
        if (est) {
          const b = bmiOf(+g.weight, est.h);
          const a = assess('bmi', sex, m, b);
          if (a.z != null) ev.bmi = { z: a.z, p: a.p, value: b, estimated: true, dates: est.dates, warnings: Math.abs(a.z) > 2 ? [{ kind: 'bmiEstimatedOut', level: 'info' }] : [] };
        }
      }
      if (ev.weight) ev.weight.warnings = dropWeightHigh(ev.weight.warnings, ev, m);
      return { ...g, m, ev };
    });
  }, [mine.map((g) => g.id + g.date + g.weight + g.height + g.head + g.heightPos).join(), sex, kid.gaWeeks]); // eslint-disable-line

  const pts = withEval.filter((g) => g.ev[ind]).map((g) => ({ id: g.id, m: g.m, v: ind === 'height' ? hVal(g, g.m) : ind === 'bmi' ? g.ev.bmi.value : +g[ind], est: ind === 'bmi' && !!g.ev.bmi.estimated, warn: g.ev[ind].warnings.some((w) => w.level !== 'info') }));
  const showHead = ageNow <= INDICATORS.head.maxMonths || mine.some((g) => g.head);

  // Avvisi del modulo mentre si scrive
  const draftWarnings = useMemo(() => {
    if (!form) return [];
    const m = growthAge(kid, form.date || today());
    const corr = isCorrected(kid, form.date || today());
    const out = [];
    if (m < 0) return out;
    for (const k of INPUTS) {
      let v = parseFloat(String(form[k] || '').replace(',', '.'));
      if (!(v > 0) || m > INDICATORS[k].maxMonths) continue;
      if (k === 'height') {
        v = hVal({ height: v, heightPos: form.heightPos }, m);
        if (form.heightPos === 'standing' && m < 9) out.push({ kind: 'standingEarly', level: 'check' });
      }
      const prev = withEval.filter((g) => g.ev[k] && g.date < form.date && g.id !== form.id).map((g) => ({ months: g.m, value: k === 'height' ? hVal(g, g.m) : +g[k], corr: isCorrected(kid, g.date) }));
      out.push(...assess(k, sex, m, v, prev, { birthZ, corr }).warnings.map((w) => ({ ...w, k })));
      if (k === 'weight' && birth && birth.date < form.date) {
        const nb = newbornCheck(+birth.weight, monthsAt(kid.birth, form.date) * 30.4375, v);
        if (nb) out.push(nb);
      }
    }
    const fw = parseFloat(String(form.weight || '').replace(',', '.')), fh = parseFloat(String(form.height || '').replace(',', '.'));
    if (fw > 0 && fh > 0 && m <= WFL_MAX_MONTHS) {
      const w = assessWfl(sex, m, hVal({ height: fh, heightPos: form.heightPos }, m), fw);
      if (w.z != null) return [...dropWeightHigh(out, { wfl: w }, m), ...w.warnings];
    }
    if (fw > 0 && fh > 0 && m >= GROWTH_RULES.bmiFromMonths) return dropWeightHigh(out, { bmi: {} }, m);
    return out;
  }, [form, sex]); // eslint-disable-line

  const saveForm = () => {
    const rec = { id: form.id || uid(), kidId: kid.id, date: form.date || today() };
    if (form.height) rec.heightPos = form.heightPos || (monthsAt(kid.birth, rec.date) < 24 ? 'lying' : 'standing');
    for (const k of INPUTS) {
      const v = parseFloat(String(form[k] || '').replace(',', '.'));
      if (v > 0) rec[k] = v;
    }
    if (!rec.weight && !rec.height && !rec.head) return;
    setGrowth([...growth.filter((g) => g.id !== rec.id), rec]);
    setForm(null);
  };

  const label = { weight: s.weight, height: s.height, head: s.head, bmi: s.bmi };
  const showBmi = ageNow >= INDICATORS.bmi.minMonths || mine.some((g) => g.ev?.bmi);
  return (
    <div>
      <div className="seg" role="tablist">
        {['weight', 'height', ...(showBmi ? ['bmi'] : []), ...(showHead ? ['head'] : [])].map((k) => (
          <button key={k} className={ind === k ? 'on' : ''} onClick={() => setInd(k)} role="tab" aria-selected={ind === k}>
            {ind === k && <motion.i layoutId="seg-pill" className="seg-pill" transition={spring} />}<span>{label[k]}</span>
          </button>
        ))}
      </div>
      <motion.div className="chart-card" key={ind} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h3>{ind === 'height' ? s.heightLong(ageNow) : ind === 'head' ? s.headLong : ind === 'bmi' ? s.bmi : s.weight} <small>({INDICATORS[ind].unit})</small></h3>
        <GrowthChart indicator={ind} sex={sex} points={pts} upTo={Math.min(ageNow, INDICATORS[ind].maxMonths)} lang={lang} />
        {ind === 'weight' && ageNow <= WFL_MAX_MONTHS && <p className="small muted">{s.wflHint} <Refs ids={['W4', 'W15']} /></p>}
        {ind === 'bmi' && pts.some((p) => p.est) && <p className="small muted">{s.bmiEstLegend} <Refs ids={['W16']} /></p>}
        <p className="small muted">{s.chartNote} {ind === 'weight' && ageNow < 61 && <>{s.noWfl} <Refs ids={['W4', 'W15']} /></>} {ind === 'bmi' && s.bmiNote} <Refs ids={['W1', 'W2', ...(ind === 'head' ? ['W8'] : []), ...(ind === 'bmi' ? ['X4', 'W16'] : [])]} />{ageNow > INDICATORS[ind].maxMonths ? <> {ind === 'weight' ? s.over10 : s.over(INDICATORS[ind].maxMonths)}{ind === 'weight' && <> <Refs ids={['X5']} /></>}</> : ''}</p>
        {kid.gaWeeks && kid.gaWeeks < 37 && monthsAt(kid.birth, today()) < (kid.gaWeeks < 32 ? 24 : 12) && <p className="small muted">{s.pretermNote(kid.gaWeeks)} <Refs ids={['W13']} /></p>}
      </motion.div>

      <AnimatePresence>
        {form ? (
          <motion.div className="diary-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <label className="field"><span>{s.date}</span>
              <input type="date" min={kid.birth} max={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <div className="field-row">
              {INPUTS.filter((k) => k !== 'head' || growthAge(kid, form.date) <= INDICATORS.head.maxMonths).map((k) => (
                <label key={k} className="field"><span>{label[k]} ({INDICATORS[k].unit})</span>
                  <input inputMode="decimal" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder="0,0" /></label>
              ))}
            </div>
            {form.height && (
              <div className="seg small" role="radiogroup" aria-label={s.pos}>
                {['lying', 'standing'].map((p) => (
                  <button key={p} className={(form.heightPos || (monthsAt(kid.birth, form.date) < 24 ? 'lying' : 'standing')) === p ? 'on' : ''}
                    onClick={() => setForm({ ...form, heightPos: p })}><span>{s[p]}</span></button>
                ))}
              </div>
            )}
            {growthAge(kid, form.date || today()) < 0 && <p className="small muted">{s.beforeTerm} <Refs ids={['W13']} /></p>}
            <WarnBox warnings={draftWarnings} s={s} />
            <p className="small muted">{s.measureTips} <Refs ids={['W4']} /></p>
            <div className="row">
              <button className="btn ghost" onClick={() => setForm(null)}>{s.cancel}</button>
              <motion.button className="btn primary" onClick={saveForm} {...tap}>{s.save}</motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.button className="btn primary wide" onClick={() => setForm({ date: today() })} {...tap}>＋ {s.add}</motion.button>
        )}
      </AnimatePresence>

      <ul className="diary-list">
        {!withEval.length && <li className="empty"><Character name="bear" size={56} /> {s.none}</li>}
        {[...withEval].reverse().map((g) => {
          const warns = Object.values(g.ev).flatMap((e) => e.warnings);
          return (
            <motion.li key={g.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="dl-head">
                <strong>{new Date(g.date).toLocaleDateString(LOCALE[lang])}</strong>
                <span className="muted small">{formatAge(kid.birth, lang, new Date(g.date))}</span>
                <button className="link-btn" onClick={() => setForm({ ...g, weight: g.weight ?? '', height: g.height ?? '', head: g.head ?? '' })}>✎</button>
                <button className="link-btn" onClick={() => setGrowth(growth.filter((x) => x.id !== g.id))} aria-label={s.del}>✕</button>
              </div>
              <div className="dl-vals">
                {INPUTS.filter((k) => g[k]).map((k) => (
                  <span key={k} className={`chip ${g.ev[k]?.warnings.some((w) => w.level !== 'info') ? 'chip-warn' : ''}`}>
                    {label[k]} {fmt(g[k], 2)} {INDICATORS[k].unit}{g.ev[k] ? ` · ${s.pct(g.ev[k].p)}` : ''}
                  </span>
                ))}
              </div>
              {g.ev.bmi?.estimated && <p className="small muted">{s.bmiEstText(new Date(g.date).toLocaleDateString(LOCALE[lang]), new Date(g.ev.bmi.dates[0]).toLocaleDateString(LOCALE[lang]), g.ev.bmi.dates[1] && new Date(g.ev.bmi.dates[1]).toLocaleDateString(LOCALE[lang]))} <Refs ids={['W16']} /></p>}
              {g.beforeTerm && <p className="small muted">{s.beforeTerm} <Refs ids={['W13']} /></p>}
              <WarnBox warnings={warns} s={s} />
            </motion.li>
          );
        })}
      </ul>
      <SourceList ids={GROWTH_SOURCES} lang={lang} />
    </div>
  );
}

