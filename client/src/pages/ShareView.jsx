import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Clock, MapPin, PhoneCall, Radio, ShieldCheck } from 'lucide-react';
import MapView from '../components/MapView';
import Logo from '../components/Logo';
import { Spinner } from '../components/ui';
import { get } from '../lib/api';
import { formatDateTime, mapsLink, timeAgo } from '../lib/format';

export default function ShareView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await get(`/public/share/${token}`);
      setData(result);
      setError('');
      setPulse(true);
      window.setTimeout(() => setPulse(false), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.active) return;
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [data?.active, load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-blush-50">
      <header className="border-b border-brand-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Logo size={36} />
          <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-200">
            <ShieldCheck size={12} /> Shared location
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {loading ? (
          <div className="card flex flex-col items-center justify-center gap-3 p-16 text-sm text-slate-500">
            <Spinner size={24} className="text-brand-600" /> Checking this sharing link…
          </div>
        ) : error ? (
          <div className="card p-8 text-center">
            <AlertTriangle size={28} className="mx-auto text-rose-500" />
            <h1 className="mt-3 text-xl font-bold text-slate-900">This link is not available</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <p className="mt-4 text-xs text-slate-500">
              Sharing links expire automatically and stop working when the SAFEPATH user ends the
              session. Ask them to send a new one.
            </p>
            <Link to="/" className="btn-secondary mt-5 inline-flex">
              Go to SAFEPATH
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Live location shared by</p>
                  <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{data.firstName}</h1>
                  <p className="text-xs text-slate-500">
                    {data.ownerCity ? `${data.ownerCity} · ` : ''}
                    {data.label || 'Journey in progress'}
                  </p>
                </div>
                <span
                  className={`badge ${
                    data.active
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  <Radio size={12} className={data.active ? 'animate-pulse' : ''} />
                  {data.active ? 'Live now' : data.expired ? 'Link expired' : 'Sharing stopped'}
                </span>
              </div>

              {data.active ? (
                <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs leading-relaxed text-brand-900">
                  This page refreshes every 20 seconds while {data.firstName} keeps sharing. Bookmark it
                  only if you are the intended recipient.
                </p>
              ) : (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  {data.note} No location is shown, and nothing more will update. Please contact{' '}
                  {data.firstName} directly.
                </p>
              )}
            </div>

            {data.active ? (
              <div className="card overflow-hidden p-3">
                {data.lat != null ? (
                  <>
                    <MapView
                      center={[data.lat, data.lng]}
                      zoom={16}
                      height={340}
                      markers={[
                        {
                          lat: data.lat,
                          lng: data.lng,
                          type: 'origin',
                          title: `${data.firstName}'s location`,
                          popup: {
                            title: `${data.firstName}'s latest position`,
                            lines: [
                              data.lastUpdateAt ? `Updated ${timeAgo(data.lastUpdateAt)}` : '',
                              data.accuracy ? `Accuracy ±${Math.round(data.accuracy)} m` : '',
                            ],
                          },
                        },
                      ]}
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] tracking-wide text-slate-500 uppercase">Coordinates</p>
                        <p className="text-xs font-semibold text-slate-800">
                          {data.lat.toFixed(5)}, {data.lng.toFixed(5)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] tracking-wide text-slate-500 uppercase">Last update</p>
                        <p className="text-xs font-semibold text-slate-800">
                          {data.lastUpdateAt ? timeAgo(data.lastUpdateAt) : 'Waiting…'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] tracking-wide text-slate-500 uppercase">Link expires</p>
                        <p className="text-xs font-semibold text-slate-800">{formatDateTime(data.expiresAt)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={mapsLink(data.lat, data.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary text-xs"
                      >
                        <MapPin size={13} /> Open in Google Maps
                      </a>
                      <a href="tel:112" className="btn-danger text-xs">
                        <PhoneCall size={13} /> Call 112
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <Clock size={26} className="mx-auto text-slate-400" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">Waiting for the first location update</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {data.firstName} has started sharing but their device has not sent a GPS position
                      yet. This page updates automatically.
                    </p>
                  </div>
                )}
                {lastChecked ? (
                  <p className="mt-2 text-center text-[10px] text-slate-400">
                    Checked {lastChecked.toLocaleTimeString('en-IN')}
                    {pulse ? ' · just refreshed' : ''}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
              <p className="font-semibold">If you believe this person is in danger</p>
              <p className="mt-1">
                Call them first. If you cannot reach them, call 112 with the coordinates above and share
                this page. SAFEPATH does not alert the police automatically.
              </p>
            </div>

            <p className="text-center text-[10px] text-slate-400">
              Shared through SAFEPATH · Map data © OpenStreetMap contributors ·{' '}
              <Link to="/" className="underline">
                What is SAFEPATH?
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
