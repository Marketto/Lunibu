import { latestWeight, toCsv, toMg } from '../../lib/meds.js';
import { localDateTime } from '../../lib/util.js';
import { today } from './utils.js';

/** CSV per il pediatra: medicine, crescita e (se presenti) temperature del bambino. */
export function downloadCsv({ kid, lang, meds, growth, temps = [] }) {
  const rows = meds.filter((m) => m.kidId === kid.id).sort((a, b) => a.at.localeCompare(b.at)).map((e) => {
    const w = latestWeight(growth, kid.id, e.at);
    const mg = toMg(e);
    return [localDateTime(new Date(e.at)).replace('T', ' '), e.name, e.route || '', e.amount, e.unit, e.conc || '', mg || '', w ? w.kg : '', mg && w ? (mg / w.kg).toFixed(1) : '', e.note];
  });
  const g = growth.filter((x) => x.kidId === kid.id).sort((a, b) => a.date.localeCompare(b.date)).map((x) => [x.date, x.weight || '', x.height || '', x.head || '']);
  const tp = temps.filter((x) => x.kidId === kid.id).sort((a, b) => a.at.localeCompare(b.at)).map((x) => [localDateTime(new Date(x.at)).replace('T', ' '), x.value ?? '', x.site || '', x.feelsHot ? 1 : 0, x.note || '']);
  const H = lang === 'en'
    ? [['date_time', 'medicine', 'route', 'amount', 'unit', 'mg_per_ml', 'mg', 'weight_kg', 'mg_per_kg', 'note'], ['date', 'weight_kg', 'height_cm', 'head_cm'], ['date_time', 'temperature_c', 'site', 'feels_hot_no_thermometer', 'how_are_they_note']]
    : [['data_ora', 'farmaco', 'via', 'quantita', 'unita', 'mg_per_ml', 'mg', 'peso_kg', 'mg_per_kg', 'nota'], ['data', 'peso_kg', 'altezza_cm', 'testa_cm'], ['data_ora', 'temperatura_c', 'sede', 'sembra_caldo_senza_termometro', 'come_sta_nota']];
  const csv = toCsv(rows, H[0]) + '\n\n' + toCsv(g, H[1]) + (tp.length ? '\n\n' + toCsv(tp, H[2]) : '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
  a.download = `lunibu-${(kid.name || (lang === 'en' ? 'child' : lang === 'ru' ? 'rebenok' : 'bimbo')).toLowerCase()}-${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

