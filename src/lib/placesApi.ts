import { ApiError } from '../api';
import type { HealthService, Paginated } from '../types';
import type { OsmItem } from './placesModel';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

export interface GeoHit {
  name: string; latitude: number; longitude: number; type: string;
  bbox: { south: number; north: number; west: number; east: number } | null;
}

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError('Connexion impossible. Vérifiez votre réseau et réessayez.', 0);
  }
  if (!response.ok) {
    let code = '';
    try { code = ((await response.json()) as { error?: { code?: string } }).error?.code ?? ''; } catch { /* corps non JSON */ }
    if (response.status === 429) throw new ApiError('Trop de demandes en peu de temps. Réessayez dans un instant.', 429);
    throw new ApiError(code || 'Service indisponible.', response.status);
  }
  return response.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const placesApi = {
  /** Localise un quartier, une commune ou une ville du Bénin. */
  search: (q: string) => get<{ data: GeoHit[] }>(`/places/search${qs({ q })}`),
  /** Établissements OpenStreetMap autour d'un point (NON vérifiés par MenstruAI). */
  nearby: (p: { lat: number; lng: number; radiusKm?: number }) =>
    get<{ data: OsmItem[]; meta?: { notice?: string } }>(`/places/nearby${qs({ lat: p.lat, lng: p.lng, radius_km: p.radiusKm })}`),
  /** Fiches vérifiées par MenstruAI, triées par distance. */
  servicesNear: (p: { lat: number; lng: number; radiusKm?: number }) =>
    get<Paginated<HealthService & { distance_km?: number }>>(`/services${qs({ lat: p.lat, lng: p.lng, radius_km: p.radiusKm })}`),
  /** Fiches vérifiées sans position de référence (recherche par texte et par type). */
  verified: (p: { q?: string; types?: string }) =>
    get<Paginated<HealthService>>(`/services${qs({ q: p.q, type: p.types, per_page: 30 })}`),
};
