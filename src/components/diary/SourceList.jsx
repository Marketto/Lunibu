import SOURCES from '../../../content/sources.json';
import { DIARY_TEXT } from './text.js';

export function SourceList({ ids, lang }) {
  const s = DIARY_TEXT[lang];
  return (
    <details className="diary-sources">
      <summary>{s.sources} ({ids.length})</summary>
      <ol>
        {ids.filter((id) => SOURCES[id]).map((id) => (
          <li key={id}><a href={SOURCES[id].url} target="_blank" rel="noreferrer">{SOURCES[id].label}</a> <small>[{id}]</small></li>
        ))}
      </ol>
    </details>
  );
}

