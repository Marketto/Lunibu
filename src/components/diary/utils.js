import { adjustHeight } from '../../lib/growth.js';
import { localDate } from '../../lib/util.js';

export const today = () => localDate();
export const fmt = (n, d = 1) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
export const ordEn = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;

export const hVal = (g, m) => adjustHeight(m, +g.height, g.heightPos || (m < 24 ? 'lying' : 'standing'));
export const COLORS = ['#b9b2ec', '#f7c48f', '#a8d0be', '#f1b4c3', '#a9c7ee', '#f7d79a', '#9ed3d6'];
export const GROWTH_REFS = { bmiOverweight: ['X4'], bmiObese: ['X4'], bmiThin: ['X4'], bmiVeryThin: ['X4'], implausible: ['W7', 'W12'], standingEarly: ['W7'], tall: ['W3'], weightHigh: ['W3', 'W15'], weightVeryHigh: ['W3', 'W15'], wflOverweight: ['W4', 'W7', 'W15', 'W3'], wflObese: ['W4', 'W7', 'W15', 'W3'], wflRisk: ['W4', 'W7', 'W15', 'W3'], wflWasting: ['W4', 'W7', 'W3'], wflSevereWasting: ['W4', 'W7', 'W3'], bmiEstimatedOut: ['W1', 'W2', 'W16'], veryLow: ['W3', 'W1'], low: ['W3', 'W1'], below04: ['W5'], headHigh: ['W11', 'W8'], headVeryHigh: ['W11', 'W8'], headLow: ['W10', 'W8'], headVeryLow: ['W10', 'W8'], crossDown: ['W5', 'W9', 'W6'], crossUp: ['W5', 'W9'], newbornLoss: ['W6'], notRegained: ['W6'] };
