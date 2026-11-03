import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AlertTriangle, ArrowUp, Check, Copy, MapPin, Mic, Plus, ShieldCheck, Square } from 'lucide-react';
import { api } from '../api';
import type { AssistantAnswer } from '../types';
import { Sources } from '../components/Sources';
import { ReportButton } from '../components/FeedbackDialog';
import { useSpeech } from '../lib/useSpeech';

interface Turn { id: number; question: string; answer?: AssistantAnswer; error?: string }

const SUGGESTIONS = [
  'Est-il normal d’avoir des douleurs pendant les règles ?',
  'Comment bien gérer l’hygiène menstruelle ?',
  'Quels changements arrivent à la puberté ?',
  'Comment fonctionne le cycle menstruel ?',
];
const MAX = 1000;

export function Assistant({ go }: { go: (to: string) => void }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]); // en mémoire uniquement : rien n'est conservé après fermeture
  const [loading, setLoading] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const dictationBase = useRef('');

  const speech = useSpeech((text) => setQuestion(`${dictationBase.current} ${text}`.trim().slice(0, MAX)));

  // Fait défiler vers le dernier message.
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }); }, [turns, loading]);

  // Champ de saisie qui grandit avec le texte (6 lignes maximum).
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [question]);

  async function send(text: string, retryId?: number) {
    const q = text.trim();
    if (q.length < 3 || loading) return;
    if (speech.listening) speech.stop();
    const id = retryId ?? nextId.current++;
    setLoading(true);
    setTurns((t) => retryId ? t.map((x) => (x.id === id ? { ...x, error: undefined } : x)) : [...t, { id, question: q }]);
    if (!retryId) setQuestion('');
    try {
      const r = await api.ask(q);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer: r.data } : x)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'L’assistant est indisponible.';
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: message } : x)));
    } finally { setLoading(false); }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); void send(question); }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée envoie, Maj+Entrée saute une ligne ; on ignore Entrée pendant une composition (clavier mobile, IME).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(question); }
  }

  function toggleVoice() {
    if (speech.listening) { speech.stop(); return; }
    if (!voiceConsent) { setAskConsent(true); return; }
    dictationBase.current = question;
    speech.start();
  }

  function confirmVoice() {
    setVoiceConsent(true); setAskConsent(false);
    dictationBase.current = question;
    speech.start();
  }

  function reset() {
    if (speech.listening) speech.stop();
    setTurns([]); setQuestion(''); fieldRef.current?.focus();
  }

  const empty = turns.length === 0;

  return (
    <section className="chat-page" aria-label="Assistant MenstruAI">
      <header className="chat-head">
        <img className="chat-avatar" src="/images/assistant-avatar.png" alt="" width={44} height={44} />
        <div className="chat-head-text">
          <h1>Assistant MenstruAI</h1>
          <p><span className="live-dot" aria-hidden="true" /> Information éducative · chaque question est traitée séparément</p>
        </div>
        <button type="button" className="chip-button" onClick={reset} disabled={empty} aria-label="Nouvelle conversation">
          <Plus size={16} /> <span>Nouvelle</span>
        </button>
      </header>

      <div className="chat-scroll" aria-live="polite">
        {empty ? (
          <div className="chat-empty">
            <img className="chat-empty-avatar" src="/images/assistant-avatar.png" alt="" width={84} height={84} />
            <h2>Comment puis-je vous aider ?</h2>
            <p className="muted">Posez une question sur les règles, l’hygiène menstruelle ou la puberté. Les réponses s’appuient sur des contenus sourcés ; en cas de doute, l’assistant préfère s’abstenir.</p>
            <div className="suggestions" role="group" aria-label="Questions suggérées">
              {SUGGESTIONS.map((s) => <button key={s} type="button" className="suggestion" onClick={() => void send(s)}>{s}</button>)}
              <button type="button" className="suggestion alt" onClick={() => go('/centres')}><MapPin size={15} /> Trouver un centre de santé</button>
            </div>
            <div className="safety-callout"><ShieldCheck size={18} /><span>Information générale, pas un diagnostic. La réponse repose sur des contenus issus de sources officielles (OMS, UNFPA, IPPF…). N’écrivez pas votre nom ni d’informations qui permettent de vous identifier. MenstruAI n’enregistre pas votre question. Si la rédaction automatique est activée, le texte est transmis temporairement à un fournisseur d’IA (voir Confidentialité).</span></div>
          </div>
        ) : (
          turns.map((t) => (
            <div key={t.id} className="turn">
              <div className="msg user"><div className="bubble user">{t.question}</div></div>
              {t.answer && <Answer a={t.answer} go={go} />}
              {!t.answer && !t.error && loading && <Typing />}
              {t.error && (
                <div className="msg bot"><img className="msg-avatar" src="/images/assistant-avatar.png" alt="" width={32} height={32} />
                  <div className="bubble bot error-bubble" role="alert"><p>{t.error}</p>
                    <button type="button" className="text-button" onClick={() => void send(t.question, t.id)} disabled={loading}>Réessayer</button></div></div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="composer-wrap">
        {askConsent && (
          <div className="voice-consent" role="dialog" aria-label="Dictée vocale">
            <p><strong>Dictée vocale.</strong> La reconnaissance est assurée par votre navigateur : selon le navigateur (par exemple Chrome), l’audio peut être envoyé à un service tiers pour être transcrit. MenstruAI ne reçoit que le texte, comme pour une question écrite.</p>
            <div className="row">
              <button type="button" className="button primary" onClick={confirmVoice}>Activer la dictée</button>
              <button type="button" className="button secondary" onClick={() => setAskConsent(false)}>Annuler</button>
            </div>
          </div>
        )}
        {speech.error && <div className="notice error" role="alert">{speech.error}</div>}
        <form className={`composer ${speech.listening ? 'is-listening' : ''}`} onSubmit={onSubmit}>
          <textarea
            ref={fieldRef} rows={1} maxLength={MAX} value={question} aria-label="Votre question"
            onChange={(e) => setQuestion(e.target.value)} onKeyDown={onKeyDown}
            placeholder={speech.listening ? 'Je vous écoute…' : 'Posez votre question…'}
          />
          <div className="composer-actions">
            {question.length > MAX * 0.8 && <span className="counter" aria-live="off">{question.length}/{MAX}</span>}
            {speech.supported && (
              <button type="button" className={`round mic ${speech.listening ? 'on' : ''}`} onClick={toggleVoice}
                aria-label={speech.listening ? 'Arrêter la dictée' : 'Dicter ma question'} aria-pressed={speech.listening}>
                {speech.listening ? <Square size={16} /> : <Mic size={19} />}
              </button>
            )}
            <button type="submit" className="round send" disabled={loading || question.trim().length < 3} aria-label="Envoyer"><ArrowUp size={19} /></button>
          </div>
        </form>
        <p className="composer-note">MenstruAI peut se tromper et ne remplace pas un professionnel de santé. <button type="button" className="text-button" onClick={() => go('/confidentialite')}>Confidentialité</button></p>
      </div>
    </section>
  );
}

function Typing() {
  return (
    <div className="msg bot" role="status" aria-label="L’assistant rédige une réponse">
      <img className="msg-avatar" src="/images/assistant-avatar.png" alt="" width={32} height={32} />
      <div className="bubble bot typing"><span /><span /><span /></div>
    </div>
  );
}

function Answer({ a, go }: { a: AssistantAnswer; go: (to: string) => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(a.message); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* presse-papiers indisponible */ }
  }

  if (a.mode === 'safety_redirect') {
    return (
      <div className="msg bot">
        <img className="msg-avatar" src="/images/assistant-avatar.png" alt="" width={32} height={32} />
        <div className="bubble bot urgent" role="alert">
          <div className="answer-status urgent-status"><AlertTriangle size={17} /><strong>Besoin d’une aide rapide</strong></div>
          <p>{a.message}</p>
          <button type="button" className="button primary" onClick={() => go('/centres')}>Voir les centres de santé vérifiés</button>
          <ReportButton targetType="assistant" targetRef={a.request_id} />
        </div>
      </div>
    );
  }
  const label = a.mode === 'ai_grounded' ? 'Réponse générée à partir de sources officielles'
    : a.mode === 'corpus_only' ? (a.abstained ? 'Réponse prudente' : 'Extraits de sources officielles')
    : 'Assistant indisponible';
  return (
    <div className="msg bot">
      <img className="msg-avatar" src="/images/assistant-avatar.png" alt="" width={32} height={32} />
      <div className="bubble bot">
        <div className="answer-status"><ShieldCheck size={16} /><span>{label}</span></div>
        <p className="answer-text">{a.message}</p>
        {a.matches.map((m) => (
          <article className="match-card" key={m.slug}>
            <h3>{m.title}</h3><p>{m.excerpt}</p>
            {m.reviewed_at && <p className="muted small">Revu le {m.reviewed_at}</p>}
            <Sources sources={m.sources} />
          </article>
        ))}
        {a.mode === 'ai_grounded' && a.citations.length > 0 && <Sources sources={a.citations} />}
        <p className="answer-footnote">{a.disclaimer}</p>
        <div className="msg-actions">
          <button type="button" className="text-button" onClick={copy} aria-label="Copier la réponse">{copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}</button>
          <ReportButton targetType="assistant" targetRef={a.request_id} label="Signaler cette réponse" />
          {a.abstained && <button type="button" className="text-button" onClick={() => go('/centres')}><MapPin size={14} /> Trouver un service de santé</button>}
        </div>
      </div>
    </div>
  );
}
