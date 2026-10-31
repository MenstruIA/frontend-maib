import { ChevronRight } from 'lucide-react';
import type { Source } from '../types';

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return <p className="source-warning">Aucune référence associée à cette fiche.</p>;
  return (
    <div className="sources">
      <strong>Sources</strong>
      {sources.map((s) => (
        <a key={`${s.url}-${s.title}`} href={s.url} target="_blank" rel="noreferrer noopener">
          <span>{s.title}{s.publisher ? ` — ${s.publisher}` : ''}</span><ChevronRight size={14} />
        </a>
      ))}
    </div>
  );
}
