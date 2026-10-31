import { useState, type FormEvent } from 'react';
import { MapPin, Phone, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useAsync } from '../lib/useAsync';
import { ReportButton } from '../components/FeedbackDialog';

export function Services() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [applied, setApplied] = useState({ q: '', type: '' });
  const res = useAsync(() => api.services({ q: applied.q, type: applied.type }), [applied]);
  const items = res.data?.data ?? [];
  const submit = (e: FormEvent) => { e.preventDefault(); setApplied({ q: q.trim(), type }); };

  return (
    <section className="page-section">
      <span className="eyebrow">Orientation</span><h1 className="page-title">Centres de santé</h1>
      <p className="muted">Seules les fiches vérifiées sont affichées, avec leur date de vérification. Confirmez les horaires avant de vous déplacer.</p>
      <form className="search-form wrap" onSubmit={submit} role="search">
        <input aria-label="Ville, nom ou service" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une ville ou un centre…" />
        <select aria-label="Type de service" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tous</option><option value="centre_de_sante">Centres de santé</option><option value="pharmacie">Pharmacies</option><option value="clinique">Cliniques</option>
        </select>
        <button className="button primary" type="submit">Rechercher</button>
      </form>
      {res.error && <div className="notice error" role="alert">Le répertoire n’est pas disponible pour le moment.</div>}
      <div className="service-grid">
        {items.map((s) => (
          <article className="service-card" key={s.id}>
            <span className="service-icon"><MapPin /></span>
            <h3>{s.name}</h3>{s.description && <p>{s.description}</p>}
            <div className="service-address"><MapPin size={15} /> {[s.address, s.city].filter(Boolean).join(', ')}</div>
            {s.opening_hours && <p className="muted small">Horaires : {s.opening_hours}</p>}
            {s.phone && <a className="service-phone" href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}><Phone size={14} /> {s.phone}</a>}
            {s.latitude != null && s.longitude != null && (
              <a className="button secondary" target="_blank" rel="noreferrer noopener" href={`https://www.openstreetmap.org/directions?to=${s.latitude}%2C${s.longitude}`}>Voir l’itinéraire</a>
            )}
            <span className="verified-label"><ShieldCheck size={14} /> Vérifié le {s.verified_at}</span>
            <ReportButton targetType="service" targetRef={String(s.id)} label="Signaler une erreur" />
          </article>
        ))}
      </div>
      {!res.loading && !res.error && !items.length && <p className="empty-state">Aucun service vérifié n’est disponible pour cette recherche.</p>}
    </section>
  );
}
