import { ExternalLink, Flag, MapPin, Navigation, Phone, ShieldCheck, TriangleAlert } from 'lucide-react';
import { directionsUrl, formatDistance, type LatLng } from '../lib/geo';
import { KIND_LABELS, hasPosition, type MapPlace } from '../lib/placesModel';
import { ReportButton } from './FeedbackDialog';

export function VerificationBadge({ place }: { place: MapPlace }) {
  return place.verified
    ? <span className="place-badge ok"><ShieldCheck size={13} /> Vérifié{place.verifiedAt ? ` le ${place.verifiedAt}` : ''}</span>
    : <span className="place-badge warn"><TriangleAlert size={13} /> Non vérifié · OpenStreetMap</span>;
}

/** Fiche détaillée : utilisée dans le panneau de gauche et dans la bulle d'un marqueur. */
export function PlaceDetails({ place, userPos, compact = false }: { place: MapPlace; userPos: LatLng | null; compact?: boolean }) {
  const location = [place.address, place.zone && !place.address ? `Zone sanitaire ${place.zone}` : null, place.region].filter(Boolean).join(', ');
  return (
    <div className={`place-details${compact ? ' compact' : ''}`}>
      <div className="place-head">
        <h3>{place.name}</h3>
        <p className="muted small">{KIND_LABELS[place.kind]}{place.distanceKm != null ? ` · à ${formatDistance(place.distanceKm)}` : ''}</p>
        <VerificationBadge place={place} />
      </div>
      <dl className="place-facts">
        {location && <div><dt><MapPin size={14} aria-hidden="true" /><span className="sr-only">Adresse</span></dt><dd>{location}</dd></div>}
        {place.phone && <div><dt><Phone size={14} aria-hidden="true" /><span className="sr-only">Téléphone</span></dt><dd><a href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>{place.phone}</a></dd></div>}
        {place.hours && <div><dt className="hours-label">Horaires</dt><dd>{place.hours}</dd></div>}
        {hasPosition(place) && <div><dt className="hours-label">GPS</dt><dd className="mono">{place.lat.toFixed(5)}, {place.lng.toFixed(5)}</dd></div>}
      </dl>
      {!place.phone && !place.hours && <p className="muted small">Téléphone et horaires non renseignés.</p>}
      {!place.verified && <p className="place-warning">Cette fiche provient de la communauté OpenStreetMap et n’a pas été vérifiée par MenstruAI : appelez avant de vous déplacer.</p>}
      <div className="place-actions">
        {hasPosition(place) && <a className="button primary" href={directionsUrl({ lat: place.lat, lng: place.lng }, userPos)} target="_blank" rel="noreferrer noopener"><Navigation size={15} /> Itinéraire</a>}
        {place.osmUrl && <a className="button secondary" href={place.osmUrl} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> OpenStreetMap</a>}
        {place.website && <a className="button secondary" href={place.website} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Site web</a>}
      </div>
      {place.serviceId != null && <ReportButton targetType="service" targetRef={String(place.serviceId)} label="Signaler une erreur" />}
      {!place.serviceId && <span className="muted small place-fix"><Flag size={12} /> Une erreur ? Corrigez-la directement sur OpenStreetMap.</span>}
    </div>
  );
}
