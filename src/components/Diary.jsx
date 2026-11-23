import React, { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { KidPills, spring, tap } from './Common.jsx';
import { monthsAt } from '../lib/growth.js';
import { MILESTONE_TEXT } from '../lib/i18n.js';
import Milestones from './Milestones.jsx';
import Fever from './Fever.jsx';
import { FEVER_TEXT } from '../lib/feverText.js';
import { DIARY_TEXT } from './diary/text.js';
import { today } from './diary/utils.js';
import { Growth } from './diary/Growth.jsx';
import { Meds } from './diary/Meds.jsx';
import { downloadCsv } from './diary/downloadCsv.js';

export { DIARY_TEXT };

const ImportCsv = lazy(() => import('./ImportCsv.jsx'));
const IMPORT_BTN = { it: 'Importa da un\'altra app (CSV)', ru: 'Импорт из другого приложения (CSV)', en: 'Import from another app (CSV)' };

/* ---------- Pagina Diario ---------- */
export default function Diary({ lang, kids, active, setActive, growth, meds, setGrowth, setMeds, setKid, medPlans = [], setMedPlans, milestones = [], setMilestones, temps = [], setTemps }) {
  const s = DIARY_TEXT[lang];
  const [tab, setTab] = useState('growth');
  const [importing, setImporting] = useState(false);
  const kid = kids[Math.max(0, active)];
  const months = kid ? Math.floor(monthsAt(kid.birth, today())) : null;
  return (
    <div className="diary">
      <h1>{s.title}</h1>
      <p className="lead">{s.sub}</p>
      <KidPills kids={kids} active={Math.max(0, active)} setActive={setActive} lang={lang} id="dkp" noAll />
      <div className="seg big" role="tablist">
        {['growth', 'meds', 'temp', 'miles'].map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} role="tab" aria-selected={tab === k} data-tour={k === 'temp' ? 'diary-temp' : undefined}>
            {tab === k && <motion.i layoutId="diary-tab" className="seg-pill" transition={spring} />}
            <span>{k === 'growth' ? s.tabGrowth : k === 'meds' ? s.tabMeds : k === 'temp' ? FEVER_TEXT[lang].tab : MILESTONE_TEXT[lang].tab}</span>
          </button>
        ))}
      </div>
      {tab === 'growth' && !kid.sex && (
        <motion.div className="sex-ask" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p>{s.sexAsk}</p>
          <div className="row">
            <motion.button className="btn" onClick={() => setKid({ ...kid, sex: 'm' })} {...tap}>{s.boy}</motion.button>
            <motion.button className="btn" onClick={() => setKid({ ...kid, sex: 'f' })} {...tap}>{s.girl}</motion.button>
          </div>
        </motion.div>
      )}
      {tab === 'growth' && kid.sex && (
        <>
          {months < 24 && (
            <details className="ga"><summary>{s.pretermQ}</summary><label className="field"><span>{s.preterm}</span>
              <select value={kid.gaWeeks || ''} onChange={(e) => setKid({ ...kid, gaWeeks: e.target.value ? +e.target.value : undefined })}>
                <option value="">≥ 37</option>
                {Array.from({ length: 15 }, (_, i) => 22 + i).map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label></details>
          )}
          <Growth lang={lang} kid={kid} growth={growth} setGrowth={setGrowth} />
        </>
      )}
      {tab === 'meds' && <Meds lang={lang} kid={kid} months={months} meds={meds} setMeds={setMeds} growth={growth} medPlans={medPlans} setMedPlans={setMedPlans} temps={temps} />}
      {tab === 'temp' && <Fever lang={lang} kid={kid} temps={temps} setTemps={setTemps} meds={meds} onExport={() => downloadCsv({ kid, lang, meds, growth, temps })} />}
      {tab === 'miles' && <Milestones lang={lang} kid={kid} milestones={milestones} setMilestones={setMilestones} />}
      {importing
        ? <Suspense fallback={null}><ImportCsv lang={lang} kids={kids} active={Math.max(0, active)} growth={growth} meds={meds} setGrowth={setGrowth} setMeds={setMeds} temps={temps} setTemps={setTemps} onClose={() => setImporting(false)} /></Suspense>
        : <button className="btn ghost wide" style={{ marginTop: 14 }} onClick={() => setImporting(true)}>⤒ {IMPORT_BTN[lang]}</button>}
    </div>
  );
}
