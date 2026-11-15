// Preferenze e promemoria attivo della temperatura: SOLO su questo dispositivo (localStorage), mai sincronizzati.
const PREFS_KEY = 'lunibu:fever-prefs';
const REM_KEY = 'lunibu:fever-reminder';

export function loadRawPrefs() {
  try { const v = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; }
}
export function saveRawPrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage non disponibile */ }
}
export function clearPrefs() { try { localStorage.removeItem(PREFS_KEY); } catch { /* ignore */ } }

/** Promemoria attivo: { dueAt (ms), notified (bool) } oppure null. Non contiene valori né nomi. */
export function loadReminder() {
  try {
    const v = JSON.parse(localStorage.getItem(REM_KEY) || 'null');
    return v && typeof v.dueAt === 'number' ? { dueAt: v.dueAt, notified: !!v.notified } : null;
  } catch { return null; }
}
export function saveReminder(r) {
  try { if (r) localStorage.setItem(REM_KEY, JSON.stringify(r)); else localStorage.removeItem(REM_KEY); } catch { /* ignore */ }
}
