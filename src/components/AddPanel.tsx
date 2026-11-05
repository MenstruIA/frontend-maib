import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

/**
 * Formulaire d'ajout repliable : un bouton l'ouvre, le même bouton (ou Échap) le referme.
 * Fermé, son contenu est retiré de la navigation au clavier (attribut inert) et des lecteurs d'écran.
 * Les champs saisis sont conservés tant que le composant reste monté : on peut replier sans perdre sa saisie.
 */
export function AddPanel({ label, open, onToggle, children }: {
  label: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  const body = useRef<HTMLDivElement>(null);

  // À l'ouverture, le focus va au premier champ pour saisir tout de suite.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => body.current?.querySelector<HTMLElement>('input, select, textarea')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div
      className={`add-panel${open ? ' is-open' : ''}`}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); onToggle(false); } }}
    >
      <button type="button" className="add-toggle" aria-expanded={open} aria-controls={id} onClick={() => onToggle(!open)}>
        <span className="add-toggle-icon" aria-hidden="true"><Plus size={16} /></span>
        <span className="add-toggle-label">{open ? 'Fermer le formulaire' : label}</span>
        <ChevronDown className="add-toggle-chevron" size={18} aria-hidden="true" />
      </button>
      <div id={id} className="add-body" inert={!open} ref={body}>
        <div className="add-body-inner">{children}</div>
      </div>
    </div>
  );
}
