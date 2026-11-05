import type { HealthService } from '../types';
import { distanceKm, type LatLng } from './geo';

export type PlaceKind = 'pharmacy' | 'clinic' | 'hospital' | 'centre' | 'other';

export interface MapPlace {
  id: string;
  /** « menstruai » : fiche vérifiée par l'équipe ; « openstreetmap » : donnée communautaire NON vérifiée. */
  source: 'menstruai' | 'openstreetmap';
  verified: boolean;
  kind: PlaceKind;
  name: string;
  lat: number | null;
  lng: number | null;
  phone?: string | null;
  hours?: string | null;
  address?: string | null;
  zone?: string | null;
  region?: string | null;
  verifiedAt?: string | null;
  website?: string | null;
  osmUrl?: string | null;
  serviceId?: number;
  distanceKm?: number;
}

export const KIND_LABELS: Record<PlaceKind, string> = {
  pharmacy: 'Pharmacie', clinic: 'Clinique', hospital: 'Hôpital', centre: 'Centre de santé', other: 'Établissement de santé',
};

/** Types de fiches (backend) correspondant à chaque filtre. */
export const SERVICE_TYPES_FOR_KIND: Record<Exclude<PlaceKind, 'other'>, string> = {
  pharmacy: 'pharmacie',
  clinic: 'clinique,cabinet_de_soins',
  hospital: 'hopital',
  centre: 'centre_de_sante,centre_medical,centre_medical_communautaire',
};

export function kindOfServiceType(type: string): PlaceKind {
  if (type === 'pharmacie') return 'pharmacy';
  if (type === 'hopital') return 'hospital';
  if (type === 'clinique' || type === 'cabinet_de_soins') return 'clinic';
  if (['centre_de_sante', 'centre_medical', 'centre_medical_communautaire'].includes(type)) return 'centre';
  return 'other';
}

export type DistanceService = HealthService & { distance_km?: number };

export function fromService(s: DistanceService): MapPlace {
  return {
    id: `menstruai:${s.id}`, source: 'menstruai', verified: true, kind: kindOfServiceType(s.service_type), name: s.name,
    lat: s.latitude ?? null, lng: s.longitude ?? null, phone: s.phone, hours: s.opening_hours, address: s.address,
    zone: s.city ?? null, region: s.region, verifiedAt: s.verified_at, serviceId: s.id, distanceKm: s.distance_km,
  };
}

export interface OsmItem {
  id: string; kind: PlaceKind; name: string; latitude: number; longitude: number;
  phone?: string | null; opening_hours?: string | null; address?: string | null; website?: string | null; osm_url?: string | null;
}

export function fromOsm(o: OsmItem): MapPlace {
  return {
    id: o.id, source: 'openstreetmap', verified: false, kind: o.kind, name: o.name, lat: o.latitude, lng: o.longitude,
    phone: o.phone, hours: o.opening_hours, address: o.address, website: o.website, osmUrl: o.osm_url,
  };
}

/** Ajoute la distance depuis la référence (position de la personne ou lieu cherché) et trie : plus proche d'abord. */
export function withDistance(places: MapPlace[], reference: LatLng | null): MapPlace[] {
  const enriched = places.map((p) => (reference && p.lat != null && p.lng != null
    ? { ...p, distanceKm: distanceKm(reference, { lat: p.lat, lng: p.lng }) } : { ...p }));
  return enriched.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm || Number(b.verified) - Number(a.verified);
    if (a.distanceKm != null) return -1;
    if (b.distanceKm != null) return 1;
    return Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name, 'fr');
  });
}

export const filterKind = (places: MapPlace[], kind: PlaceKind | ''): MapPlace[] => (kind ? places.filter((p) => p.kind === kind) : places);
export const hasPosition = (p: MapPlace): p is MapPlace & { lat: number; lng: number } => p.lat != null && p.lng != null;
