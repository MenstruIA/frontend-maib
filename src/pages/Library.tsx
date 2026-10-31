import { useState, type FormEvent } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { api } from '../api';
import type { ContentItem } from '../types';
import { useAsync } from '../lib/useAsync';
import { Sources } from '../components/Sources';
import { ReportButton } from '../components/FeedbackDialog';

export function Library() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [err, setErr] = useState('');
  const cats = useAsync(() => api.categories(), []);
  const list = useAsync(() => api.content({ q: query, category }), [query, category]);

  function submit(e: FormEvent) { e.preventDefault(); setQuery(q.trim()); }
  async function open(slug: string) {
    setErr('');
    try { setSelected((await api.contentBySlug(slug)).data); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur de chargement.'); }
  }

  if (selected) {
    return (
      <section className="page-section">
        <article className="article-panel">
          <button className="text-button" onClick={() => setSelected(null)}>← Retour aux informations</button>
          <h1 className="page-title">{selected.title}</h1>
          <p className="muted">{selected.summary}</p>
          <div className="article-body">{selected.body}</div>
          <p className="muted small">{selected.reviewed_at ? `Dernière revue : ${selected.reviewed_at}` : ''}{selected.version ? ` · version ${selected.version}` : ''}</p>
          <Sources sources={selected.sources} />
          <ReportButton targetType="content" targetRef={selected.slug} />
        </article>
      </section>
    );
  }

  const items = list.data?.data ?? [];
  return (
    <section className="page-section">
      <span className="eyebrow">Bibliothèque éducative</span><h1 className="page-title">Informations</h1>
      <form className="search-form" onSubmit={submit} role="search">
        <Search size={18} /><input aria-label="Rechercher une information" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un sujet…" />
        <button className="button primary" type="submit">Rechercher</button>
      </form>
      <div className="chips" role="group" aria-label="Thèmes">
        <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>Tous</button>
        {(cats.data?.data ?? []).map((c) => <button key={c.id} className={`chip ${category === c.slug ? 'on' : ''}`} onClick={() => setCategory(c.slug)}>{c.name}</button>)}
      </div>
      {(err || list.error) && <div className="notice error" role="alert">{err || 'Les contenus ne sont pas disponibles pour le moment.'}</div>}
      <div className="content-grid">
        {items.map((item) => (
          <article className="content-card" key={item.id}>
            <span className="content-category">{item.category?.name ?? 'Information'}</span>
            <h3>{item.title}</h3><p>{item.summary}</p>
            <div className="card-foot"><span>{item.sources.length} source(s)</span>
              <button className="text-button" onClick={() => open(item.slug)}>Lire <ChevronRight size={15} /></button></div>
          </article>
        ))}
      </div>
      {!list.loading && !list.error && !items.length && (
        <p className="empty-state">{query ? 'Aucun résultat fiable pour cette recherche.' : 'Aucun contenu validé n’est publié pour le moment.'}</p>
      )}
    </section>
  );
}
