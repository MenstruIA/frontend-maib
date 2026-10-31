import { useState, type FormEvent } from 'react';
import { Flag, X } from 'lucide-react';
import { api } from '../api';
import type { FeedbackCategory } from '../types';

const LABELS: Record<FeedbackCategory, string> = {
  incorrect_info: 'Information incorrecte',
  inappropriate: 'Contenu inadapté',
  source_unreachable: 'Source inaccessible',
  service_unreachable: 'Service injoignable',
  safety_risk: 'Risque pour la sécurité',
  other: 'Autre',
};

export function ReportButton({ targetType, targetRef, label = 'Signaler' }: { targetType: 'content' | 'service' | 'assistant'; targetRef: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-button report-btn" onClick={() => setOpen(true)}><Flag size={14} /> {label}</button>
      {open && <FeedbackDialog targetType={targetType} targetRef={targetRef} onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackDialog({ targetType, targetRef, onClose }: { targetType: string; targetRef: string; onClose: () => void }) {
  const [category, setCategory] = useState<FeedbackCategory>('incorrect_info');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.feedback({ category, target_type: targetType, target_ref: targetRef, description: description.trim() || undefined });
      setReference(r.data.reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally { setBusy(false); }
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <div className="dialog">
        <button className="icon-button dialog-close" aria-label="Fermer" onClick={onClose}><X size={18} /></button>
        <h2 id="fb-title">Signaler un problème</h2>
        {reference ? (
          <>
            <p>Merci, votre signalement a été enregistré.</p>
            <p className="muted">Référence : <code>{reference}</code></p>
            <button className="button primary" onClick={onClose}>Fermer</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="fb-cat">Type de problème</label>
            <select id="fb-cat" value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>
              {(Object.keys(LABELS) as FeedbackCategory[]).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
            </select>
            <label htmlFor="fb-desc">Précision (facultatif)</label>
            <textarea id="fb-desc" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            <p className="muted small">N’indiquez ni votre nom, ni vos coordonnées, ni d’informations sur votre santé.</p>
            {error && <div className="notice error" role="alert">{error}</div>}
            <button className="button primary" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
