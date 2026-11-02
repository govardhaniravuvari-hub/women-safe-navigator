import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  Flag,
  LocateFixed,
  MapPin,
  Navigation,
  PhoneCall,
  Radio,
  RefreshCw,
  ShieldAlert,
  Siren,
  TriangleAlert,
  Users,
} from 'lucide-react';
import MapView from '../components/MapView';
import { useSos } from '../components/SosProvider';
import { Alert, EmptyState, SectionHeading, Spinner, StatusPill } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { useGeolocation } from '../hooks/useGeolocation';
import { get, post } from '../lib/api';
import { formatDistance, mapsLink, timeAgo, directionsLink } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const QUICK_ACTIONS = [
  { to: '/navigate', icon: Navigation, title: 'Plan a safer route', text: 'Compare routes and confidence scores' },
  { to: '/nearby', icon: Building2, title: 'Nearby help', text: 'Police, hospitals and ambulances' },
  { to: '/share-location', icon: Radio, title: 'Share live location', text: 'Private link for one trusted person' },
  { to: '/reports', icon: Flag, title: 'Report unsafe spot', text: 'Lighting, harassment, unsafe place' },
  { to: '/contacts', icon: Users, title: 'Trusted contacts', text: 'Manage who gets your SOS alert' },
  { to: '/awareness', icon: BookOpen, title: 'Safety guides', text: 'Night travel, digital safety, helplines' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { openSos } = useSos();
  const toast = useToast();
  const { position, error: geoError, loading: geoLoading, request } = useGeolocation({ auto: true });
  const [summary, setSummary] = useState(null);
  const [services, setServices] = useState(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loggedRef = useState({ current: false })[0];

  const load = useCallback(
    async (coords, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const query = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
        const data = await get(`/users/me/summary${query}`);
        setSummary(data);
        if (coords) {
          const nearby = await get(
            `/services/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=5000`,
          ).catch(() => null);
          setServices(nearby);
        }
      } catch (err) {
        toast.error('Could not load dashboard', err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (position) load(position, false);
    else load(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng]);

  useEffect(() => {
    if (!position || loggedRef.current) return;
    loggedRef.current = true;
    post('/users/me/location', {
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy ?? null,
      source: 'gps',
    }).catch(() => {});
    get(`/navigation/reverse?lat=${position.lat}&lng=${position.lng}`)
      .then((d) => setAddress(d.address || ''))
      .catch(() => {});
  }, [position, loggedRef]);

  const stats = summary?.stats || { contacts: 0, primaryContacts: 0, unreadNotifications: 0, myReports: 0, nearbyVerifiedReports: 0 };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const mapMarkers = [
    ...(summary?.nearbyVerifiedReports || []).map((report) => ({
      lat: report.latitude,
      lng: report.longitude,
      type: 'report',
      title: report.category,
      popup: {
        title: 'Verified safety report',
        lines: [report.description, `${formatDistance(report.distanceMeters)} from you`],
      },
    })),
    ...(services?.places || []).slice(0, 6).map((place) => ({
      lat: place.lat,
      lng: place.lng,
      type: place.kind,
      title: place.name,
      popup: {
        title: place.name,
        lines: [place.address || 'Address not mapped', `${formatDistance(place.distanceMeters)} away`],
        links: [{ label: 'Directions', href: mapsLink(place.lat, place.lng) }],
      },
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">{greeting}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {user?.fullName?.split(' ')[0] || 'Welcome'}, let&apos;s keep your journey safe.
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(position, true)}
          className="btn-secondary"
          disabled={refreshing}
        >
          {refreshing ? <Spinner size={15} /> : <RefreshCw size={15} />} Refresh
        </button>
      </div>

      {/* Location + SOS */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <LocateFixed size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Your current location</p>
                {position ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                    </p>
                    <p className="mt-0.5 max-w-md text-xs text-slate-500">
                      {address || 'Address lookup unavailable — coordinates are from your device.'}
                      {position.accuracy ? ` · ±${Math.round(position.accuracy)} m accuracy` : ''}
                    </p>
                  </>
                ) : geoError ? (
                  <p className="mt-1 max-w-md text-sm text-rose-600">{geoError}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    {geoLoading ? 'Getting your location…' : 'Location not available yet.'}
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={request} className="btn-secondary text-xs" disabled={geoLoading}>
              {geoLoading ? <Spinner size={14} /> : <LocateFixed size={14} />} Use my location
            </button>
          </div>

          {position ? (
            <div className="mt-4">
              <MapView
                center={[position.lat, position.lng]}
                zoom={15}
                height={210}
                userPosition={position}
                markers={mapMarkers}
                fitToMarkers={false}
              />
              <p className="mt-2 text-[10px] text-slate-400">
                Map © OpenStreetMap contributors. Verified reports shown in red.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-6 text-center text-sm text-slate-500">
              Allow location access to see verified alerts and emergency services around you. You can
              still use every feature manually.
            </div>
          )}
        </div>

        <div className="card flex flex-col justify-between gap-4 bg-gradient-to-br from-rose-600 to-rose-500 p-5 text-white">
          <div>
            <ShieldAlert size={22} />
            <h2 className="mt-2 text-lg font-bold">Emergency SOS</h2>
            <p className="mt-1 text-sm text-white/85">
              Alerts your trusted contacts with your live location. A 5-second countdown lets you
              cancel a mistake.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={openSos}
              className="btn w-full bg-white text-rose-600 hover:bg-rose-50"
            >
              <ShieldAlert size={17} /> Activate SOS
            </button>
            <a href="tel:112" className="btn w-full border border-white/40 text-white hover:bg-white/10">
              <PhoneCall size={16} /> Call 112
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Trusted contacts', value: stats.contacts, icon: Users, to: '/contacts', hint: `${stats.primaryContacts} primary` },
          { label: 'Verified alerts near you', value: stats.nearbyVerifiedReports, icon: TriangleAlert, to: '/reports', hint: position ? 'within 3 km' : 'needs location' },
          { label: 'Your reports', value: stats.myReports, icon: Flag, to: '/reports', hint: 'submitted' },
          { label: 'Unread notifications', value: stats.unreadNotifications, icon: Bell, to: '/notifications', hint: 'tap to review' },
        ].map((item) => (
          <Link key={item.label} to={item.to} className="card p-4 transition hover:-translate-y-0.5 hover:border-brand-200">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <item.icon size={16} />
              </span>
              <span className="text-2xl font-extrabold text-slate-900">{loading ? '–' : item.value}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-700">{item.label}</p>
            <p className="text-[10px] text-slate-400">{item.hint}</p>
          </Link>
        ))}
      </div>

      {/* Active sharing banner */}
      {summary?.activeShare ? (
        <Alert tone="warning" title="Live location sharing is ON" icon={Radio}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Your private link is active until {new Date(summary.activeShare.expiresAt).toLocaleTimeString('en-IN')}.
              {summary.activeShare.lastUpdateAt
                ? ` Last update ${timeAgo(summary.activeShare.lastUpdateAt)}.`
                : ' No location update sent yet.'}
            </span>
            <Link to="/share-location" className="btn-secondary text-xs">
              Manage sharing <ArrowRight size={13} />
            </Link>
          </div>
        </Alert>
      ) : null}

      {/* Quick actions */}
      <div>
        <SectionHeading eyebrow="Quick access" title="Safety tools" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-200"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <action.icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{action.title}</span>
                <span className="block truncate text-xs text-slate-500">{action.text}</span>
              </span>
              <ArrowRight size={15} className="text-slate-300 transition group-hover:text-brand-500" />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Nearby services */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Building2 size={17} className="text-brand-600" /> Nearby emergency services
            </h2>
            <Link to="/nearby" className="text-xs font-semibold text-brand-700 hover:underline">
              See all
            </Link>
          </div>
          {!position ? (
            <p className="mt-3 text-sm text-slate-500">Allow location access to load nearby police and hospitals.</p>
          ) : services?.places?.length ? (
            <ul className="mt-3 space-y-2">
              {services.places.slice(0, 3).map((place) => (
                <li key={place.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
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
                    <p className="truncate text-[11px] text-slate-500">
                      {place.address || 'Address not mapped'} · {formatDistance(place.distanceMeters)}
                    </p>
                  </div>
                  <a
                    href={place.phone ? `tel:${place.phone}` : 'tel:112'}
                    className="btn-ghost px-2 py-1 text-[11px]"
                    title={place.phone ? `Call ${place.phone}` : 'Phone not mapped — dial 112'}
                  >
                    <PhoneCall size={13} />
                  </a>
                  <a
                    href={directionsLink(place.lat, place.lng, position.lat, position.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost px-2 py-1 text-[11px]"
                    title="Get walking directions"
                  >
                    <Navigation size={13} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {services?.note || 'No emergency services could be loaded right now.'}
            </p>
          )}
        </div>

        {/* Recent alerts / notifications */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Bell size={17} className="text-brand-600" /> Recent updates
            </h2>
            <Link to="/notifications" className="text-xs font-semibold text-brand-700 hover:underline">
              All notifications
            </Link>
          </div>
          {summary?.recentNotifications?.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {summary.recentNotifications.slice(0, 4).map((note) => (
                <li key={note.id} className="py-2.5">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${note.is_read ? 'bg-slate-300' : 'bg-blush-500'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{note.title}</p>
                      {note.body ? <p className="mt-0.5 text-xs leading-snug text-slate-500">{note.body}</p> : null}
                      <p className="mt-0.5 text-[10px] text-slate-400">{timeAgo(note.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No notifications yet.</p>
          )}
        </div>
      </div>

      {/* Nearby verified alerts */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <TriangleAlert size={17} className="text-rose-500" /> Verified safety alerts near you
          </h2>
          <Link to="/reports" className="text-xs font-semibold text-brand-700 hover:underline">
            Report something
          </Link>
        </div>
        {summary?.nearbyVerifiedReports?.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {summary.nearbyVerifiedReports.map((report) => (
              <li key={report.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status="verified" />
                  <span className="text-[10px] font-semibold text-slate-500">
                    {formatDistance(report.distanceMeters)} away
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-800 capitalize">
                  {report.category.replace(/_/g, ' ')}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{report.description}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Reported {timeAgo(report.occurredAt)}
                  {report.isSample ? ' · sample data' : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <EmptyState
              icon={CheckCircle2}
              title="No verified alerts nearby"
              description={
                position
                  ? 'Nothing verified within 3 km of your last location. Absence of alerts is not a guarantee of safety.'
                  : 'Allow location access to check verified alerts around you.'
              }
              action={
                <a href="tel:112" className="btn-secondary text-xs">
                  <PhoneCall size={13} /> 112 emergency
                </a>
              }
            />
          </div>
        )}
      </div>

      {summary?.lastLocation ? (
        <p className="text-center text-[11px] text-slate-400">
          Last logged GPS fix: {timeAgo(summary.lastLocation.recordedAt)} · stored privately in your
          location history.
        </p>
      ) : null}
    </div>
  );
}
