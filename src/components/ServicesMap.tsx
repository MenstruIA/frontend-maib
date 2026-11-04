import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { HealthService } from '../types';
import { LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './ServicesMap.css';

type GeoPoint = { latitude: number; longitude: number };

const serviceIcon = L.divIcon({
  className: 'menstruai-map-marker-wrap',
  html: '<span class="menstruai-map-marker"><span></span></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
  popupAnchor: [0, -30],
});
const userIcon = L.divIcon({
  className: 'menstruai-user-marker-wrap',
  html: '<span class="menstruai-user-marker" aria-label="Votre position"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitMarkers({ services }: { services: HealthService[] }) {
  const map = useMap();
  const points = useMemo(
    () => services.filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)),
    [services],
  );

  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].latitude as number, points[0].longitude as number], 14);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((s) => [s.latitude as number, s.longitude as number]));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    }
  }, [map, points]);
  return null;
}

function LocateUser({ onLocated }: { onLocated: (point: GeoPoint) => void }) {
  const map = useMap();
  const locate = () => {
    if (!navigator.geolocation) {
      window.alert('La géolocalisation n’est pas prise en charge par ce navigateur.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { latitude: coords.latitude, longitude: coords.longitude };
        map.flyTo([point.latitude, point.longitude], 15, { duration: 1 });
        onLocated(point);
      },
      () => window.alert('Position indisponible. Vérifiez que vous avez autorisé la géolocalisation.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  return (
    <button className="services-map-locate" type="button" onClick={locate} aria-label="Me localiser">
      <LocateFixed size={17} /> <span>Me localiser</span>
    </button>
  );
}

function getLabel(type: string) {
  if (type === 'pharmacie') return 'Pharmacie';
  if (type === 'clinique') return 'Clinique';
  return 'Centre de santé';
}

function directionsUrl(destination: GeoPoint, origin?: GeoPoint) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
  });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function ServicesMap({ services }: { services: HealthService[] }) {
  const [userPosition, setUserPosition] = useState<GeoPoint | null>(null);
  const located = services.filter(
    (s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude),
  );

  return (
    <section className="services-map-section" aria-label="Carte des services de santé">
      <div className="services-map-heading">
        <div>
          <h2>Carte des services de santé</h2>
          <p>Localisez les établissements répertoriés et vérifiés.</p>
        </div>
        <div className="services-map-actions">
          <span className="services-map-count">{located.length} établissement{located.length > 1 ? 's' : ''} sur la carte</span>
        </div>
      </div>
      <div className="services-map-frame">
        <MapContainer
          center={[9.5, 2.3]}
          zoom={7}
          scrollWheelZoom
          className="services-leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitMarkers services={located} />
          <LocateUser onLocated={setUserPosition} />
          {userPosition && <Marker position={[userPosition.latitude, userPosition.longitude]} icon={userIcon}><Popup>Votre position (visible uniquement dans cette session).</Popup></Marker>}
          {located.map((s) => {
            const destination = { latitude: s.latitude as number, longitude: s.longitude as number };
            return (
              <Marker key={s.id} position={[destination.latitude, destination.longitude]} icon={serviceIcon}>
                <Popup>
                  <div className="services-map-popup">
                    <strong>{s.name}</strong>
                    <span>{getLabel(s.service_type)}</span>
                    <p>{[s.address, s.city, s.region].filter(Boolean).join(', ')}</p>
                    {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}>{s.phone}</a>}
                    <a target="_blank" rel="noreferrer noopener" href={directionsUrl(destination, userPosition ?? undefined)}>
                      Obtenir l’itinéraire
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      {located.length === 0 && (
        <div className="services-map-empty">
          <p>Aucun établissement de cette recherche ne possède actuellement de coordonnées GPS.</p>
          <p>Les fiches restent accessibles dans la liste ci-dessous.</p>
        </div>
      )}
      <p className="services-map-attribution">
        Carte © OpenStreetMap. Les fiches affichées proviennent du répertoire MenstruAI-Bénin.
      </p>
    </section>
  );
}
