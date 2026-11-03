import { useCallback, useEffect, useRef, useState } from 'react';

/** Reconnaissance vocale du navigateur (Web Speech API). Non standardisée : disponible surtout dans Chrome, Edge et Safari. */
interface RecognitionResultLike { 0: { transcript: string }; isFinal: boolean; length: number }
interface RecognitionEventLike { results: ArrayLike<RecognitionResultLike> }
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'L’accès au micro est refusé. Autorisez-le dans votre navigateur pour dicter.',
  'service-not-allowed': 'La dictée vocale est bloquée par votre navigateur.',
  'no-speech': 'Aucune voix détectée. Réessayez en parlant plus près du micro.',
  'audio-capture': 'Aucun micro n’a été trouvé.',
  network: 'La dictée vocale nécessite une connexion et est momentanément indisponible.',
};

/** onText reçoit le texte reconnu depuis le début de la dictée (provisoire, puis final). */
export function useSpeech(onText: (transcript: string) => void, lang = 'fr-FR') {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<RecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => { recognition.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError('');
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onTextRef.current(text.trim());
    };
    rec.onerror = (e) => { setError(ERRORS[e.error] ?? 'La dictée vocale a échoué. Vous pouvez écrire votre question.'); };
    rec.onend = () => { setListening(false); recognition.current = null; };
    recognition.current = rec;
    try { rec.start(); setListening(true); } catch { setError('La dictée vocale n’a pas pu démarrer.'); }
  }, [lang]);

  useEffect(() => () => { recognition.current?.abort(); }, []);

  return { supported, listening, error, start, stop };
}
