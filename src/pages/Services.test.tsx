import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// La carte Leaflet a besoin d'un vrai navigateur : on la remplace par une version simplifiée qui expose ses propriétés.
vi.mock('../components/ServicesMap', () => ({
  default: ({ places, selectedId, onSelect, center, userPos }: {
    places: { id: string; name: string; verified: boolean; lat: number | null }[]; selectedId: string | null; onSelect: (id: string) => void;
    center: { lat: number } | null; userPos: { lat: number } | null;
  }) => (
    <div data-testid="map" data-center={center ? 'oui' : 'non'} data-user={userPos ? 'oui' : 'non'} data-selected={selectedId ?? ''}>
      {places.filter((p) => p.lat != null).map((p) => (
        <button key={p.id} data-testid={`marker-${p.verified ? 'verifie' : 'osm'}`} onClick={() => onSelect(p.id)}>marqueur {p.name}</button>
      ))}
    </div>
  ),
}));

import { Services } from './Services';

const verifiedService = (over = {}) => ({
  id: 7, name: 'Pharmacie Vérifiée', service_type: 'pharmacie', city: 'Cotonou', region: 'Littoral', phone: '+229 01 02 03 04',
  opening_hours: '08:00-20:00', latitude: 6.3654, longitude: 2.3912, verified_at: '2026-11-02', ...over,
});
const osmItem = (over = {}) => ({
  id: 'osm:node/1', kind: 'pharmacy', name: 'Pharmacie Communautaire', latitude: 6.366, longitude: 2.392, phone: null, opening_hours: 'Mo-Su 08:00-22:00',
  address: 'Rue 12', website: null, osm_url: 'https://www.openstreetmap.org/node/1', ...over,
});
const paged = (data: unknown[]) => ({ data, current_page: 1, last_page: 1, total: data.length });

type Call = { url: string };
function mockApi(opts: { geo?: unknown[]; nearbyFails?: boolean } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    calls.push({ url: u });
    const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
    if (u.includes('/places/search')) return json({ data: opts.geo ?? [{ name: 'Vodokpo, Cotonou, Littoral, Bénin', latitude: 6.3654, longitude: 2.3912, type: 'suburb', bbox: null }] });
    if (u.includes('/places/nearby')) return opts.nearbyFails ? json({ error: { code: 'places_unavailable' } }, 503) : json({ data: [osmItem()], meta: {} });
    if (u.includes('lat=')) return json(paged([{ ...verifiedService(), distance_km: 0.1 }]));
    return json(paged([verifiedService({ latitude: null, longitude: null, name: 'Fiche sans position' })]));
  }));
  return calls;
}

describe('Centres de santé : recherche et carte', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('« Pharmacie à Vodokpo » localise le lieu, affiche vérifiés et OpenStreetMap avec leur statut', async () => {
    const calls = mockApi();
    render(<Services />);
    await screen.findByText('Fiche sans position'); // vue d'ensemble initiale (fiches vérifiées)

    fireEvent.change(screen.getByLabelText(/rechercher un établissement/i), { target: { value: 'Pharmacie à Vodokpo' } });
    fireEvent.click(screen.getByRole('button', { name: /^rechercher$/i }));

    await screen.findByText('Pharmacie Communautaire');
    expect(calls.some((c) => c.url.includes('/places/search') && c.url.includes('q=Vodokpo'))).toBe(true);
    // Le centre de recherche OpenStreetMap est arrondi à 2 décimales (≈ 1 km), la fiche vérifiée à 3.
    expect(calls.find((c) => c.url.includes('/places/nearby'))?.url).toMatch(/lat=6\.37&lng=2\.39/);
    expect(calls.find((c) => c.url.includes('/services?lat='))?.url).toMatch(/lat=6\.365&lng=2\.391/);

    const list = document.querySelector('.places-list') as HTMLElement;
    expect(within(list).getByText('Pharmacie Vérifiée')).toBeInTheDocument();
    expect(within(list).getByText(/Non vérifié · OpenStreetMap/)).toBeInTheDocument();
    expect(within(list).getByText(/Vérifié le 2026-11-02/)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/marqueurs gris : non vérifiés/i);
    expect(screen.getByTestId('map')).toHaveAttribute('data-center', 'oui');
    expect(screen.getAllByTestId(/marker-/).length).toBe(2);
  });

  it('un clic sur un marqueur ou une carte affiche la fiche détaillée avec téléphone, horaires et itinéraire', async () => {
    mockApi();
    render(<Services />);
    fireEvent.change(screen.getByLabelText(/rechercher un établissement/i), { target: { value: 'pharmacie Vodokpo' } });
    fireEvent.click(screen.getByRole('button', { name: /^rechercher$/i }));
    await screen.findByText('Pharmacie Communautaire');

    fireEvent.click(screen.getByTestId('marker-verifie'));

    const details = document.querySelector('.place-details') as HTMLElement;
    expect(within(details).getByText('Pharmacie Vérifiée')).toBeInTheDocument();
    expect(within(details).getByRole('link', { name: '+229 01 02 03 04' })).toHaveAttribute('href', 'tel:+229010203 04'.replace(' ', ''));
    expect(within(details).getByText('08:00-20:00')).toBeInTheDocument();
    expect(within(details).getByRole('link', { name: /itinéraire/i }).getAttribute('href')).toContain('openstreetmap.org/directions');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', 'menstruai:7');

    fireEvent.click(screen.getByTestId('marker-osm'));
    const osmDetails = document.querySelector('.place-details') as HTMLElement;
    expect(within(osmDetails).getByText(/n’a pas été vérifiée par MenstruAI/)).toBeInTheDocument();
  });

  it('continue à afficher les fiches vérifiées si OpenStreetMap est indisponible', async () => {
    mockApi({ nearbyFails: true });
    render(<Services />);
    fireEvent.change(screen.getByLabelText(/rechercher un établissement/i), { target: { value: 'pharmacie Vodokpo' } });
    fireEvent.click(screen.getByRole('button', { name: /^rechercher$/i }));

    await screen.findByText(/OpenStreetMap ne sont pas disponibles/i);
    expect(screen.getAllByText('Pharmacie Vérifiée').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pharmacie Communautaire')).not.toBeInTheDocument();
  });

  it('désactiver OpenStreetMap n’interroge pas le service externe', async () => {
    const calls = mockApi();
    render(<Services />);
    fireEvent.click(screen.getByLabelText(/inclure openstreetmap/i));
    fireEvent.change(screen.getByLabelText(/rechercher un établissement/i), { target: { value: 'Vodokpo' } });
    fireEvent.click(screen.getByRole('button', { name: /^rechercher$/i }));

    await waitFor(() => expect(calls.some((c) => c.url.includes('/services?lat='))).toBe(true));
    expect(calls.some((c) => c.url.includes('/places/nearby'))).toBe(false);
  });

  it('lieu introuvable : message clair et repli sur les fiches vérifiées par nom', async () => {
    const calls = mockApi({ geo: [] });
    render(<Services />);
    fireEvent.change(screen.getByLabelText(/rechercher un établissement/i), { target: { value: 'pharmacie Quartierinconnu' } });
    fireEvent.click(screen.getByRole('button', { name: /^rechercher$/i }));

    await screen.findByText(/introuvable au Bénin/i);
    expect(calls.some((c) => c.url.includes('/places/nearby'))).toBe(false);
  });

  it('« Autour de moi » utilise la position, la garde en mémoire et n’envoie qu’une zone arrondie', async () => {
    const calls = mockApi();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 6.365412, longitude: 2.391287 } }),
    } });
    render(<Services />);

    fireEvent.click(screen.getByRole('button', { name: /autour de moi/i }));

    await screen.findByText('Pharmacie Communautaire');
    expect(screen.getByTestId('map')).toHaveAttribute('data-user', 'oui');
    const nearby = calls.find((c) => c.url.includes('/places/nearby'))?.url ?? '';
    expect(nearby).toMatch(/lat=6\.37&lng=2\.39/);
    expect(nearby).not.toContain('6.365412');
    expect((screen.getByLabelText(/rechercher un établissement/i) as HTMLInputElement).value).toBe(''); // jamais écrite dans le champ
  });

  it('géolocalisation refusée : message explicite, aucune requête de proximité', async () => {
    const calls = mockApi();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }),
    } });
    render(<Services />);

    fireEvent.click(screen.getByRole('button', { name: /autour de moi/i }));

    await screen.findByText(/localisation est refusée/i);
    expect(calls.some((c) => c.url.includes('/places/nearby'))).toBe(false);
  });

  it('une position hors du Bénin est refusée sans requête externe', async () => {
    const calls = mockApi();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 48.85, longitude: 2.35 } }),
    } });
    render(<Services />);

    fireEvent.click(screen.getByRole('button', { name: /autour de moi/i }));

    await screen.findByText(/hors du Bénin/i);
    expect(calls.some((c) => c.url.includes('/places/nearby'))).toBe(false);
  });

  it('les onglets Liste et Carte basculent l’affichage (mobile)', async () => {
    mockApi();
    render(<Services />);
    await screen.findByText('Fiche sans position');
    const layout = document.querySelector('.places-layout') as HTMLElement;
    expect(layout).toHaveAttribute('data-view', 'list');
    fireEvent.click(screen.getByRole('tab', { name: /carte/i }));
    expect(layout).toHaveAttribute('data-view', 'map');
    fireEvent.click(screen.getByRole('tab', { name: /liste/i }));
    expect(layout).toHaveAttribute('data-view', 'list');
  });
});
