import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Numéros à afficher : toujours la première et la dernière page, la page courante et ses voisines, « … » entre les trous. */
export function pageItems(page: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const wanted = new Set([1, last, page - 1, page, page + 1].filter((n) => n >= 1 && n <= last));
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && n - previous === 2) items.push(previous + 1); // un seul numéro manquant : on l'affiche
    else if (previous !== undefined && n - previous > 2) items.push('…');
    items.push(n);
  });
  return items;
}

export function Pagination({ page, lastPage, total, noun, onPage }: {
  page: number;
  lastPage: number;
  total?: number;
  /** Pluriel du nom de l'élément listé : « fiches », « sources »… */
  noun: string;
  onPage: (page: number) => void;
}) {
  const count = total != null ? ` · ${total.toLocaleString('fr-FR')} ${noun}` : '';
  if (lastPage <= 1) return total ? <p className="pagination-count">{total.toLocaleString('fr-FR')} {noun}</p> : null;

  return (
    <nav className="pagination" aria-label={`Pagination des ${noun}`}>
      <p className="pagination-count" aria-live="polite">Page {page} sur {lastPage}{count}</p>
      <ul>
        <li>
          <button type="button" className="page-btn nav" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft size={16} aria-hidden="true" /> Précédent
          </button>
        </li>
        {pageItems(page, lastPage).map((item, i) => (
          <li key={`${item}-${i}`}>
            {item === '…'
              ? <span className="page-gap" aria-hidden="true">…</span>
              : <button type="button" className={`page-btn${item === page ? ' current' : ''}`} aria-current={item === page ? 'page' : undefined}
                  aria-label={`Page ${item}`} onClick={() => onPage(item)}>{item}</button>}
          </li>
        ))}
        <li>
          <button type="button" className="page-btn nav" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
            Suivant <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
