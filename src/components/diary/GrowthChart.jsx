import { motion } from 'framer-motion';
import { spring } from '../Common.jsx';
import { INDICATORS, curve } from '../../lib/growth.js';
import { fmt } from './utils.js';

export function GrowthChart({ indicator, sex, points, upTo, lang }) {
  const W = 340, Hh = 220, P = { l: 34, r: 26, t: 10, b: 24 };
  const maxM = Math.min(INDICATORS[indicator].maxMonths, Math.max(6, Math.ceil((upTo + 3) / 3) * 3));
  const lowM = indicator === 'bmi' ? INDICATORS.bmi.minMonths : 0;
  const minM = Math.max(lowM, Math.min(maxM - 12, Math.floor(Math.min(upTo, ...points.map((p) => p.m)) - 3)));
  const curves = curve(indicator, sex, minM, maxM, 48);
  const all = [...curves.flatMap((c) => c.pts.map((p) => p[1])), ...points.map((p) => p.v)];
  const yMin = Math.floor(Math.min(...all) * 0.97), yMax = Math.ceil(Math.max(...all) * 1.02);
  const x = (m) => P.l + ((m - minM) / (maxM - minM || 1)) * (W - P.l - P.r);
  const y = (v) => Hh - P.b - ((v - yMin) / (yMax - yMin || 1)) * (Hh - P.t - P.b);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const band = (a, b) => `${path(a.pts)}L${b.pts.slice().reverse().map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('L')}Z`;
  const unit = INDICATORS[indicator].unit;
  const rawStep = (yMax - yMin) / 5, stepBase = unit === 'kg' && rawStep < 1 ? 0.5 : 1;
  const yStep = Math.max(stepBase, Math.ceil(rawStep / stepBase) * stepBase);
  const yTickVals = []; for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 1e-9; v += yStep) yTickVals.push(v);
  const xStep = maxM - minM > 24 ? 12 : maxM - minM > 12 ? 6 : 3;
  return (
    <svg className="growth-chart" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label={`${indicator} chart`}>
      <path d={band(curves[0], curves[4])} className="band-outer" />
      <path d={band(curves[1], curves[3])} className="band-inner" />
      {curves.map((c) => (
        <g key={c.p}>
          <path d={path(c.pts)} className={c.p === 50 ? 'p50' : 'pline'} />
          <text x={W - P.r + 3} y={y(c.pts[c.pts.length - 1][1]) + 3} className="plabel">{c.p}</text>
        </g>
      ))}
      {yTickVals.map((v) => (
        <text key={v} x={P.l - 4} y={y(v) + 3} className="axis" textAnchor="end">{fmt(v, yStep < 1 ? 1 : 0)}</text>
      ))}
      {Array.from({ length: Math.floor((maxM - minM) / xStep) + 1 }, (_, i) => Math.ceil(minM / xStep) * xStep + i * xStep).filter((m) => m <= maxM).map((m) => (
        <text key={m} x={x(m)} y={Hh - 6} className="axis" textAnchor="middle">{m}{lang === 'ru' ? 'м' : 'm'}</text>
      ))}
      {points.filter((p) => !p.est).length > 1 && <path d={path(points.filter((p) => !p.est).map((p) => [p.m, p.v]))} className="kid-line" />}
      {[...points].sort((a, b) => (b.est ? 1 : 0) - (a.est ? 1 : 0)).map((p, i) => (
        <motion.circle key={p.id} cx={x(p.m)} cy={y(p.v)} r={p.est ? 3.5 : p.warn ? 6 : 5} className={`kid-pt ${p.warn ? 'warn' : ''}`}
          style={p.est ? { fill: 'none', strokeDasharray: '2 1.5', strokeWidth: 1.5, opacity: .85 } : undefined}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.05 * i }}>
          {p.est && <title>{lang === 'ru' ? 'Расчётный ИМТ' : lang === 'en' ? 'Estimated BMI' : 'BMI stimato'}</title>}
        </motion.circle>
      ))}
    </svg>
  );
}

