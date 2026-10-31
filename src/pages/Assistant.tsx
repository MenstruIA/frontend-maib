import { useState, type FormEvent } from 'react';
import { AlertTriangle, ChevronRight, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import type { AssistantAnswer } from '../types';
import { Sources } from '../components/Sources';
import { ReportButton } from '../components/FeedbackDialog';

interface Turn { question: string; answer: AssistantAnswer }

export function Assistant({ go }: { go: (to: string) => void }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]); // en mémoire uniquement : rien n'est conservé après fermeture
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3) { setError('Saisissez une question d’au moins trois caractères.'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.ask(q);
      setTurns((t) => [...t, { question: q, answer: r.data }]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'L’assistant est indisponible.');
    } finally { setLoading(false); }
  }

  return (
    <section className="page-section assistant-page">
      <div className="assistant-heading">
        <img className="assistant-avatar-img" src="/images/assistant-avatar.png" alt="" width={56} height={56} />
        <div><span className="eyebrow">Assistant éducatif</span><h1 className="page-title">Quelle est votre question ?</h1></div>
      </div>
      <div className="safety-callout"><ShieldCheck size={18} /><span>Information générale, pas un diagnostic. La réponse repose sur des contenus validés. N’écrivez pas votre nom ni d’informations qui permettent de vous identifier. MenstruAI n’enregistre pas votre question. Si la rédaction automatique est activée, le texte est transmis temporairement à un fournisseur d’IA (voir Confidentialité).</span></div>

      <div className="chat" aria-live="polite">
        {turns.map((t, i) => (
          <div key={t.answer.request_id + i} className="turn">
            <div className="bubble user">{t.question}</div>
            <Answer a={t.answer} go={go} />
          </div>
        ))}
      </div>

      <form className="question-form" onSubmit={ask}>
        <label htmlFor="question">Votre question</label>
        <textarea id="question" maxLength={1000} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Écrivez votre question ici…" />
        <div className="form-bottom"><span>{question.length}/1000</span>
          <button className="button primary" disabled={loading}>{loading ? 'Recherche…' : 'Envoyer'} <ChevronRight size={17} /></button></div>
      </form>
      {error && <div className="notice error" role="alert">{error}</div>}
    </section>
  );
}

function Answer({ a, go }: { a: AssistantAnswer; go: (to: string) => void }) {
  if (a.mode === 'safety_redirect') {
    return (
      <div className="bubble bot urgent" role="alert">
        <div className="answer-status"><AlertTriangle size={17} /><strong>Besoin d’une aide rapide</strong></div>
        <p>{a.message}</p>
        <button className="button primary" onClick={() => go('/centres')}>Voir les centres de santé vérifiés</button>
        <ReportButton targetType="assistant" targetRef={a.request_id} />
      </div>
    );
  }
  const label = a.mode === 'ai_grounded' ? 'Réponse générée à partir de contenus validés'
    : a.mode === 'corpus_only' ? (a.abstained ? 'Réponse prudente' : 'Extraits de contenus validés')
    : 'Assistant indisponible';
  return (
    <div className="bubble bot">
      <div className="answer-status"><ShieldCheck size={17} /><span>{label}</span></div>
      <p>{a.message}</p>
      {a.matches.map((m) => (
        <article className="match-card" key={m.slug}>
          <h3>{m.title}</h3><p>{m.excerpt}</p>
          {m.reviewed_at && <p className="muted small">Revu le {m.reviewed_at}</p>}
          <Sources sources={m.sources} />
        </article>
      ))}
      {a.mode === 'ai_grounded' && a.citations.length > 0 && <Sources sources={a.citations} />}
      <p className="answer-footnote">{a.disclaimer}</p>
      <ReportButton targetType="assistant" targetRef={a.request_id} label="Signaler cette réponse" />
      {a.abstained && <button className="text-button" onClick={() => go('/centres')}>Trouver un service de santé</button>}
    </div>
  );
}
