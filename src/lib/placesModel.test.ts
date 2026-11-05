import { describe, expect, it } from 'vitest';
import { filterKind, fromOsm, fromService, kindOfServiceType, withDistance } from './placesModel';

const service = (over = {}) => ({ id: 1, name: 'Pharmacie Vérifiée', service_type: 'pharmacie', city: 'Cotonou', verified_at: '2026-11-02', latitude: 6.37, longitude: 2.39, ...over });
const osm = (over = {}) => ({ id: 'osm:node/9', kind: 'pharmacy' as const, name: 'Pharmacie OSM', latitude: 6.4, longitude: 2.4, ...over });

describe('placesModel', () => {
  it('associe les types de fiches aux filtres', () => {
    expect(kindOfServiceType('pharmacie')).toBe('pharmacy');
    expect(kindOfServiceType('cabinet_de_soins')).toBe('clinic');
    expect(kindOfServiceType('centre_medical_communautaire')).toBe('centre');
    expect(kindOfServiceType('hopital')).toBe('hospital');
    expect(kindOfServiceType('autre')).toBe('other');
  });

  it('marque les fiches MenstruAI comme vérifiées et celles d’OpenStreetMap comme non vérifiées', () => {
    expect(fromService(service())).toMatchObject({ source: 'menstruai', verified: true, kind: 'pharmacy', verifiedAt: '2026-11-02' });
    expect(fromOsm(osm())).toMatchObject({ source: 'openstreetmap', verified: false, osmUrl: undefined });
  });

  it('trie par distance depuis la référence, la fiche vérifiée passant devant à distance égale', () => {
    const near = fromService(service({ id: 2, name: 'Proche', latitude: 6.366, longitude: 2.392 }));
    const far = fromOsm(osm({ id: 'osm:node/1', name: 'Loin', latitude: 6.5, longitude: 2.5 }));
    const sorted = withDistance([far, near], { lat: 6.3654, lng: 2.3912 });
    expect(sorted.map((p) => p.name)).toEqual(['Proche', 'Loin']);
    expect(sorted[0].distanceKm).toBeLessThan(sorted[1].distanceKm ?? 0);

    const a = fromOsm(osm({ name: 'A' }));
    const b = fromService(service({ name: 'B', latitude: a.lat, longitude: a.lng }));
    expect(withDistance([a, b], { lat: 6.3, lng: 2.3 })[0].name).toBe('B');
  });

  it('sans référence : fiches vérifiées d’abord, puis ordre alphabétique ; sans position en dernier avec une référence', () => {
    const none = fromService(service({ name: 'Sans position', latitude: null, longitude: null }));
    const placed = fromOsm(osm({ name: 'Avec position' }));
    expect(withDistance([placed, none], null).map((p) => p.name)).toEqual(['Sans position', 'Avec position']);
    expect(withDistance([none, placed], { lat: 6.3, lng: 2.3 }).map((p) => p.name)).toEqual(['Avec position', 'Sans position']);
  });

  it('filtre par type', () => {
    const list = [fromService(service()), fromOsm(osm({ kind: 'clinic', id: 'osm:node/3' }))];
    expect(filterKind(list, 'clinic')).toHaveLength(1);
    expect(filterKind(list, '')).toHaveLength(2);
  });
});
