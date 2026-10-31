import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { adminApi } from '../api';
import type { AdminUser, ContentItem, HealthService, Source } from '../types';
import { useAsync } from '../lib/useAsync';

type Tab = 'content' | 'sources' | 'services' | 'feedback' | 'assistant' | 'users' | 'reports' | 'audit';

const TABS: { id: Tab; label: string; perms: string[] }[] = [
  { id: 'content', label: 'Contenus', perms: ['content.create', 'content.review', 'content.publish'] },
  { id: 'sources', label: 'Sources', perms: ['source.manage', 'source.validate'] },
  { id: 'services', label: 'Services', perms: ['service.manage', 'service.verify'] },
  { id: 'feedback', label: 'Signalements', perms: ['feedback.manage'] },
  { id: 'assistant', label: 'Assistant IA', perms: ['assistant.manage'] },
  { id: 'users', label: 'Utilisateurs', perms: ['user.manage'] },
  { id: 'reports', label: 'Rapports', perms: ['report.view'] },
  { id: 'audit', label: 'Audit', perms: ['audit.view'] },
];

export function Admin() {
  const [token, setToken] = useState<string | null>(null); // en mémoire uniquement
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const api = useMemo(() => adminApi(token), [token]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    try {
      const r = await adminApi(null).login(String(f.get('email')), String(f.get('password')));
      setToken(r.data.token); setUser(r.data.user);
    } catch (err) { setError(err instanceof Error ? err.message : 'Connexion impossible.'); } finally { setBusy(false); }
  }
  async function logout() { try { await api.logout(); } catch { /* jeton déjà invalide */ } setToken(null); setUser(null); }

  if (!token || !user) {
    return (
      <section className="page-section narrow">
        <span className="eyebrow">Espace réservé</span><h1 className="page-title">Administration</h1>
        <form className="question-form" onSubmit={login}>
          <label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="username" />
          <label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" required autoComplete="current-password" />
          {error && <div className="notice error" role="alert">{error}</div>}
          <button className="button primary" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </section>
    );
  }

  const tabs = TABS.filter((t) => t.perms.some((p) => user.permissions.includes(p)));
  return <Console api={api} user={user} tabs={tabs} onLogout={logout} />;
}

type Api = ReturnType<typeof adminApi>;

function Console({ api, user, tabs, onLogout }: { api: Api; user: AdminUser; tabs: typeof TABS; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'content');
  const can = (p: string) => user.permissions.includes(p);
  return (
    <section className="page-section admin">
      <div className="admin-head"><div><span className="eyebrow">{label(ROLES, user.role)}</span><h1 className="page-title">Administration</h1></div>
        <button className="button secondary" onClick={onLogout}>Se déconnecter</button></div>
      <div className="chips" role="tablist">{tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`chip ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {tab === 'content' && <ContentPanel api={api} can={can} />}
      {tab === 'sources' && <SourcesPanel api={api} can={can} />}
      {tab === 'services' && <ServicesPanel api={api} can={can} />}
      {tab === 'feedback' && <FeedbackPanel api={api} />}
      {tab === 'assistant' && <AssistantPanel api={api} />}
      {tab === 'users' && <UsersPanel api={api} />}
      {tab === 'reports' && <ReportsPanel api={api} />}
      {tab === 'audit' && <AuditPanel api={api} />}
    </section>
  );
}

const STATUS: Record<string, string> = { draft: 'Brouillon', in_review: 'En revue', approved: 'Approuvé', published: 'Publié', withdrawn: 'Retiré' };
const ROLES: Record<string, string> = {
  super_admin: 'Super administrateur', content_admin: 'Administrateur de contenu', editor: 'Rédacteur',
  medical_reviewer: 'Réviseur médical', service_verifier: 'Vérificateur de services', auditor: 'Auditeur',
};
const SOURCE_STATUS: Record<string, string> = { a_verifier: 'À vérifier', approuvee: 'Approuvée', expiree: 'Expirée', retiree: 'Retirée' };
const RIGHTS: Record<string, string> = { a_verifier: 'À vérifier', autorise: 'Autorisés', restreint: 'Restreints', interdit: 'Interdits' };
const SERVICE_STATUS: Record<string, string> = { draft: 'Brouillon', verified: 'Vérifié', expired: 'Expiré', withdrawn: 'Retiré' };
const FEEDBACK_STATUS: Record<string, string> = { new: 'Nouveau', triage: 'En cours', resolved: 'Résolu', dismissed: 'Écarté' };
const FEEDBACK_ACTIONS: [string, string][] = [['triage', 'Prendre en charge'], ['resolved', 'Marquer résolu'], ['dismissed', 'Écarter']];
const FEEDBACK_CATEGORY: Record<string, string> = {
  incorrect_info: 'Information incorrecte', inappropriate: 'Contenu inadapté', source_unreachable: 'Source inaccessible',
  service_unreachable: 'Service injoignable', safety_risk: 'Risque de sécurité', other: 'Autre',
};
const TARGETS: Record<string, string> = { content: 'Contenu', service: 'Service', assistant: 'Réponse de l’assistant' };

const label = (map: Record<string, string>, key?: string | null) => (key ? map[key] ?? key : '—');

/** Date lisible en français ; les dates sans heure (AAAA-MM-JJ) sont lues en heure locale pour éviter un décalage d'un jour. */
function fmt(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR', withTime && !dateOnly
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
}

function Err({ msg }: { msg: string }) { return msg ? <div className="notice error" role="alert">{msg}</div> : null; }
function Card({ children }: { children: ReactNode }) { return <div className="admin-card">{children}</div>; }

/** En-tête commun des cartes : titre + pastille d'état à gauche, information secondaire à droite. */
function Head({ title, badge, meta }: { title: ReactNode; badge?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="card-head">
      <div><strong>{title}</strong> {badge}</div>
      {meta && <span className="muted small">{meta}</span>}
    </div>
  );
}
function Pill({ status, text }: { status: string; text: string }) { return <span className={`badge b-${status}`}>{text}</span>; }
function Stat({ label: name, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'alert' }) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`}>
      <span className="stat-label">{name}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
function Loading({ on }: { on: boolean }) { return on ? <p className="muted small" role="status">Chargement…</p> : null; }

function useAction() {
  const [msg, setMsg] = useState('');
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setMsg('');
    try { await fn(); after?.(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur.'); }
  };
  return { msg, run };
}

function ContentPanel({ api, can }: { api: Api; can: (p: string) => boolean }) {
  const list = useAsync(() => api.content(), []);
  const sources = useAsync(() => api.sources().catch(() => ({ data: [] as Source[] }) as never), []);
  const cats = useAsync(() => fetch(`${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')}/categories`).then((r) => r.json() as Promise<{ data: { id: number; name: string }[] }>), []);
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null);
  const { msg, run } = useAction();

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      title: f.get('title'), summary: f.get('summary'), body: f.get('body'), category_id: Number(f.get('category_id')),
      review_due_at: f.get('review_due_at') || null, source_ids: f.getAll('source_ids').map(Number),
    };
    await run(() => api.saveContent(payload, editing?.id), () => { setEditing(null); void list.reload(); });
  }
  async function edit(id: number) { const r = await api.contentOne(id); setEditing({ ...r.data, sources: r.data.sources }); }

  if (editing) {
    const chosen = new Set((editing.sources ?? []).map((s) => s.id));
    return (
      <form className="question-form" onSubmit={save}>
        <h2>{editing.id ? `Modifier (v${editing.version})` : 'Nouveau contenu'}</h2>
        {editing.id && <p className="muted small">Toute modification remet le contenu en brouillon et invalide la validation précédente.</p>}
        <label htmlFor="c-title">Titre</label><input id="c-title" name="title" defaultValue={editing.title} required maxLength={180} />
        <label htmlFor="c-sum">Résumé</label><textarea id="c-sum" name="summary" rows={2} defaultValue={editing.summary} required maxLength={600} />
        <label htmlFor="c-body">Texte</label><textarea id="c-body" name="body" rows={10} defaultValue={editing.body} required maxLength={20000} />
        <label htmlFor="c-cat">Thème</label>
        <select id="c-cat" name="category_id" defaultValue={editing.category?.id ?? editing.category_id}>{(cats.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label htmlFor="c-due">Prochaine révision</label><input id="c-due" name="review_due_at" type="date" defaultValue={editing.review_due_at ?? ''} />
        <fieldset><legend>Sources (une source non approuvée bloque la publication)</legend>
          {(sources.data?.data ?? []).map((s) => <label key={s.id} className="check"><input type="checkbox" name="source_ids" value={s.id} defaultChecked={chosen.has(s.id)} /> {s.title} <em>({s.status})</em></label>)}
        </fieldset>
        <Err msg={msg} />
        <div className="row"><button className="button primary">Enregistrer le brouillon</button><button type="button" className="button secondary" onClick={() => setEditing(null)}>Annuler</button></div>
      </form>
    );
  }

  return (
    <>
      {can('content.create') && <button className="button primary" onClick={() => setEditing({ sources: [] })}>Nouveau contenu</button>}
      <Err msg={msg || list.error} />
      {(list.data?.data ?? []).map((c) => (
        <Card key={c.id}>
          <Head title={c.title} badge={<Pill status={c.status ?? ''} text={label(STATUS, c.status)} />} meta={`Version ${c.version}`} />
          <div className="row">
            <button className="text-button" onClick={() => edit(c.id)}>{can('content.edit') && c.status !== 'in_review' ? 'Modifier' : 'Voir'}</button>
            {c.status === 'draft' && can('content.submit') && <button className="text-button" onClick={() => run(() => api.contentAction(c.id, 'submit-review'), () => void list.reload())}>Soumettre à revue</button>}
            {c.status === 'in_review' && can('content.review') && <>
              <button className="text-button" onClick={() => run(() => api.contentAction(c.id, 'review', { decision: 'approved' }), () => void list.reload())}>Approuver</button>
              <button className="text-button" onClick={() => { const notes = window.prompt('Corrections demandées :'); if (notes) void run(() => api.contentAction(c.id, 'review', { decision: 'changes_requested', notes }), () => void list.reload()); }}>Demander des corrections</button></>}
            {c.status === 'approved' && can('content.publish') && <button className="text-button" onClick={() => run(() => api.contentAction(c.id, 'publish'), () => void list.reload())}>Publier</button>}
            {c.status === 'published' && can('content.withdraw') && <button className="text-button danger" onClick={() => run(() => api.contentAction(c.id, 'withdraw'), () => void list.reload())}>Retirer</button>}
          </div>
        </Card>
      ))}
      <Loading on={list.loading} />
      {!list.loading && !(list.data?.data ?? []).length && <p className="empty-state">Aucun contenu.</p>}
    </>
  );
}

function SourcesPanel({ api, can }: { api: Api; can: (p: string) => boolean }) {
  const list = useAsync(() => api.sources(), []);
  const { msg, run } = useAction();
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    await run(() => api.saveSource({ title: f.get('title'), publisher: f.get('publisher') || null, url: f.get('url'), territory: f.get('territory') || null }), () => { form.reset(); void list.reload(); });
  };
  const validate = async (s: Source, status: string) => {
    const rights = status === 'approuvee' ? 'autorise' : s.rights_status ?? 'a_verifier';
    const due = status === 'approuvee' ? window.prompt('Date de prochaine révision (AAAA-MM-JJ) — droits de réutilisation confirmés ?') : null;
    if (status === 'approuvee' && !due) return;
    await run(() => api.validateSource(s.id!, { status, rights_status: rights, review_due_at: due || null }), () => void list.reload());
  };
  return (
    <>
      {can('source.manage') && (
        <form className="question-form" onSubmit={create}>
          <h2>Ajouter une source</h2>
          <input name="title" placeholder="Titre exact" required /><input name="publisher" placeholder="Organisme" /><input name="url" type="url" placeholder="https://…" required /><input name="territory" placeholder="Territoire / contexte" />
          <button className="button primary">Ajouter (à vérifier)</button>
        </form>
      )}
      <Err msg={msg || list.error} />
      {(list.data?.data ?? []).map((s) => (
        <Card key={s.id}>
          <Head title={s.title} badge={<Pill status={s.status ?? ''} text={label(SOURCE_STATUS, s.status)} />} meta={`Droits de réutilisation : ${label(RIGHTS, s.rights_status)}`} />
          <a href={s.url} target="_blank" rel="noreferrer noopener" className="muted small">{s.url}</a>
          {can('source.validate') && <div className="row">
            <button className="text-button" onClick={() => validate(s, 'approuvee')}>Approuver</button>
            <button className="text-button" onClick={() => validate(s, 'expiree')}>Marquer expirée</button>
            <button className="text-button danger" onClick={() => validate(s, 'retiree')}>Retirer</button></div>}
        </Card>
      ))}
    </>
  );
}

function ServicesPanel({ api, can }: { api: Api; can: (p: string) => boolean }) {
  const list = useAsync(() => api.services(), []);
  const { msg, run } = useAction();
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    await run(() => api.saveService({
      name: f.get('name'), service_type: f.get('service_type'), city: f.get('city'), region: f.get('region') || null,
      address: f.get('address') || null, phone: f.get('phone') || null, opening_hours: f.get('opening_hours') || null,
      latitude: num('latitude'), longitude: num('longitude'),
    }), () => { form.reset(); void list.reload(); });
  };
  const verify = async (s: HealthService, result: 'ok' | 'failed') => {
    const method = window.prompt('Méthode de vérification (appel téléphonique, visite, source officielle…) :');
    if (method) await run(() => api.verifyService(s.id, { method, result }), () => void list.reload());
  };
  return (
    <>
      {can('service.manage') && (
        <form className="question-form" onSubmit={create}>
          <h2>Ajouter une fiche (brouillon, non publique)</h2>
          <input name="name" placeholder="Nom" required />
          <select name="service_type" required><option value="centre_de_sante">Centre de santé</option><option value="pharmacie">Pharmacie</option><option value="clinique">Clinique</option></select>
          <input name="city" placeholder="Commune" required /><input name="region" placeholder="Département" /><input name="address" placeholder="Adresse" />
          <input name="phone" placeholder="Téléphone public" /><input name="opening_hours" placeholder="Horaires" />
          <input name="latitude" type="number" step="any" placeholder="Latitude" /><input name="longitude" type="number" step="any" placeholder="Longitude" />
          <button className="button primary">Créer la fiche</button>
        </form>
      )}
      <Err msg={msg || list.error} />
      <Loading on={list.loading} />
      {list.data && list.data.total > list.data.data.length && <p className="muted small">Affichage des {list.data.data.length} premières fiches sur {list.data.total} (tri par nom).</p>}
      {(list.data?.data ?? []).map((s) => (
        <Card key={s.id}>
          <Head title={s.name} badge={<Pill status={s.status ?? ''} text={label(SERVICE_STATUS, s.status)} />} meta={`${s.city}${s.verified_at ? ` · vérifié le ${fmt(s.verified_at)}` : ''}`} />
          <div className="row">
            {can('service.verify') && <><button className="text-button" onClick={() => verify(s, 'ok')}>Vérification réussie</button><button className="text-button" onClick={() => verify(s, 'failed')}>Injoignable / incorrect</button></>}
            {can('service.manage') && s.status !== 'withdrawn' && <button className="text-button danger" onClick={() => run(() => api.withdrawService(s.id), () => void list.reload())}>Retirer</button>}
          </div>
        </Card>
      ))}
    </>
  );
}

function FeedbackPanel({ api }: { api: Api }) {
  const list = useAsync(() => api.feedback(), []);
  const { msg, run } = useAction();
  return (
    <>
      <Err msg={msg || list.error} />
      {(list.data?.data ?? []).map((f) => (
        <Card key={f.id}>
          <Head title={label(FEEDBACK_CATEGORY, f.category)} badge={<>{f.severity === 'critical' && <Pill status="critical" text="Critique" />} <Pill status={f.status ?? ''} text={label(FEEDBACK_STATUS, f.status)} /></>} meta={`Réf. ${f.public_id}`} />
          <p className="muted small">{f.target_type ? `${label(TARGETS, f.target_type)}${f.target_ref ? ` : ${f.target_ref}` : ''}` : 'Signalement général'}</p>{f.description && <p>{f.description}</p>}
          <div className="row">{FEEDBACK_ACTIONS.map(([s, text]) => <button key={s} className="text-button" onClick={() => run(() => api.updateFeedback(f.id, s), () => void list.reload())}>{text}</button>)}</div>
        </Card>
      ))}
      {!list.loading && !(list.data?.data ?? []).length && <p className="empty-state">Aucun signalement.</p>}
    </>
  );
}

function AssistantPanel({ api }: { api: Api }) {
  const st = useAsync(() => api.assistant(), []);
  const { msg, run } = useAction();
  const on = st.data?.data.enabled_switch;
  return (
    <Card>
      <Head title="Interrupteur d’arrêt de l’assistant" badge={<Pill status={on ? 'verified' : 'withdrawn'} text={on ? 'Activé' : 'Désactivé'} />} />
      <p className="muted small">Fournisseur IA : {st.data?.data.provider_configured ? 'configuré' : 'non configuré (l’assistant affiche des extraits validés)'}.</p>
      <p className="muted small">Désactivé, l’assistant répond « indisponible » ; la bibliothèque et l’orientation de sécurité restent accessibles.</p>
      <Err msg={msg || st.error} />
      <button className={`button ${on ? 'secondary' : 'primary'}`} onClick={() => run(() => api.setAssistant(!on), () => void st.reload())}>{on ? 'Désactiver l’assistant' : 'Réactiver l’assistant'}</button>
    </Card>
  );
}

function UsersPanel({ api }: { api: Api }) {
  const list = useAsync(() => api.users(), []);
  const { msg, run } = useAction();
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    await run(() => api.createUser({ name: f.get('name'), email: f.get('email'), password: f.get('password'), role: f.get('role') }), () => { form.reset(); void list.reload(); });
  };
  return (
    <>
      <form className="question-form" onSubmit={create}>
        <h2>Inviter un utilisateur</h2>
        <input name="name" placeholder="Nom" required /><input name="email" type="email" placeholder="E-mail" required />
        <input name="password" type="password" minLength={12} placeholder="Mot de passe provisoire (12 car. min.)" required autoComplete="new-password" />
        <select name="role">{['editor', 'medical_reviewer', 'content_admin', 'service_verifier', 'auditor', 'super_admin'].map((r) => <option key={r} value={r}>{label(ROLES, r)}</option>)}</select>
        <button className="button primary">Créer</button>
      </form>
      <Err msg={msg || list.error} />
      {(list.data ?? []).map((u) => (
        <Card key={u.id}><Head title={u.name} badge={<Pill status={u.is_active ? 'verified' : 'withdrawn'} text={u.is_active ? 'Actif' : 'Suspendu'} />} meta={`${u.email} · ${label(ROLES, u.role)}`} />
          <button className="text-button" onClick={() => run(() => api.updateUser(u.id, { is_active: !u.is_active }), () => void list.reload())}>{u.is_active ? 'Suspendre' : 'Réactiver'}</button></Card>
      ))}
    </>
  );
}

type Reports = {
  period_days: number;
  content: Record<'published' | 'in_review' | 'due_for_review' | 'blocked_by_source', number>;
  sources: Record<'to_verify' | 'approved', number>;
  services: Record<'verified' | 'to_revalidate', number>;
  feedback: Record<'open' | 'critical_open', number>;
  assistant_modes_30d: { mode: string; total: number | null }[];
};

/** [clé, libellé, true si une valeur > 0 demande une action] */
const REPORT_GROUPS: { key: keyof Omit<Reports, 'period_days' | 'assistant_modes_30d'>; title: string; items: [string, string, boolean][] }[] = [
  { key: 'content', title: 'Contenus', items: [['published', 'Publiés et visibles', false], ['in_review', 'En revue', false], ['due_for_review', 'Révision échue', true], ['blocked_by_source', 'Bloqués par une source', true]] },
  { key: 'sources', title: 'Sources', items: [['approved', 'Approuvées et utilisables', false], ['to_verify', 'À vérifier', false]] },
  { key: 'services', title: 'Services de santé', items: [['verified', 'Vérifiés et publics', false], ['to_revalidate', 'À revérifier', true]] },
  { key: 'feedback', title: 'Signalements', items: [['open', 'Ouverts', false], ['critical_open', 'Critiques ouverts', true]] },
];
const MODE_LABELS: Record<string, string> = {
  ai_grounded: 'Réponses rédigées par l’IA', corpus_only: 'Extraits validés', safety_redirect: 'Orientations de sécurité', unavailable: 'Assistant indisponible',
};

function ReportsPanel({ api }: { api: Api }) {
  const r = useAsync(() => api.reports(), []);
  const d = r.data?.data as unknown as Reports | undefined;
  return (
    <>
      <Err msg={r.error} />
      <Loading on={r.loading} />
      {d && (
        <>
          <p className="muted small">Indicateurs agrégés : aucune question ni donnée individuelle. Les effectifs de l’assistant inférieurs à 5 sont masqués.</p>
          {REPORT_GROUPS.map((g) => (
            <section key={g.key}>
              <h2 className="section-title">{g.title}</h2>
              <div className="stat-grid">
                {g.items.map(([k, text, watch]) => {
                  const value = (d[g.key] as Record<string, number>)[k] ?? 0;
                  return <Stat key={k} label={text} value={value} tone={watch && value > 0 ? 'alert' : undefined} />;
                })}
              </div>
            </section>
          ))}
          <section>
            <h2 className="section-title">Assistant IA : {d.period_days} derniers jours</h2>
            {d.assistant_modes_30d.length ? (
              <div className="stat-grid">
                {d.assistant_modes_30d.map((m) => <Stat key={m.mode} label={label(MODE_LABELS, m.mode)} value={m.total ?? '< 5'} hint={m.total === null ? 'Effectif masqué' : undefined} />)}
              </div>
            ) : <p className="empty-state">Aucune question posée à l’assistant sur la période.</p>}
          </section>
        </>
      )}
    </>
  );
}

type AuditRow = { id: number; action: string; entity_type: string; entity_id?: number | null; user_id?: number | null; created_at: string; metadata?: Record<string, unknown> | null };

const ACTIONS: Record<string, string> = {
  'auth.login': 'Connexion',
  'content.created': 'Contenu créé', 'content.updated': 'Contenu modifié', 'content.submitted': 'Contenu soumis à revue',
  'content.reviewed': 'Contenu relu', 'content.published': 'Contenu publié', 'content.withdrawn': 'Contenu retiré',
  'source.created': 'Source ajoutée', 'source.updated': 'Source modifiée', 'source.validated': 'Source validée',
  'service.created': 'Fiche de service créée', 'service.updated': 'Fiche de service modifiée', 'service.verified': 'Service vérifié', 'service.withdrawn': 'Service retiré',
  'feedback.updated': 'Signalement mis à jour', 'assistant.switched': 'Interrupteur de l’assistant',
  'user.created': 'Utilisateur créé', 'user.updated': 'Utilisateur modifié',
};
const ENTITIES: Record<string, string> = { content_item: 'Contenu', source: 'Source', health_service: 'Service', feedback_report: 'Signalement', setting: 'Paramètre', user: 'Utilisateur' };
const DECISIONS: Record<string, string> = { approved: 'approuvé', changes_requested: 'corrections demandées', rejected: 'rejeté' };

function auditDetails(m?: Record<string, unknown> | null): string {
  if (!m) return '—';
  const parts = Object.entries(m).map(([k, v]) => {
    const text = String(v);
    switch (k) {
      case 'version': return `version ${text}`;
      case 'decision': return `décision : ${label(DECISIONS, text)}`;
      case 'role': return `rôle : ${label(ROLES, text)}`;
      case 'result': return `résultat : ${text === 'ok' ? 'réussi' : text === 'failed' ? 'échec' : text}`;
      case 'enabled': return v ? 'activé' : 'désactivé';
      case 'status': return `état : ${SOURCE_STATUS[text] ?? FEEDBACK_STATUS[text] ?? SERVICE_STATUS[text] ?? text}`;
      default: return `${k} : ${text}`;
    }
  });
  return parts.length ? parts.join(' · ') : '—';
}

function AuditPanel({ api }: { api: Api }) {
  const a = useAsync(() => api.audit(), []);
  const rows = (a.data?.data ?? []) as AuditRow[];
  return (
    <>
      <Err msg={a.error} />
      <Loading on={a.loading} />
      <p className="muted small">Actions sensibles les plus récentes (50 maximum). Aucun mot de passe, jeton ni question de santé n’est enregistré.</p>
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Action</th><th>Objet</th><th>Détails</th><th>Utilisateur</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>{fmt(l.created_at, true)}</td>
                  <td><strong>{label(ACTIONS, l.action)}</strong></td>
                  <td>{label(ENTITIES, l.entity_type)}{l.entity_id != null ? ` n° ${l.entity_id}` : ''}</td>
                  <td>{auditDetails(l.metadata)}</td>
                  <td>{l.user_id != null ? `n° ${l.user_id}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !a.loading && <p className="empty-state">Aucune action enregistrée.</p>}
    </>
  );
}
