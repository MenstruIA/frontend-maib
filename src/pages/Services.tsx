import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { List, LocateFixed, Map as MapIcon, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { placesApi } from '../lib/placesApi';
import { parseQuery } from '../lib/placeQuery';
import { insideBenin, formatDistance, roundCoord, type LatLng } from '../lib/geo';
import {
  KIND_LABELS, SERVICE_TYPES_FOR_KIND, filterKind, fromOsm, fromService, hasPosition, withDistance, type MapPlace, type PlaceKind,
} from '../lib/placesModel';
import { PlaceDetails, VerificationBadge } from '../components/PlaceDetails';

// La carte (Leaflet) est chargée à la demande : elle n'alourdit pas les autres pages.
const ServicesMap = lazy(() => import('../components/ServicesMap'));

type KindFilter = Exclude<PlaceKind, 'other'> | '';
const CHIPS: { value: KindFilter; label: string }[] = [
  { value: '', label: 'Tous' }, { value: 'pharmacy', label: 'Pharmacies' }, { value: 'clinic', label: 'Cliniques' },
  { value: 'centre', label: 'Centres de santé' }, { value: 'hospital', label: 'Hôpitaux' },
];
const GEO_ERRORS: Record<number, string> = {
  1: 'La localisation est refusée. Autorisez-la dans votre navigateur, ou cherchez un quartier ou une ville.',
  2: 'Votre position est indisponible pour le moment. Cherchez un quartier ou une ville.',
  3: 'La localisation a pris trop de temps. Réessayez ou cherchez un quartier ou une ville.',
};
const OSM_RADIUS_KM = 5;
const VERIFIED_RADIUS_KM = 10;

interface Center extends LatLng { label: string }

export function Services() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<KindFilter>('');
  const [includeOsm, setIncludeOsm] = useState(true);
  const [center, setCenter] = useState<Center | null>(null);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [verified, setVerified] = useState<MapPlace[]>([]);
  const [osm, setOsm] = useState<MapPlace[]>([]);
  const [osmState, setOsmState] = useState<'idle' | 'ok' | 'unavailable'>('idle');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestId = useRef(0);
  const searchToken = useRef(0);

  const reference: LatLng | null = userPos ?? center;
  const places = useMemo(() => withDistance(filterKind([...verified, ...osm], kind), reference), [verified, osm, kind, reference]);
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const unverifiedShown = places.some((p) => !p.verified);
  const withoutPosition = places.filter((p) => !hasPosition(p)).length;

  // Vue d'ensemble au chargement : fiches vérifiées du pays (filtrées par type côté serveur sans position de référence).
  const loadVerifiedOverview = useCallback(async (filter: KindFilter, text?: string) => {
    const id = ++requestId.current;
    setLoading(true); setError('');
    try {
      const r = await placesApi.verified({ q: text, types: filter ? SERVICE_TYPES_FOR_KIND[filter] : undefined });
      if (id === requestId.current) setVerified(r.data.map(fromService));
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? 'Le répertoire n’est pas disponible pour le moment.' : '');
    } finally { if (id === requestId.current) setLoading(false); }
  }, []);

  useEffect(() => { void loadVerifiedOverview(''); }, [loadVerifiedOverview]);

  /** Recherche autour d'un point : fiches vérifiées proches + établissements OpenStreetMap (non vérifiés). */
  const searchAround = useCallback(async (point: Center, exactUser: LatLng | null) => {
    const id = ++requestId.current;
    setLoading(true); setError(''); setSelectedId(null);
    try {
      const [near, osmResult] = await Promise.allSettled([
        // Position envoyée à notre serveur arrondie à ≈ 110 m ; jamais enregistrée.
        placesApi.servicesNear({ lat: roundCoord(point.lat, 3), lng: roundCoord(point.lng, 3), radiusKm: VERIFIED_RADIUS_KM }),
        includeOsm
          // Zone d'environ 1 km (2 décimales) pour les services OpenStreetMap : la position exacte n'est jamais transmise.
          ? placesApi.nearby({ lat: roundCoord(point.lat, 2), lng: roundCoord(point.lng, 2), radiusKm: OSM_RADIUS_KM })
          : Promise.resolve(null),
      ]);
      if (id !== requestId.current) return;
      setCenter(point); setUserPos(exactUser);
      setVerified(near.status === 'fulfilled' ? near.value.data.map(fromService) : []);
      if (near.status === 'rejected') setError('Les fiches vérifiées ne sont pas disponibles pour le moment.');
      if (osmResult.status === 'fulfilled' && osmResult.value) { setOsm(osmResult.value.data.map(fromOsm)); setOsmState('ok'); }
      else { setOsm([]); setOsmState(includeOsm ? 'unavailable' : 'idle'); }
      setSearched(true);
    } finally { if (id === requestId.current) setLoading(false); }
  }, [includeOsm]);

  async function onSearch(e?: FormEvent) {
    e?.preventDefault();
    const text = q.trim();
    if (!text) return;
    const token = ++searchToken.current; // une recherche plus récente rend celle-ci caduque
    const parsed = parseQuery(text);
    const filter: KindFilter = parsed.kind ?? kind;
    if (parsed.kind) setKind(parsed.kind);
    setInfo(''); setSearched(true);

    if (!parsed.place) { // « pharmacie » seule : pas de lieu à localiser
      setCenter(null); setOsm([]); setOsmState('idle'); setUserPos(null); setSelectedId(null);
      await loadVerifiedOverview(filter);
      return;
    }
    setLoading(true);
    try {
      const hit = (await placesApi.search(parsed.place)).data[0];
      if (token !== searchToken.current) return;
      if (hit && insideBenin({ lat: hit.latitude, lng: hit.longitude })) {
        await searchAround({ lat: hit.latitude, lng: hit.longitude, label: hit.name.split(',').slice(0, 2).join(',') }, null);
        setView('map'); focusResults();
        return;
      }
      setInfo(`Lieu « ${parsed.place} » introuvable au Bénin. Nous affichons les fiches vérifiées dont le nom correspond.`);
    } catch {
      if (token !== searchToken.current) return;
      setInfo('La recherche de lieux est momentanément indisponible. Nous affichons les fiches vérifiées dont le nom correspond.');
    }
    setCenter(null); setOsm([]); setOsmState('idle'); setUserPos(null);
    await loadVerifiedOverview(filter, parsed.place);
  }

  function locateMe() {
    if (!('geolocation' in navigator)) { setError('La géolocalisation n’est pas disponible sur cet appareil.'); return; }
    setError(''); setInfo(''); setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!insideBenin(here)) {
          setLoading(false);
          setInfo('Vous semblez être hors du Bénin : la carte couvre uniquement le Bénin. Cherchez un quartier ou une ville.');
          return;
        }
        setQ(''); // la position n'est jamais écrite dans le champ ni conservée
        void searchAround({ ...here, label: 'Autour de moi' }, here).then(() => { setView('map'); focusResults(); });
      },
      (err) => { setLoading(false); setError(GEO_ERRORS[err.code] ?? 'Impossible de vous localiser.'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function changeKind(value: KindFilter) {
    setKind(value);
    // Sans position de référence, le filtre est appliqué par le serveur pour ne pas masquer de fiches au-delà de la 1re page.
    if (!center) void loadVerifiedOverview(value);
  }

  /** Après une recherche, amène la liste/la carte à l'écran (sur téléphone, le bandeau d'options est long). */
  function focusResults() {
    setTimeout(() => document.querySelector('.places-tabs')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 60);
  }

  function select(id: string) {
    setSelectedId(id);
    document.getElementById(`place-${id}`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  const empty = !loading && places.length === 0;

  return (
    <section className="page-section places-page">
      <span className="eyebrow">Orientation</span>
      <h1 className="page-title">Centres de santé, cliniques et pharmacies</h1>

      <form className="places-search" onSubmit={onSearch} role="search">
        <Search size={18} aria-hidden="true" />
        <input aria-label="Rechercher un établissement ou un lieu" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Ex. : Pharmacie à Vodokpo, clinique Parakou, centre de santé Cotonou" />
        <button className="button primary" type="submit" disabled={!q.trim()}>Rechercher</button>
        <button className="button secondary" type="button" onClick={locateMe}><LocateFixed size={16} /> <span>Autour de moi</span></button>
      </form>

      <div className="places-toolbar">
        <div className="chips" role="group" aria-label="Type d’établissement">
          {CHIPS.map((c) => (
            <button key={c.value || 'all'} type="button" className={`chip ${kind === c.value ? 'on' : ''}`} aria-pressed={kind === c.value} onClick={() => changeKind(c.value)}>{c.label}</button>
          ))}
        </div>
        <label className="osm-toggle">
          <input type="checkbox" checked={includeOsm} onChange={(e) => setIncludeOsm(e.target.checked)} />
          <span>Inclure OpenStreetMap <em>(non vérifié)</em></span>
        </label>
      </div>

      <details className="places-privacy">
        <summary><ShieldCheck size={13} aria-hidden="true" /> Confidentialité de votre position</summary>
        <p>Votre position n’est utilisée que pour cette recherche et n’est jamais enregistrée. Les établissements OpenStreetMap sont cherchés autour d’une zone d’environ 1 km, pas de votre point exact.</p>
      </details>

      {error && <div className="notice error" role="alert">{error}</div>}
      {info && <div className="notice" role="status">{info}</div>}
      {unverifiedShown && (
        <div className="notice warn" role="note"><TriangleAlert size={16} aria-hidden="true" />
          <span><strong>Marqueurs gris : non vérifiés.</strong> Ces établissements viennent d’OpenStreetMap (données communautaires) ; leurs horaires et téléphones peuvent être inexacts. Les marqueurs roses sont des fiches vérifiées par MenstruAI. Appelez avant de vous déplacer.</span></div>
      )}
      {osmState === 'unavailable' && <div className="notice" role="status">Les établissements OpenStreetMap ne sont pas disponibles pour le moment : seules les fiches vérifiées sont affichées.</div>}

      <div className="places-tabs" role="tablist" aria-label="Affichage">
        <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={16} /> Liste ({places.length})</button>
        <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}><MapIcon size={16} /> Carte</button>
      </div>

      <div className="places-layout" data-view={view}>
        <div className="places-list" aria-busy={loading}>
          {center && <p className="places-zone muted small">Autour de : <strong>{center.label}</strong>{OSM_RADIUS_KM ? ` · rayon ${OSM_RADIUS_KM} km` : ''}</p>}
          {selected && <PlaceDetails place={selected} userPos={userPos} />}
          {loading && <p className="muted" role="status">Recherche en cours…</p>}
          {places.map((p) => (
            <button type="button" key={p.id} id={`place-${p.id}`} className={`place-card${p.id === selectedId ? ' selected' : ''}${p.verified ? '' : ' unverified'}`} onClick={() => select(p.id)} aria-pressed={p.id === selectedId}>
              <span className={`place-dot ${p.verified ? 'verified' : 'unverified'}`} aria-hidden="true" />
              <span className="place-main">
                <strong>{p.name}</strong>
                <span className="muted small">{KIND_LABELS[p.kind]}{p.zone ? ` · ${p.zone}` : ''}{p.distanceKm != null ? ` · ${formatDistance(p.distanceKm)}` : ''}</span>
                <VerificationBadge place={p} />
                {!hasPosition(p) && <span className="muted small">Position non renseignée</span>}
              </span>
            </button>
          ))}
          {empty && (
            <p className="empty-state">{searched
              ? 'Aucun établissement trouvé pour cette recherche. Essayez un quartier voisin, une autre ville ou élargissez le type d’établissement.'
              : 'Aucune fiche vérifiée n’est disponible pour le moment. Cherchez un quartier ou une ville pour afficher aussi les établissements OpenStreetMap.'}</p>
          )}
          {withoutPosition > 0 && <p className="muted small">{withoutPosition} fiche(s) sans position GPS : elles apparaissent dans la liste mais pas sur la carte.</p>}
        </div>

        <div className="places-map-pane">
          <Suspense fallback={<div className="places-map loading-map" role="status">Chargement de la carte…</div>}>
            <ServicesMap places={places} selectedId={selectedId} onSelect={select} center={center} userPos={userPos} visible={view === 'map'} />
          </Suspense>
          {selected && (
            <div className="selected-strip">
              <span><strong>{selected.name}</strong><span className="muted small"> · {KIND_LABELS[selected.kind]}</span></span>
              <button type="button" className="text-button" onClick={() => setView('list')}>Fiche détaillée</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
