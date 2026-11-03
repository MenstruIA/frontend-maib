import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Assistant } from './Assistant';

const answer = (over: Record<string, unknown> = {}) => ({
  data: {
    request_id: 'r1', mode: 'corpus_only', message: 'Je ne trouve pas de contenu validé.', matches: [], citations: [],
    abstained: true, disclaimer: 'Information générale.', ...over,
  },
});

function mockAsk(handler: (question: string) => unknown | Promise<unknown>) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { question?: string };
    const result = await handler(body.question ?? '');
    if (result instanceof Error) throw result;
    return { ok: true, status: 200, json: async () => result } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const field = () => screen.getByLabelText(/votre question/i) as HTMLTextAreaElement;

describe('Assistant (interface de conversation)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('affiche des questions suggérées et envoie celle qu’on choisit', async () => {
    const fetchMock = mockAsk(() => answer());
    render(<Assistant go={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: /douleurs pendant les règles/i }));

    await waitFor(() => expect(screen.getByText(/ne trouve pas de contenu validé/i)).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).question).toMatch(/douleurs pendant les règles/);
    expect(screen.queryByText(/comment puis-je vous aider/i)).not.toBeInTheDocument(); // l'écran d'accueil disparaît
  });

  it('Entrée envoie, Maj+Entrée n’envoie pas', async () => {
    const fetchMock = mockAsk(() => answer());
    render(<Assistant go={() => undefined} />);

    fireEvent.change(field(), { target: { value: 'hygiène menstruelle' } });
    fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(field(), { key: 'Enter' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(field().value).toBe(''); // le champ est vidé après l'envoi
  });

  it('le bouton Envoyer reste désactivé tant que la question fait moins de trois caractères', () => {
    render(<Assistant go={() => undefined} />);
    const send = screen.getByRole('button', { name: /^envoyer$/i });
    expect(send).toBeDisabled();
    fireEvent.change(field(), { target: { value: 'ab' } });
    expect(send).toBeDisabled();
    fireEvent.change(field(), { target: { value: 'abc' } });
    expect(send).toBeEnabled();
  });

  it('propose de réessayer après une erreur, puis affiche la réponse', async () => {
    let calls = 0;
    mockAsk(() => (++calls === 1 ? new Error('réseau coupé') : answer({ message: 'Réponse après nouvel essai.' })));
    render(<Assistant go={() => undefined} />);

    fireEvent.change(field(), { target: { value: 'règles irrégulières' } });
    fireEvent.click(screen.getByRole('button', { name: /^envoyer$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /réessayer/i }));

    await waitFor(() => expect(screen.getByText(/réponse après nouvel essai/i)).toBeInTheDocument());
    expect(screen.getAllByText('règles irrégulières')).toHaveLength(1); // la question n'est pas dupliquée
  });

  it('« Nouvelle » efface la conversation affichée', async () => {
    mockAsk(() => answer());
    render(<Assistant go={() => undefined} />);

    expect(screen.getByRole('button', { name: /nouvelle conversation/i })).toBeDisabled();
    fireEvent.change(field(), { target: { value: 'puberté' } });
    fireEvent.click(screen.getByRole('button', { name: /^envoyer$/i }));
    await screen.findByText(/ne trouve pas de contenu validé/i);

    fireEvent.click(screen.getByRole('button', { name: /nouvelle conversation/i }));
    expect(screen.getByText(/comment puis-je vous aider/i)).toBeInTheDocument();
  });

  it('copie la réponse dans le presse-papiers', async () => {
    mockAsk(() => answer({ message: 'Texte à copier.' }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Assistant go={() => undefined} />);

    fireEvent.change(field(), { target: { value: 'cycle menstruel' } });
    fireEvent.click(screen.getByRole('button', { name: /^envoyer$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /copier la réponse/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Texte à copier.'));
  });
});

describe('Assistant — dictée vocale', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.unstubAllGlobals(); delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; });

  it('masque le micro quand le navigateur ne gère pas la dictée', () => {
    render(<Assistant go={() => undefined} />);
    expect(screen.queryByRole('button', { name: /dicter ma question/i })).not.toBeInTheDocument();
  });

  it('demande un consentement explicite, puis dicte dans le champ sans envoyer automatiquement', async () => {
    const instances: { onresult: (e: unknown) => void; start: () => void; stop: () => void; abort: () => void; onend: () => void; lang: string }[] = [];
    class FakeRecognition {
      lang = ''; interimResults = false; continuous = false;
      onresult: (e: unknown) => void = () => undefined; onerror = () => undefined; onend: () => void = () => undefined;
      start = vi.fn(); stop = vi.fn(() => this.onend()); abort = vi.fn();
      constructor() { instances.push(this as never); }
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const fetchMock = mockAsk(() => answer());
    render(<Assistant go={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: /dicter ma question/i }));
    // Avant tout démarrage : explication claire de ce que fait le navigateur.
    const dialog = screen.getByRole('dialog', { name: /dictée vocale/i });
    expect(within(dialog).getByText(/service tiers/i)).toBeInTheDocument();
    expect(instances).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: /activer la dictée/i }));
    expect(instances).toHaveLength(1);
    expect(instances[0].lang).toBe('fr-FR');

    instances[0].onresult({ results: [{ 0: { transcript: 'douleurs pendant les règles' }, isFinal: true, length: 1 }] });
    await waitFor(() => expect(field().value).toBe('douleurs pendant les règles'));
    expect(fetchMock).not.toHaveBeenCalled(); // la dictée ne déclenche jamais l'envoi

    fireEvent.click(screen.getByRole('button', { name: /arrêter la dictée/i }));
    expect(screen.getByRole('button', { name: /dicter ma question/i })).toBeInTheDocument();
  });

  it('annuler le consentement ne démarre pas la dictée', () => {
    const start = vi.fn();
    class FakeRecognition { lang = ''; interimResults = false; continuous = false; onresult = () => undefined; onerror = () => undefined; onend = () => undefined; start = start; stop = vi.fn(); abort = vi.fn(); }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    render(<Assistant go={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: /dicter ma question/i }));
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));

    expect(start).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /dictée vocale/i })).not.toBeInTheDocument();
  });
});
