import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TRACKS } from '../lib/audio/engine.js';
import { TRACK_TEXT, SOUND_STRINGS } from '../lib/audio/tracks-i18n.js';
import { useAudio } from '../lib/audio/useAudio.jsx';
import { spring, tap } from './Common.jsx';
import { IconStop } from './Icons.jsx';
import TrackIcon from './TrackIcons.jsx';

export function MiniPlayer({ lang, go }) {
  const audio = useAudio();
  const tr = TRACKS.find((x) => x.id === audio.playing);
  return (
    <AnimatePresence>
      {tr && (
        <motion.div className="mini-player" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={spring}>
          <span className="mini-ic" style={{ '--hue': tr.hue }}><TrackIcon id={tr.id} /></span>
          <button className="grow" onClick={() => go('suoni')} style={{ textAlign: 'left' }}>
            <small className="muted">{SOUND_STRINGS[lang].nowPlaying}</small>
            <strong>{TRACK_TEXT[tr.id][lang][0]}</strong>
          </button>
          <motion.button className="stop" onClick={audio.stopTrack} aria-label={SOUND_STRINGS[lang].stop} {...tap}><IconStop /></motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
