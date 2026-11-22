// Primo avvio del secondo genitore: stato iniziale costruito dai dati condivisi (file, QR o Drive).
import { mergeData, syncShape } from './sync.js';

const EMPTY = syncShape();

/** Unisce i dati ricevuti in uno stato vuoto. Restituisce kids/growth/meds/medPlans/deleted + riepilogo. */
export function initialFromImport(remote) {
  const m = mergeData(EMPTY, remote || {});
  const { kids, growth, meds, medPlans, milestones, temps, deleted } = m;
  return { kids, growth, meds, medPlans, milestones, temps, deleted, summary: { kids: kids.length, names: kids.map((k) => k.name).filter(Boolean), growth: growth.length, meds: meds.length } };
}

/** Dopo la revisione: i bimbi modificati (nome/nascita) + i dati del diario da importare. */
export function finishOnboarding(kids, imported) {
  const clean = kids.map((k) => ({ ...k, name: (k.name || '').trim() }));
  const extra = imported ? (({ kids: _k, ...rest }) => rest)(syncShape(imported)) : {}; // eslint-disable-line no-unused-vars
  return { kids: clean, extra };
}
