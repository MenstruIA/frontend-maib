import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { BENIN_BOUNDS, BENIN_CENTER, type LatLng } from '../lib/geo';
import { hasPosition, type MapPlace, type PlaceKind } from '../lib/placesModel';
import { PlaceDetails } from './PlaceDetails';

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const LETTER: Record<PlaceKind, string> = { pharmacy: 'P', clinic: 'C', hospital: 'H', centre: 'S', other: '+' };

/** Marqueurs dessinés en CSS : aucune image à charger, couleur selon la fiabilité (rose = vérifié, gris = non vérifié). */
function pin(place: MapPlace, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin ${place.verified ? 'verified' : 'unverified'}${selected ? ' selected' : ''}"><b>${LETTER[place.kind]}</b></span>`,
    iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -34],
  });
}

const youIcon = L.divIcon({ className: 'map-pin-wrap', html: '<span class="map-you"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });

/** Déplace la carte seulement si elle est visible et a une taille : masquée (onglet « Liste » sur mobile), sa taille est nulle et Leaflet calcule des coordonnées NaN. */
function safeFly(map: L.Map, lat: number, lng: number, zoom: number, duration: number) {
  const size = map.getSize();
  if (size.x === 0 || size.y === 0 || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  map.flyTo([lat, lng], zoom, { duration });
  return true;
}

function Controller({ center, selected, userPos, visible, markers }: {
  center: LatLng | null; selected: MapPlace | null; userPos: LatLng | null; visible: boolean; markers: React.MutableRefObject<Record<string, L.Marker>>;
}) {
  const map = useMap();
  // Dernière destination demandée pendant que la carte était masquée : on la rejoue dès qu'elle devient visible.
  const pending = useRef<(() => void) | null>(null);

  // La carte doit recalculer sa taille quand son onglet devient visible ou que la fenêtre change.
  useEffect(() => {
    const container = map.getContainer();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [map]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
      pending.current?.();
      pending.current = null;
    }, 80);
    return () => clearTimeout(timer);
  }, [visible, map]);

  useEffect(() => {
    if (!center) return;
    const go = () => safeFly(map, center.lat, center.lng, 14, 0.8);
    if (!go()) pending.current = go;
  }, [center, map]);

  useEffect(() => {
    if (!userPos || center) return;
    const go = () => safeFly(map, userPos.lat, userPos.lng, 14, 0.8);
    if (!go()) pending.current = go;
  }, [userPos, center, map]);

  useEffect(() => {
    if (!selected || !hasPosition(selected)) return;
    const go = () => {
      const moved = safeFly(map, selected.lat, selected.lng, Math.max(map.getZoom(), 15), 0.6);
      if (moved) setTimeout(() => markers.current[selected.id]?.openPopup(), 650);
      return moved;
    };
    if (!go()) pending.current = go;
  }, [selected, map, markers]);
  return null;
}

export default function ServicesMap({ places, selectedId, onSelect, center, userPos, visible }: {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  center: LatLng | null;
  userPos: LatLng | null;
  visible: boolean;
}) {
  const markers = useRef<Record<string, L.Marker>>({});
  const located = useMemo(() => places.filter(hasPosition), [places]);
  const selected = places.find((p) => p.id === selectedId) ?? null;

  return (
    <MapContainer center={[BENIN_CENTER.lat, BENIN_CENTER.lng]} zoom={7} minZoom={6} maxBounds={BENIN_BOUNDS} maxBoundsViscosity={0.8}
      className="places-map" scrollWheelZoom aria-label="Carte interactive des établissements de santé au Bénin">
      <TileLayer url={TILE_URL} attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">contributeurs OpenStreetMap</a>' maxZoom={19} />
      <Controller center={center} selected={selected} userPos={userPos} visible={visible} markers={markers} />
      {userPos && <>
        <Circle center={[userPos.lat, userPos.lng]} radius={120} pathOptions={{ color: '#2b6cb0', weight: 1, fillOpacity: 0.12 }} />
        <Marker position={[userPos.lat, userPos.lng]} icon={youIcon} interactive={false} />
      </>}
      {located.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p, p.id === selectedId)} zIndexOffset={p.verified ? 500 : 0}
          ref={(m) => { if (m) markers.current[p.id] = m; else delete markers.current[p.id]; }}
          eventHandlers={{ click: () => onSelect(p.id) }}>
          <Popup minWidth={230} maxWidth={290}><PlaceDetails place={p} userPos={userPos} compact /></Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
