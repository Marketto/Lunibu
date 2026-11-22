import React, { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { loadState, saveState, clearState, guessLang } from './lib/storage.js';
import { ageInMonths } from './lib/age.js';
import { t } from './lib/i18n.js';
import { loadIndex } from './lib/search.js';
import { AudioProvider, useAudio } from './lib/audio/useAudio.jsx';
import Settings from './components/Settings.jsx';
import { MiniPlayer } from './components/MiniPlayer.jsx';
import { Wait } from './components/Common.jsx';
import { uid } from './lib/util.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// chunk non scaricabile (deploy nuovo/offline): ricarica una sola volta
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    try { if (sessionStorage.getItem('lunibu:preload-reload')) return; sessionStorage.setItem('lunibu:preload-reload', '1'); } catch { return; }
    window.location.reload();
  });
}

// Viste pesanti caricate a richiesta (il service worker le tiene in cache: restano disponibili offline)
const Onboarding = lazy(() => import('./components/Onboarding.jsx'));
const Sounds = lazy(() => import('./components/Sounds.jsx'));
const GamesList = lazy(() => import('./components/Games.jsx').then((m) => ({ default: m.GamesList })));
const GameView = lazy(() => import('./components/Games.jsx').then((m) => ({ default: m.GameView })));
const Diary = lazy(() => import('./components/Diary.jsx'));
const QuickReceive = lazy(() => import('./components/SyncCard.jsx').then((m) => ({ default: m.QuickReceive })));
const DriveAuto = lazy(() => import('./components/SyncCard.jsx').then((m) => ({ default: m.DriveAuto })));
import { syncFromHash, COLLECTIONS } from './lib/sync.js';
import { forget as forgetDrive } from './lib/driveStore.js';
import { revoke as revokeDrive } from './lib/drive.js';
import { VersionLine, SHARE_TEXT } from './components/Share.jsx';
import Tour, { TourRecall } from './components/Tour.jsx';
import { TOUR } from './data/tour.js';
import { pendingSlides, markSeen, loadTour, saveTour } from './lib/tour.js';
import { initUpdates, onUpdate, applyUpdate, dismissUpdated } from './lib/update.js';

initUpdates();
import { Home, CardView, CategoryView } from './components/Views.jsx';
import { Backdrop, Mobile } from './components/Paper.jsx';
import { TermsPage, TermsAccept } from './components/Terms.jsx';
import { Character, CHAR_SETS } from './components/Characters.jsx';
import { CAT } from './lib/categories.js';
import { getDocsSync } from './lib/search.js';
import { TERMS, TERMS_VERSION } from './lib/terms.js';
import { spring, tap } from './components/Common.jsx';
import { IconBack, IconAsk, IconSounds, IconKids, IconMusic, IconMusicOff, IconBall as IconBlocks, IconDiary } from './components/Icons.jsx';

// Hash semplici (#card--febbre, #cat--sonno, #suoni, #bimbi): funzionano in ogni contenitore
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (r) => { window.location.hash = r || ''; };
  return [route, go];
}

// Transizione tra schermate: un foglio di carta sale e una parata di personaggi sorridenti
// (nuvole, stelle, soli, foglie, coccinelle, orsetti…) scelti in base alla destinazione.
function CharacterParade({ k, set, color }) {
  const names = CHAR_SETS[set] || CHAR_SETS.home;
  return (
    <AnimatePresence>
      <motion.div key={k} className="parade" aria-hidden="true" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.i className="parade-bg" style={{ background: color }}
          initial={{ y: '102%' }} animate={{ y: ['102%', '0%', '0%', '-102%'] }}
          transition={{ duration: 1.1, times: [0, 0.32, 0.6, 1], ease: [0.65, 0, 0.35, 1] }} />
        {names.map((n, i) => {
          const x = 8 + (i * 84) / (names.length - 1);
          return (
            <motion.span key={i} className="parade-char" style={{ left: `${x}%` }}
              initial={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 30, scale: 0.6 }}
              animate={{ y: ['110vh', `${38 + (i % 3) * 8}vh`, `${34 + (i % 3) * 8}vh`, '-30vh'], rotate: [(i % 2 ? 1 : -1) * 30, 0, (i % 2 ? -1 : 1) * 8, 0], scale: [0.6, 1.1, 1, 0.9] }}
              transition={{ duration: 1.15, times: [0, 0.35, 0.6, 1], delay: i * 0.035, ease: 'easeInOut' }}>
              <Character name={n} size={84} />
            </motion.span>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

// Schermata di avvio: la giostrina scende e compare il nome
function Splash({ lang, onDone }) {
  useEffect(() => { const id = setTimeout(onDone, 1500); return () => clearTimeout(id); }, [onDone]);
  return (
    <motion.div className="splash" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
      <motion.div initial={{ y: -220 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 11 }}>
        <Mobile height={200} night />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 14, letterSpacing: '0.2em' }} animate={{ opacity: 1, y: 0, letterSpacing: '-0.01em' }}
        transition={{ delay: 0.45, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
        {t(lang).appName}
      </motion.h1>
    </motion.div>
  );
}

function AmbientButton({ lang }) {
  const audio = useAudio();
  const s = t(lang);
  return (
    <motion.button className={`round-btn ${audio.ambient ? 'on' : ''}`} onClick={audio.toggleAmbient}
      aria-label={s.ambientOnLabel} aria-pressed={audio.ambient} {...tap}>
      <AnimatePresence mode="wait">
        <motion.span key={audio.ambient ? 'on' : 'off'} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} style={{ display: 'grid' }}>
          {audio.ambient ? <IconMusic /> : <IconMusicOff />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function BottomNav({ view, go, lang }) {
  const s = t(lang);
  const tabs = [
    ['', s.navAsk, <IconAsk key="a" />, ['', 'card', 'cat']],
    ['giochi', s.navGames, <IconBlocks key="g" />, ['giochi', 'gioco']],
    ['suoni', s.navSounds, <IconSounds key="s" />, ['suoni']],
    ['diario', s.navDiary, <IconDiary key="d" />, ['diario']],
    ['bimbi', s.navKids, <IconKids key="k" />, ['bimbi']]
  ];
  return (
    <nav className="bottom-nav">
      {tabs.map(([r, label, icon, views]) => {
        const on = views.includes(view);
        return (
          <motion.button key={r} data-tour={`nav-${r || 'domande'}`} className={`nav-item ${on ? 'on' : ''}`} onClick={() => go(r)} {...tap} aria-current={on ? 'page' : undefined}>
            {on && <motion.i layoutId="nav-pill" className="nav-pill" transition={spring} />}
            <motion.span animate={on ? { y: [0, -4, 0] } : { y: 0 }} transition={{ duration: 0.35 }} style={{ display: 'grid' }}>{icon}</motion.span>
            <span>{label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}

// Ogni bimbo ha un id stabile: i diari (crescita, medicine) restano collegati anche se l'ordine cambia
const withIds = (kids) => kids.map((k) => (k.id ? k : { ...k, id: uid() }));

function UpdateBanner({ lang }) {
  const [u, setU] = React.useState({ ready: false, justUpdated: null });
  React.useEffect(() => onUpdate((x) => setU({ ...x })), []);
  const s = SHARE_TEXT[lang];
  const msg = u.justUpdated ? s.updated(u.justUpdated.to) : u.ready ? s.ready : null;
  return (
    <AnimatePresence>
      {msg && (
        <motion.div className="update-banner" role="status" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
          <span>{msg}</span>
          {u.ready && !u.justUpdated
            ? <button className="btn small" onClick={applyUpdate}>{s.now}</button>
            : <button className="btn small" onClick={dismissUpdated}>{s.ok}</button>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const [state, setState] = useState(() => {
    const st = loadState();
    return { ambient: false, ...st, kids: withIds(st.kids || []), lang: st.lang || guessLang() };
  });
  const update = (patch) => setState((s) => ({ ...s, ...patch, ...(patch.kids ? { kids: withIds(patch.kids) } : {}) }));
  useEffect(() => { saveState(state); }, [state]);
  // Elenchi del diario: aggiorna updatedAt dei record nuovi/modificati e registra una lapide per quelli eliminati
  const setList = (key) => (next) => setState((s) => {
    const prev = s[key] || [];
    const now = new Date().toISOString();
    const strip = ({ updatedAt, ...r }) => JSON.stringify(r); // eslint-disable-line no-unused-vars
    const old = new Map(prev.map((r) => [r.id, r]));
    const stamped = next.map((r) => { const o = old.get(r.id); return !o || strip(o) !== strip(r) ? { ...r, updatedAt: now } : r; });
    const keep = new Set(next.map((r) => r.id));
    const deleted = { ...(s.deleted || {}) };
    for (const r of prev) if (!keep.has(r.id)) deleted[r.id] = now;
    return { ...s, [key]: stamped, deleted };
  });
  const applySync = (m) => setState((s) => ({ ...s, ...Object.fromEntries(COLLECTIONS.map((k) => [k, m[k] || s[k] || []])), kids: withIds(m.kids), deleted: m.deleted }));
  return (
    <MotionConfig reducedMotion="user">
      <AudioProvider lang={state.lang} ambientPref={state.ambient} setAmbientPref={(v) => update({ ambient: v })}>
        <Shell state={state} setState={setState} update={update} setList={setList} applySync={applySync} />
      </AudioProvider>
    </MotionConfig>
  );
}

function Shell({ state, setState, update, setList, applySync }) {
  const [route, go] = useHashRoute();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('sleep');
  const [splash, setSplash] = useState(true);
  const prevView = React.useRef(route.split('--')[0]);
  const [sweep, setSweep] = useState({ k: 0, set: 'home', color: '#edf0f7' });
  useEffect(() => {
    const [v, p] = route.split('--');
    if (v !== prevView.current || route.includes('--')) {
      let cat = null;
      if (v === 'cat') cat = p;
      if (v === 'card') cat = getDocsSync(state.lang)?.[p]?.c || null;
      const set = cat || (v === 'suoni' ? 'suoni' : v === 'giochi' || v === 'gioco' ? 'giochi' : v === 'bimbi' ? 'bimbi' : 'home');
      const color = cat ? CAT[cat]?.color : v === 'suoni' ? '#2f3566' : '#dfe7fb';
      setSweep((s) => ({ k: s.k + 1, set, color }));
    }
    prevView.current = v;
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps
  const { lang, kids, accepted } = state;
  const [incoming, setIncoming] = useState(() => syncFromHash(window.location.hash));
  useEffect(() => {
    const on = () => { const d = syncFromHash(window.location.hash); if (d) setIncoming(d); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const closeIncoming = () => { window.history.replaceState(null, '', window.location.pathname + window.location.search); setIncoming(null); };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { if (accepted) loadIndex(lang).catch(() => {}); }, [lang, accepted]);

  const s = t(lang);
  const active = kids.length ? Math.max(-1, Math.min(state.activeKid, kids.length - 1)) : -1;
  const months = active >= 0 ? ageInMonths(kids[active].birth) : null;
  const setLang = (l) => { if (l !== lang) setQuery(''); update({ lang: l }); };
  const setActive = (i) => update({ activeKid: i });
  const [view, param] = route.split('--');
  const night = view === 'suoni' && group === 'sleep';

  // Giro delle funzioni: solo a termini e onboarding finiti, senza import QR in corso e a splash chiuso
  const [tourSeen, setTourSeen] = useState(() => loadTour().seen);
  const [tourOpen, setTourOpen] = useState(null); // null | 'new' | 'all'
  const tourReady = !splash && !incoming && accepted && kids.length > 0 && state.terms === TERMS_VERSION;
  useEffect(() => { if (tourReady && tourOpen === null && pendingSlides(tourSeen).length) setTourOpen('new'); }, [tourReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const tourSlides = tourOpen === 'all' ? TOUR : pendingSlides(tourSeen);
  const closeTour = () => {
    const seen = markSeen(tourSeen, tourSlides.map((x) => x.id));
    saveTour({ seen }); setTourSeen(seen); setTourOpen(false);
  };

  const splashEl = <AnimatePresence>{splash && <Splash lang={lang} onDone={() => setSplash(false)} />}</AnimatePresence>;

  if (!accepted || !kids.length) {
    return (
      <>
        {splashEl}
        <Backdrop />
        <main className="app" style={{ paddingBottom: 30 }}>
          <ErrorBoundary lang={lang}><Suspense fallback={<Wait />}><Onboarding lang={lang} setLang={setLang} qrData={incoming} onQrClose={closeIncoming}
            onDone={(k, extra = {}) => { closeIncoming(); update({ ...extra, kids: k, accepted: true, activeKid: 0, terms: TERMS_VERSION, termsAt: new Date().toISOString() }); }} /></Suspense></ErrorBoundary>
        </main>
      </>
    );
  }

  // Condizioni aggiornate (o accettate con una versione precedente): nuova accettazione
  if (state.terms !== TERMS_VERSION) {
    return (
      <>
        {splashEl}
        <Backdrop />
        <main className="app" style={{ paddingBottom: 30 }}>
          <h1 style={{ marginTop: 20 }}>{TERMS[lang].title}</h1>
          <TermsAccept lang={lang} notice={TERMS[lang].newVersion} label={s.accept}
            onAccept={() => update({ terms: TERMS_VERSION, termsAt: new Date().toISOString() })} />
        </main>
      </>
    );
  }

  let content;
  const common = { lang, kids, active, setActive, months, go };
  if (view === 'card' && param) content = <CardView {...common} id={param} />;
  else if (view === 'cat' && param) content = <CategoryView {...common} id={param} />;
  else if (view === 'condizioni') content = <TermsPage lang={lang} />;
  else if (view === 'giochi') content = <GamesList {...common} />;
  else if (view === 'gioco' && param) content = <GameView lang={lang} id={param} />;
  else if (view === 'diario') content = (
    <Diary {...common} growth={state.growth || []} meds={state.meds || []}
      setGrowth={setList('growth')} setMeds={setList('meds')} medPlans={state.medPlans || []} setMedPlans={setList('medPlans')}
      milestones={state.milestones || []} setMilestones={setList('milestones')} temps={state.temps || []} setTemps={setList('temps')}
      setKid={(k) => update({ kids: kids.map((x) => (x.id === k.id ? k : x)) })} />
  );
  else if (view === 'suoni') content = <Sounds {...common} group={group} setGroup={setGroup} />;
  else if (view === 'bimbi') content = (
    <Settings lang={lang} setLang={setLang} kids={kids} syncState={state} onSync={applySync}
      setKids={(k) => update({ kids: k, activeKid: Math.min(state.activeKid, k.length - 1) })}
      onReset={() => { clearState(); forgetDrive(); revokeDrive().catch(() => {}); setState({ lang, accepted: false, kids: [], activeKid: 0, ambient: false }); setTourSeen([]); setTourOpen(null); go(''); }} />
  );
  else content = <Home {...common} query={query} setQuery={setQuery} showInstall={!state.installDismissed} onDismissInstall={() => update({ installDismissed: true })} />;

  const deep = view === 'card' || view === 'cat' || view === 'condizioni' || view === 'gioco';

  return (
    <>
      {splashEl}
      {sweep.k > 0 && <CharacterParade k={sweep.k} set={sweep.set} color={sweep.color} />}
      <Backdrop night={night} />
      <UpdateBanner lang={lang} />
      <ErrorBoundary lang={lang}><Suspense fallback={null}>
        <DriveAuto lang={lang} state={state} onMerge={applySync} />
        {incoming && <QuickReceive lang={lang} data={incoming} state={state} onMerge={applySync} onClose={closeIncoming} />}
      </Suspense></ErrorBoundary>
      <main className="app">
        <div className="topbar">
          <AnimatePresence>
            {deep ? (
              <motion.button key="back" className="round-btn" onClick={() => window.history.back()} aria-label={s.back}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} {...tap}>
                <IconBack />
              </motion.button>
            ) : <span />}
          </AnimatePresence>
          <AmbientButton lang={lang} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={route}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.18 }}>
            <ErrorBoundary lang={lang}><Suspense fallback={<Wait />}>{content}</Suspense></ErrorBoundary>
          </motion.div>
        </AnimatePresence>
        <TourRecall lang={lang} onClick={() => setTourOpen('all')} />
        <p className="footnote" data-tour="footer">{s.disclaimerShort}. {s.emergency}. <a href="#condizioni">{TERMS[lang].title}</a> · <VersionLine lang={lang} /></p>
      </main>
      <AnimatePresence>
        {tourOpen && tourReady && tourSlides.length > 0 && <Tour key="tour" lang={lang} slides={tourSlides} onClose={closeTour} go={go} route={route} />}
      </AnimatePresence>
      <MiniPlayer lang={lang} go={go} />
      <BottomNav view={view} go={go} lang={lang} />
    </>
  );
}
