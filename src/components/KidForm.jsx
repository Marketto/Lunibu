import React from 'react';
import { motion } from 'framer-motion';
import { t } from '../lib/i18n.js';
import { validBirth } from '../lib/age.js';
import { spring } from './Common.jsx';
import { localDate } from '../lib/util.js';

const todayISO = () => localDate();
const AV = ['#f7c48f', '#b9b2ec', '#a8d0be', '#f1b4c3', '#a9c7ee', '#f7d79a'];

export function KidForm({ kid, index, lang, onChange, onRemove }) {
  const s = t(lang);
  const future = kid.birth && kid.birth > todayISO();
  const label = kid.name || s.unnamedKid(index);
  return (
    <motion.div className="kid-card" layout initial={{ opacity: 0, y: 20, rotate: index % 2 ? 1.5 : -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ ...spring, delay: index * 0.06 }}>
      <div className="kid-card-head">
        <span className="av" style={{ background: AV[index % AV.length] }}>{label.slice(0, 1).toUpperCase()}</span>
        <strong>{label}</strong>
        {onRemove && <button className="rm" onClick={onRemove}>{s.remove}</button>}
      </div>
      <label className="field">
        <span>{s.birthDate}</span>
        <input type="date" max={todayISO()} value={kid.birth || ''} onChange={(e) => onChange({ ...kid, birth: e.target.value })} />
      </label>
      {future && <p className="error">{s.birthFuture}</p>}
      {!future && kid.birth && !validBirth(kid.birth) && <p className="error">{s.birthTooOld}</p>}
      <label className="field">
        <span>{s.nameOptional}</span>
        <input type="text" maxLength={30} value={kid.name || ''} onChange={(e) => onChange({ ...kid, name: e.target.value })} />
      </label>
    </motion.div>
  );
}
