import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceKm, formatDistance, insideBenin, roundCoord } from './geo';

describe('geo', () => {
  it('calcule la distance Cotonou – Parakou (≈ 332 km)', () => {
    const d = distanceKm({ lat: 6.3654, lng: 2.3912 }, { lat: 9.34, lng: 2.63 });
    expect(d).toBeGreaterThan(328);
    expect(d).toBeLessThan(336);
  });
  it('distance nulle pour un même point', () => {
    expect(distanceKm({ lat: 6.37, lng: 2.39 }, { lat: 6.37, lng: 2.39 })).toBe(0);
  });
  it('formate les distances', () => {
    expect(formatDistance(0.35)).toBe('350 m');
    expect(formatDistance(2.43)).toBe('2,4 km');
    expect(formatDistance(48.7)).toBe('49 km');
  });
  it('reconnaît les positions au Bénin', () => {
    expect(insideBenin({ lat: 6.37, lng: 2.39 })).toBe(true);
    expect(insideBenin({ lat: 48.85, lng: 2.35 })).toBe(false);
  });
  it('arrondit les coordonnées (confidentialité de la position)', () => {
    expect(roundCoord(6.365412, 2)).toBe(6.37);
    expect(roundCoord(2.391287, 3)).toBe(2.391);
  });
  it('construit un lien d’itinéraire OpenStreetMap avec ou sans départ', () => {
    expect(directionsUrl({ lat: 6.37, lng: 2.39 })).toContain('route=%3B6.370000%2C2.390000');
    expect(directionsUrl({ lat: 6.37, lng: 2.39 }, { lat: 6.4, lng: 2.4 })).toContain('route=6.400000%2C2.400000%3B6.370000%2C2.390000');
  });
});
