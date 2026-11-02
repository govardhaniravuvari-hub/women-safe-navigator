import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownUp,
  Bookmark,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Footprints,
  Info,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import MapView from '../components/MapView';
import { useSos } from '../components/SosProvider';
import { Alert, EmptyState, ScoreBadge, Spinner } from '../components/ui';
import { useGeolocation } from '../hooks/useGeolocation';
import { get, post } from '../lib/api';
import { formatDistance, formatDuration, scoreTone } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const ROUTE_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b'];

function PlaceSearch({ label, value, onSelect, placeholder, icon: Icon = MapPin }) {
  const [query, setQuery] = useState(value?.label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setQuery(value?.label || '');
  }, [value?.label]);

  useEffect(() => {
    if (!touched) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await get(`/navigation/search?q=${encodeURIComponent(q)}`);
        setResults(data.results || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(timerRef.current);
  }, [query, touched]);

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-brand-500" />
        <input
          className="input pr-9 pl-9"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setTouched(true);
            setQuery(e.target.value);
            if (value) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
        />
        {loading ? (
          <Loader2 size={15} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-brand-500" />
        ) : query ? (
          <button
            type="button"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setQuery('');
              setResults([]);
              onSelect(null);
            }}
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {open && results.length ? (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-brand-100 bg-white py-1 shadow-xl">
          {results.map((result, index) => (
            <li key={`${result.lat}-${result.lng}-${index}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-brand-50"
                onClick={() => {
                  onSelect(result);
                  setQuery(result.shortLabel || result.label);
                  setOpen(false);
                  setTouched(false);
                }}
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-brand-500" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {result.shortLabel || result.label}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">{result.label}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
            Search results © OpenStreetMap Nominatim
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export default function NavigatePage() {
  const toast = useToast();
  const { openSos } = useSos();
  const { position, error: geoError, loading: geoLoading, request } = useGeolocation({ auto: true });

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState('');
  const [unsafePoints, setUnsafePoints] = useState([]);
  const [places, setPlaces] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const autoRan = useRef(false);

  useEffect(() => {
    if (position && !origin) {
      setOrigin({ lat: position.lat, lng: position.lng, label: 'My current location' });
    }
  }, [position, origin]);

  useEffect(() => {
    if (!position) return;
    const radius = 6000;
    get(`/navigation/unsafe-points?lat=${position.lat}&lng=${position.lng}&radius=${radius}`)
      .then((d) => setUnsafePoints(d.points || []))
      .catch(() => {});
    get(`/services/nearby?lat=${position.lat}&lng=${position.lng}&radius=3000`)
      .then((d) => setPlaces(d.places?.slice(0, 12) || []))
      .catch(() => {});
  }, [position?.lat, position?.lng]);

  const compare = useCallback(async () => {
    if (!origin || !destination) return;
    setComputing(true);
    setError('');
    try {
      const response = await post('/navigation/routes', {
        from: { lat: origin.lat, lng: origin.lng, label: origin.label },
        to: { lat: destination.lat, lng: destination.lng, label: destination.label },
      });
      setData(response);
      setSelectedId(response.recommendedRouteId);
      setSaveLabel(`${origin.label?.split(',')[0] || 'Start'} → ${destination.label?.split(',')[0] || 'Destination'}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setComputing(false);
    }
  }, [origin, destination]);

  useEffect(() => {
    if (origin && destination && !autoRan.current) {
      autoRan.current = true;
      compare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  const selected = useMemo(
    () => data?.routes?.find((r) => r.id === selectedId) || data?.routes?.[0],
    [data, selectedId],
  );

  const markers = useMemo(() => {
    const list = [];
    if (origin) list.push({ lat: origin.lat, lng: origin.lng, type: 'origin', title: 'Start', popup: { title: 'Start', lines: [origin.label] } });
    if (destination) list.push({ lat: destination.lat, lng: destination.lng, type: 'destination', title: 'Destination', popup: { title: 'Destination', lines: [destination.label] } });
    unsafePoints.forEach((point) => {
      list.push({
        lat: point.lat,
        lng: point.lng,
        type: 'report',
        title: point.category,
        popup: {
          title: `Verified: ${point.category.replace(/_/g, ' ')}`,
          lines: [point.description || '', point.isSample ? 'Sample data for demonstration' : 'Verified by a SAFEPATH moderator'],
        },
      });
    });
    places.forEach((place) => {
      list.push({
        lat: place.lat,
        lng: place.lng,
        type: place.kind,
        title: place.name,
        popup: { title: place.name, lines: [place.address || 'Address not mapped'] },
      });
    });
    return list;
  }, [origin, destination, unsafePoints, places]);

  const routes = useMemo(
    () =>
      (data?.routes || []).map((route, index) => ({
        coords: route.coordinates,
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        weight: route.id === selectedId ? 6 : 4,
        opacity: route.id === selectedId ? 0.95 : 0.45,
        dashed: route.source === 'estimate',
        label: `${formatDistance(route.distanceMeters)} · score ${route.safety.score}`,
      })),
    [data, selectedId],
  );

  const saveRoute = async () => {
    if (!selected || !destination || !origin) return;
    setSaving(true);
    try {
      await post('/navigation/saved', {
        label: saveLabel.trim() || 'Saved route',
        from: { lat: origin.lat, lng: origin.lng, label: origin.label },
        to: { lat: destination.lat, lng: destination.lng, label: destination.label },
        distanceMeters: selected.distanceMeters,
        durationSeconds: selected.durationSeconds,
        safetyScore: selected.safety.score,
        safetyLabel: selected.safety.label,
        geometry: selected.coordinates,
      });
      toast.success('Route saved', 'Find it again from this page when you need it.');
      setSaveOpen(false);
    } catch (err) {
      toast.error('Could not save route', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Safe route navigator</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Plan your journey</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Compare walking routes with confidence estimates built from verified reports, mapped
            street lighting and public activity. Scores are estimates — never guarantees.
          </p>
        </div>
        <button type="button" onClick={openSos} className="btn-danger">
          <ShieldAlert size={16} /> SOS
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Left panel */}
        <div className="space-y-4">
          <div className="card space-y-3 p-4">
            <PlaceSearch
              label="Starting point"
              value={origin}
              onSelect={setOrigin}
              placeholder="Search a starting point"
              icon={LocateFixed}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={request}
                className="btn-secondary flex-1 text-xs"
                disabled={geoLoading}
              >
                {geoLoading ? <Spinner size={13} /> : <LocateFixed size={13} />} Use current location
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => {
                  setOrigin(destination);
                  setDestination(origin);
                  setData(null);
                  autoRan.current = false;
                }}
                title="Swap start and destination"
              >
                <ArrowDownUp size={14} /> Swap
              </button>
            </div>

            <PlaceSearch
              label="Destination"
              value={destination}
              onSelect={setDestination}
              placeholder="Where are you going?"
              icon={MapPin}
            />

            <button
              type="button"
              className="btn-primary w-full"
              onClick={compare}
              disabled={!origin || !destination || computing}
            >
              {computing ? <Spinner size={15} /> : <Navigation size={15} />}
              {computing ? 'Comparing routes…' : 'Compare routes'}
            </button>

            {geoError && !origin ? <p className="text-xs text-rose-600">{geoError}</p> : null}
            {!position && !geoError ? (
              <p className="text-[11px] text-slate-400">
                Tip: search any start point if you prefer not to share your GPS location.
              </p>
            ) : null}
          </div>

          {error ? <Alert tone="error" title="Route comparison failed">{error}</Alert> : null}

          {data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  {data.routes.length} route{data.routes.length > 1 ? 's' : ''} found
                </h2>
                {selected ? (
                  <button type="button" className="btn-ghost text-xs" onClick={() => setSaveOpen((v) => !v)}>
                    <Bookmark size={13} /> Save route
                  </button>
                ) : null}
              </div>

              {saveOpen ? (
                <div className="card space-y-2 p-3">
                  <label className="label" htmlFor="route-label">Route name</label>
                  <input
                    id="route-label"
                    className="input"
                    value={saveLabel}
                    maxLength={140}
                    onChange={(e) => setSaveLabel(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => setSaveOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary flex-1 text-xs" onClick={saveRoute} disabled={saving}>
                      {saving ? <Spinner size={13} /> : <Bookmark size={13} />} Save
                    </button>
                  </div>
                </div>
              ) : null}

              {data.routes.map((route, index) => {
                const isSelected = route.id === selectedId;
                const tone = scoreTone(route.safety.score);
                const isRecommended = route.id === data.recommendedRouteId;
                return (
                  <div
                    key={route.id}
                    className={`card cursor-pointer overflow-hidden transition ${isSelected ? 'ring-2 ring-brand-400' : 'hover:border-brand-200'}`}
                    onClick={() => setSelectedId(route.id)}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <span
                        className="mt-1 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: ROUTE_COLORS[index % ROUTE_COLORS.length] }}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isRecommended ? (
                            <span className="badge bg-brand-600 text-white">
                              <CheckCircle2 size={11} /> Best estimate
                            </span>
                          ) : null}
                          {route.source === 'estimate' ? (
                            <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                              Straight-line estimate
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-sm font-semibold text-slate-800">
                          <span className="flex items-center gap-1">
                            <Footprints size={14} className="text-slate-400" /> {formatDistance(route.distanceMeters)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} className="text-slate-400" /> {formatDuration(route.durationSeconds)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${tone.bar}`}
                              style={{ width: `${route.safety.score}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${tone.text}`}>{route.safety.score}</span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {route.safety.label} · {route.safety.confidence === 'limited' ? 'limited data' : 'full data used'}
                        </p>

                        <button
                          type="button"
                          className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpanded(expanded === route.id ? null : route.id);
                          }}
                        >
                          <Info size={12} /> Why this score
                          <ChevronDown
                            size={12}
                            className={`transition ${expanded === route.id ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {expanded === route.id ? (
                          <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
                            {route.safety.factors.map((factor) => (
                              <div key={factor.key} className="text-[11px]">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-700">{factor.title}</span>
                                  <span
                                    className={
                                      factor.status === 'unknown'
                                        ? 'badge bg-slate-200 text-slate-600'
                                        : factor.impact === 0
                                          ? 'badge bg-emerald-50 text-emerald-700'
                                          : 'badge bg-rose-50 text-rose-700'
                                    }
                                  >
                                    {factor.status === 'unknown'
                                      ? 'data unavailable'
                                      : factor.impact === 0
                                        ? 'no penalty'
                                        : `${factor.impact} pts`}
                                  </span>
                                </div>
                                <p className="mt-0.5 leading-snug text-slate-500">{factor.detail}</p>
                              </div>
                            ))}
                            <p className="border-t border-slate-200 pt-2 text-[10px] leading-snug text-slate-500">
                              {route.safety.confidenceNote}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <p className="font-semibold">How to read this</p>
                <p className="mt-1">{data.model.disclaimer}</p>
                <p className="mt-2">
                  {data.dataNotes.routing} {data.dataNotes.lighting} {data.dataNotes.reports}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Map */}
        <div className="card overflow-hidden p-3">
          <MapView
            center={origin ? [origin.lat, origin.lng] : position ? [position.lat, position.lng] : undefined}
            zoom={14}
            height={520}
            markers={markers}
            routes={routes}
            userPosition={position}
            fitToMarkers={Boolean(data)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-brand-600" /> Your location</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-rose-500" /> Verified report</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500" /> Police</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-600" /> Hospital</span>
            <span className="ml-auto">Map data © OpenStreetMap contributors</span>
          </div>

          {!data ? (
            <div className="mt-3">
              <EmptyState
                icon={Navigation}
                title="Choose a destination to compare routes"
                description="SAFEPATH will fetch walking routes, overlay verified safety reports and score each option."
                action={
                  <Link to="/nearby" className="btn-secondary text-xs">
                    <Building2 size={13} /> See nearby emergency services
                  </Link>
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TriangleAlert size={16} className="text-rose-500" />
              <p className="text-sm font-semibold text-slate-800">
                {selected.safety.matchedReports.length} verified report
                {selected.safety.matchedReports.length === 1 ? '' : 's'} on this route corridor
              </p>
            </div>
            <ScoreBadge score={selected.safety.score} label={selected.safety.label} />
          </div>
          {selected.safety.matchedReports.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {selected.safety.matchedReports.map((report) => (
                <li key={`${report.id}-${report.distanceMeters}`} className="badge bg-rose-50 text-rose-700 ring-1 ring-rose-200 capitalize">
                  {report.category.replace(/_/g, ' ')} · {formatDistance(report.distanceMeters)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              No verified reports were found within 70 m of the route path. That is not proof the
              route is safe.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
