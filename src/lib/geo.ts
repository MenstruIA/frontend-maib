export interface LatLng { lat: number; lng: number }

/** Centre et emprise approximatifs du Bénin (carte et contrôle des positions). */
export const BENIN_CENTER: LatLng = { lat: 9.3, lng: 2.3 };
export const BENIN_BOUNDS: [[number, number], [number, number]] = [[5.8, 0.6], [12.6, 4.0]];

export const insideBenin = (p: LatLng): boolean =>
  p.lat >= BENIN_BOUNDS[0][0] && p.lat <= BENIN_BOUNDS[1][0] && p.lng >= BENIN_BOUNDS[0][1] && p.lng <= BENIN_BOUNDS[1][1];

/** Distance à vol d'oiseau en kilomètres (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

export const roundCoord = (value: number, decimals: number): number => Number(value.toFixed(decimals));

/** Lien d'itinéraire OpenStreetMap (sans service tiers de suivi). Départ facultatif. */
export function directionsUrl(to: LatLng, from?: LatLng | null): string {
  const point = (p: LatLng) => `${p.lat.toFixed(6)}%2C${p.lng.toFixed(6)}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from ? point(from) : ''}%3B${point(to)}`;
}
