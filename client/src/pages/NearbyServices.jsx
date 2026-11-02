import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Info,
  LocateFixed,
  MapPin,
  Navigation,
  PhoneCall,
  RefreshCw,
  Siren,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Alert, EmptyState, Spinner } from '../components/ui';
import { useGeolocation } from '../hooks/useGeolocation';
import { get } from '../lib/api';
import { directionsLink, formatDistance, mapsLink } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const FILTERS = [
  { key: 'all', label: 'All services', emoji: '📍' },
  { key: 'police', label: 'Police', emoji: '🚔' },
  { key: 'hospital', label: 'Hospitals', emoji: '🏥' },
  { key: 'ambulance', label: 'Ambulance', emoji: '🚑' },
];

export default function NearbyServices() {
  const toast = useToast();
  const { position, error: geoError, loading: geoLoading, request } = useGeolocation({ auto: true });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [radius, setRadius] = useState(5000);
  const [helplines, setHelplines] = useState([]);

  const load = useCallback(
    async (radiusValue = radius) => {
      if (!position) return;
      setLoading(true);
      try {
        const result = await get(
          `/services/nearby?lat=${position.lat}&lng=${position.lng}&radius=${radiusValue}`,
        );
        setData(result);
      } catch (err) {
        toast.error('Could not load nearby services', err.message);
      } finally {
        setLoading(false);
      }
    },
    [position, radius, toast],
  );

  useEffect(() => {
    if (position) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, radius]);

  useEffect(() => {
    get('/services/helplines')
      .then((d) => setHelplines(d.helplines))
      .catch(() => {});
  }, []);

  const places = useMemo(() => {
    const list = data?.places || [];
    return filter === 'all' ? list : list.filter((p) => p.kind === filter);
  }, [data, filter]);

  const markers = useMemo(
    () =>
      places.slice(0, 40).map((place) => ({
        lat: place.lat,
        lng: place.lng,
        type: place.kind,
        title: place.name,
        popup: {
          title: place.name,
          lines: [
            place.address || 'Address not mapped',
            `${formatDistance(place.distanceMeters)} away`,
            place.phone ? `Phone: ${place.phone}` : 'Phone number not mapped',
          ],
          links: [
            { label: 'Open in OpenStreetMap', href: mapsLink(place.lat, place.lng) },
            ...(position
              ? [{ label: 'Walking directions', href: directionsLink(place.lat, place.lng, position.lat, position.lng) }]
              : []),
          ],
        },
      })),
    [places, position],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Emergency services</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Help near you</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Police stations, hospitals and ambulances around your location from live OpenStreetMap data.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={request} disabled={geoLoading}>
            {geoLoading ? <Spinner size={14} /> : <LocateFixed size={14} />} Update location
          </button>
          <button type="button" className="btn-primary text-xs" onClick={() => load()} disabled={loading || !position}>
            {loading ? <Spinner size={14} /> : <RefreshCw size={14} />} Refresh
          </button>
        </div>
      </div>

      {!position ? (
        <Alert tone="warning" title="Location needed">
          {geoError || 'Allow location access so SAFEPATH can list the nearest help. '}
          You can still call 112, 100 or 108 from the helpline list below.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  filter === item.key
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                }`}
              >
                <span className="mr-1">{item.emoji}</span>
                {item.label}
              </button>
            ))}
            <select
              className="input ml-auto max-w-40 py-1.5 text-xs"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-label="Search radius"
            >
              {[2000, 5000, 10000, 15000].map((value) => (
                <option key={value} value={value}>
                  Within {value / 1000} km
                </option>
              ))}
            </select>
          </div>

          <MapView
            center={position ? [position.lat, position.lng] : undefined}
            zoom={14}
            height={460}
            markers={markers}
            userPosition={position}
            fitToMarkers={Boolean(places.length)}
          />

          {data ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">
                Source: {data.source === 'openstreetmap' || data.source === 'openstreetmap-photon' ? 'OpenStreetMap (live)' : 'SAFEPATH directory'}
              </span>
              <span>🚔 {data.counts.police}</span>
              <span>🏥 {data.counts.hospital}</span>
              <span>🚑 {data.counts.ambulance}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <h2 className="text-sm font-bold text-slate-900">
              {filter === 'all' ? 'All services' : FILTERS.find((f) => f.key === filter)?.label} nearby
            </h2>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <Spinner /> Searching OpenStreetMap…
              </div>
            ) : places.length ? (
              <ul className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {places.map((place) => (
                  <li key={place.id} className="rounded-xl border border-slate-100 p-2.5">
                    <div className="flex items-start gap-2">
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm ${
                          place.kind === 'police'
                            ? 'bg-blue-50 text-blue-600'
                            : place.kind === 'ambulance'
                              ? 'bg-orange-50 text-orange-600'
                              : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {place.kind === 'police' ? '🚔' : place.kind === 'ambulance' ? '🚑' : '🏥'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{place.name}</p>
                        <p className="text-[11px] leading-snug text-slate-500">
                          {place.address || 'Address not mapped'} · {formatDistance(place.distanceMeters)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {place.phone ? `Phone: ${place.phone}` : 'Phone not mapped in OpenStreetMap'}
                          {place.openingHours ? ` · ${place.openingHours}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <a
                        href={place.phone ? `tel:${place.phone}` : 'tel:112'}
                        className="btn-secondary flex-1 px-2 py-1 text-[11px]"
                      >
                        <PhoneCall size={12} /> {place.phone ? 'Call' : 'Call 112'}
                      </a>
                      {position ? (
                        <a
                          href={directionsLink(place.lat, place.lng, position.lat, position.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary flex-1 px-2 py-1 text-[11px]"
                        >
                          <Navigation size={12} /> Directions
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState
                  icon={Building2}
                  title="No services found in this radius"
                  description={
                    data?.note ||
                    'Try widening the radius. In a real emergency always call 112 regardless of what the map shows.'
                  }
                />
              </div>
            )}
          </div>

          {data?.note ? (
            <p className="flex gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-[11px] leading-snug text-brand-900">
              <Info size={14} className="mt-0.5 shrink-0" /> {data.note}
            </p>
          ) : null}

          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Siren size={16} className="text-rose-500" /> Official helplines
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {helplines.map((line) => (
                <li key={line.number}>
                  <a
                    href={`tel:${line.number}`}
                    className="flex h-full flex-col rounded-xl border border-slate-200 px-2.5 py-2 transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="text-base font-extrabold text-brand-700">{line.number}</span>
                    <span className="text-[10px] leading-tight text-slate-600">{line.name}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
              <MapPin size={11} /> Helplines are fixed official numbers, not location-based.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
