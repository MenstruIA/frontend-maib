import { useState } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import {
  EMPTY, addPeriod, addSymptom, clear, load, removePeriod, save,
  summarize, toISO, type CycleData,
} from '../lib/cycle';

const SYMPTOMS = ['Douleurs', 'Fatigue', 'Maux de tête', 'Saignements abondants', 'Humeur changeante'];

const PATTERN = {
  regular: { label: 'Plutôt régulier', tone: 'b-published' },
  variable: { label: 'Variable', tone: 'b-draft' },
  insufficient: { label: 'À compléter', tone: 'b-draft' },
} as const;

function formatCycleDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function Cycle({ go }: { go: (to: string) => void }) {
  const [data, setData] = useState<CycleData>(load);
  const [date, setDate] = useState(toISO(new Date()));
  const [saved, setSaved] = useState(true);
  const s = summarize(data);

  const update = (next: CycleData) => {
    setData(next);
    setSaved(save(next));
  };

  const wipe = () => {
    if (window.confirm('Effacer toutes les données du suivi sur cet appareil ?')) {
      clear();
      setData({ ...EMPTY });
      setSaved(true);
    }
  };

  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const countdown = s.daysUntilNext == null
    ? null
    : s.daysUntilNext > 1
      ? `dans ${s.daysUntilNext} jours`
      : s.daysUntilNext === 1
        ? 'demain'
        : s.daysUntilNext === 0
          ? 'aujourd’hui'
          : `retard estimé de ${plural(Math.abs(s.daysUntilNext), 'jour')}`;

  return (
    <section className="page-section">
      <span className="eyebrow">Suivi du cycle</span>
      <h1 className="page-title">Mon cycle</h1>
      <div className="safety-callout">
        <Lock size={18} />
        <span>Ces données restent <strong>uniquement sur cet appareil</strong> : elles ne sont jamais envoyées à MenstruAI. Attention si le téléphone est partagé. Les dates proposées sont des estimations indicatives, pas un avis médical.</span>
      </div>
      {!saved && <div className="notice error" role="alert">Impossible d’enregistrer sur cet appareil (stockage indisponible).</div>}

      {s.lastPeriod ? (
        <div className="cycle-card">
          <div className="card-head">
            <h2>Mon cycle menstruel</h2>
            <span className={`badge ${PATTERN[s.pattern].tone}`} aria-live="polite">{PATTERN[s.pattern].label}</span>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-label">Jours écoulés</span>
              <strong className="stat-value">{s.dayOfCycle}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Dernières règles</span>
              <strong className="stat-value">{formatCycleDate(s.lastPeriod)}</strong>
            </div>
            <div className="stat">
              <span className="stat-label">Prochaines règles estimées</span>
              {s.nextEstimate ? (
                <>
                  <strong className="stat-value">{formatCycleDate(s.nextEstimate)}</strong>
                  {countdown && <span className="stat-hint">{countdown}</span>}
                </>
              ) : (
                <span className="stat-hint">Ajoutez d’autres dates de début de règles pour obtenir une estimation.</span>
              )}
            </div>
          </div>
          <p className="muted small">
            {s.pattern === 'insufficient'
              ? 'Les estimations seront affinées au fil des dates que vous enregistrez.'
              : `Estimation calculée à partir de ${plural(s.intervalsCount, 'cycle')} enregistré${s.intervalsCount > 1 ? 's' : ''}.`}
            {' '}Les dates restent indicatives et peuvent varier.
          </p>
        </div>
      ) : (
        <p className="empty-state">Aucune donnée pour le moment. Enregistrez le début de vos règles pour commencer votre suivi.</p>
      )}

      <div className="question-form">
        <label htmlFor="period-date">Début de mes règles</label>
        <input id="period-date" type="date" value={date} max={toISO(new Date())} onChange={(e) => setDate(e.target.value)} />
        <button className="button primary" onClick={() => date && update(addPeriod(data, date))}>Ajouter cette date</button>
        <label>Symptôme du {date}</label>
        <div className="chips">{SYMPTOMS.map((x) => <button key={x} className="chip" onClick={() => date && update(addSymptom(data, date, x))}>{x}</button>)}</div>
        {(data.symptoms[date] ?? []).length > 0 && <p className="muted small">Notés ce jour : {data.symptoms[date].join(', ')}</p>}
      </div>

      {data.periods.length > 0 && (
        <ul className="period-list">
          {[...data.periods].reverse().map((p) => <li key={p}>{formatCycleDate(p)} <button className="text-button" onClick={() => update(removePeriod(data, p))}>Retirer</button></li>)}
        </ul>
      )}
      <p className="muted small">Règles très abondantes, douleurs qui empêchent vos activités ou retard inhabituel : parlez-en à un professionnel de santé. <button className="text-button" onClick={() => go('/centres')}>Trouver un centre</button></p>
      <button className="button secondary" onClick={wipe}><Trash2 size={15} /> Effacer mes données</button>
    </section>
  );
}
