import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';

const page = (data: unknown[] = []) => ({ data, current_page: 1, last_page: 1, total: data.length });

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = handler(String(url), init);
    return { ok: true, status: 200, json: async () => body } as Response;
  }));
}

describe('MenstruAI frontend', () => {
  beforeEach(() => { vi.restoreAllMocks(); window.location.hash = '#/'; localStorage.clear(); });

  it('affiche l’accueil et l’avertissement de sécurité', async () => {
    mockFetch(() => page());
    render(<App />);
    expect(screen.getByRole('heading', { name: /une information fiable/i })).toBeInTheDocument();
    expect(screen.getByText(/ne remplace pas un professionnel de santé/i)).toBeInTheDocument();
  });

  it('navigue vers l’assistant et affiche une réponse prudente avec signalement', async () => {
    mockFetch((url) => url.includes('/assistant/ask')
      ? { data: { request_id: 'r1', mode: 'corpus_only', message: 'Je ne trouve pas de contenu validé.', matches: [], citations: [], abstained: true, disclaimer: 'Information générale.' } }
      : page());
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /discuter avec l’ia/i })[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: /quelle est votre question/i })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/votre question/i), { target: { value: 'douleurs règles' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer/i }));
    await waitFor(() => expect(screen.getByText(/ne trouve pas de contenu validé/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /signaler cette réponse/i })).toBeInTheDocument();
  });

  it('met en évidence l’orientation de sécurité', async () => {
    mockFetch((url) => url.includes('/assistant/ask')
      ? { data: { request_id: 'r2', mode: 'safety_redirect', message: 'Rendez-vous sans attendre dans un service de santé.', matches: [], citations: [], abstained: true, disclaimer: '' } }
      : page());
    render(<App />);
    window.location.hash = '#/assistant';
    await waitFor(() => screen.getByLabelText(/votre question/i));
    fireEvent.change(screen.getByLabelText(/votre question/i), { target: { value: 'douleur insupportable' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/aide rapide/i));
  });

  it('envoie un signalement sans données personnelles', async () => {
    const calls: { url: string; body?: string }[] = [];
    mockFetch((url, init) => {
      calls.push({ url, body: init?.body as string | undefined });
      if (url.includes('/feedback')) return { data: { reference: 'abc-123', message: 'ok' } };
      if (url.includes('/assistant/ask')) return { data: { request_id: 'r3', mode: 'corpus_only', message: 'Voici des extraits.', matches: [], citations: [], abstained: true, disclaimer: 'x' } };
      return page();
    });
    render(<App />);
    window.location.hash = '#/assistant';
    await waitFor(() => screen.getByLabelText(/votre question/i));
    fireEvent.change(screen.getByLabelText(/votre question/i), { target: { value: 'question test' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer/i }));
    fireEvent.click(await screen.findByRole('button', { name: /signaler cette réponse/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^envoyer$/i }));
    await waitFor(() => expect(screen.getByText(/abc-123/)).toBeInTheDocument());
    const fb = calls.find((c) => c.url.includes('/feedback'));
    expect(JSON.parse(fb!.body!)).toEqual({ category: 'incorrect_info', target_type: 'assistant', target_ref: 'r3' });
  });

  it('le suivi du cycle indique que les données restent sur l’appareil', async () => {
    mockFetch(() => page());
    render(<App />);
    window.location.hash = '#/cycle';
    await waitFor(() => expect(screen.getByText(/uniquement sur cet appareil/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ajouter cette date/i }));
    expect(localStorage.getItem('menstruai.cycle.v1')).toContain('periods');
  });

  it('affiche un message explicite quand aucun service vérifié n’existe', async () => {
    mockFetch(() => page());
    render(<App />);
    window.location.hash = '#/centres';
    await waitFor(() => expect(screen.getByText(/aucun service vérifié/i)).toBeInTheDocument());
  });

  it('l’administration exige une connexion', async () => {
    mockFetch(() => page());
    render(<App />);
    window.location.hash = '#/admin';
    await waitFor(() => expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument());
  });
  it('propose une sortie rapide accessible sur toutes les pages', () => {
    mockFetch(() => page());
    render(<App />);
    expect(screen.getByRole('button', { name: /quitter rapidement/i })).toBeInTheDocument();
  });

  it('la page confidentialité explique le rôle du fournisseur d’IA et de l’appareil partagé', async () => {
    mockFetch(() => page());
    render(<App />);
    window.location.hash = '#/confidentialite';
    await waitFor(() => expect(screen.getByRole('heading', { name: /assistant et fournisseur d’ia/i })).toBeInTheDocument());
    expect(screen.getByText(/désactivée par défaut/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /appareil partagé/i })).toBeInTheDocument();
  });
});
