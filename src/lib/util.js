// Piccole utilità condivise. Le date "locali" usano i getter locali, mai toISOString (che è UTC).
const p2 = (n) => String(n).padStart(2, '0');
/** YYYY-MM-DD nel fuso locale. */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
/** YYYY-MM-DDTHH:MM nel fuso locale (valore di <input type="datetime-local">). */
export const localDateTime = (d = new Date()) => `${localDate(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const nowLocal = () => localDateTime(new Date());
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
