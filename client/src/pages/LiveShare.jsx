import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  MessageCircle,
  Radio,
  Share2,
  ShieldCheck,
  Square,
  TriangleAlert,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Alert, ConfirmationDialog, EmptyState, Spinner } from '../components/ui';
import { useGeolocation } from '../hooks/useGeolocation';
import { get, post } from '../lib/api';
import { formatDateTime, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const DURATIONS = [15, 30, 60, 120, 240];

export default function LiveShare() {
  const toast = useToast();
  const { position, error: geoError, request, startWatch, stopWatch } = useGeolocation();
  const [share, setShare] = useState(null);
  const [history, setHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [duration, setDuration] = useState(60);
  const [label, setLabel] = useState('');
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [busyStop, setBusyStop] = useState(false);
  const [lastPush, setLastPush] = useState(null);
  const [pushError, setPushError] = useState('');
  const intervalRef = useRef(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const load = useCallback(async () => {
    try {
      const [active, hist, contactList] = await Promise.all([
        get('/sharing/active'),
        get('/sharing/history'),
        get('/contacts'),
      ]);
      setShare(active.share);
      setHistory(hist.shares);
      setContacts(contactList.contacts);
    } catch (err) {
      toast.error('Could not load sharing status', err.message);
    }
  }, [toast]);

  useEffect(() => {
    load();
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push location updates while sharing is active.
  useEffect(() => {
    if (!share?.isActive) {
      window.clearInterval(intervalRef.current);
      return;
    }
    startWatch();

    const push = () => {
      if (!('geolocation' in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const data = await post('/sharing/location', {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
            setLastPush(new Date());
            setPushError('');
            setShare(data.share);
          } catch (err) {
            setPushError(err.message);
          }
        },
        (err) => {
          setPushError(
            err.code === 1
              ? 'Location permission is off, so the shared link will not update.'
              : 'Could not read your GPS position for the last update.',
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    };

    push();
    intervalRef.current = window.setInterval(push, 20000);
    return () => {
      window.clearInterval(intervalRef.current);
      stopWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share?.isActive, share?.id]);

  const start = async () => {
    setStarting(true);
    try {
      let coords = position;
      if (!coords) {
        coords = await new Promise((resolve) => {
          navigator.geolocation?.getCurrentPosition(
            (pos) =>
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(null),
            { timeout: 9000 },
          ) || resolve(null);
        });
      }
      const data = await post('/sharing/start', {
        durationMinutes: duration,
        label: label.trim() || undefined,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        accuracy: coords?.accuracy ?? null,
      });
      setShare(data.share);
      setHistory((prev) => [data.share, ...prev]);
      toast.success('Live sharing started', data.message);
    } catch (err) {
      toast.error('Could not start sharing', err.message);
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    setBusyStop(true);
    try {
      const data = await post('/sharing/stop');
      setShare(null);
      setConfirmStop(false);
      toast.success('Sharing stopped', data.message);
      load();
    } catch (err) {
      toast.error('Could not stop sharing', err.message);
    } finally {
      setBusyStop(false);
    }
  };

  const copyLink = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(`${origin}${share.sharePath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Copy failed', 'Select the link and copy it manually.');
    }
  };

  const shareUrl = share ? `${origin}${share.sharePath}` : '';
  const messageText = encodeURIComponent(
    `I'm travelling now. Follow my live location on SAFEPATH: ${shareUrl} (link stops working when I end sharing).`,
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Live location sharing</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Let someone watch your journey</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          A private, unlisted link that expires automatically. Only people you send it to can see your
          latest position — and you can stop it at any moment.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card p-5">
          {share?.isActive ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <Radio size={12} className="animate-pulse" /> Sharing is live
                </span>
                <span className="text-xs text-slate-500">
                  Expires {formatDateTime(share.expiresAt)}
                </span>
              </div>

              <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                <p className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">Your private link</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input readOnly value={shareUrl} className="input bg-white font-mono text-[11px]" />
                  <button type="button" className="btn-secondary px-3" onClick={copyLink}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/?text=${messageText}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                  <a href={`sms:?&body=${messageText}`} className="btn-secondary text-xs">
                    <Share2 size={13} /> SMS
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent('Follow my SAFEPATH live location')}&body=${messageText}`}
                    className="btn-secondary text-xs"
                  >
                    <Mail size={13} /> Email
                  </a>
                  <a href={share.sharePath} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                    <ExternalLink size={13} /> Preview link
                  </a>
                </div>
              </div>

              <MapView
                center={share.lat ? [share.lat, share.lng] : position ? [position.lat, position.lng] : undefined}
                zoom={15}
                height={300}
                markers={
                  share.lat
                    ? [{ lat: share.lat, lng: share.lng, type: 'origin', title: 'Shared location', popup: { title: 'Shared position', lines: [share.lastUpdateAt ? `Updated ${timeAgo(share.lastUpdateAt)}` : 'Waiting for first update'] } }]
                    : []
                }
                userPosition={position}
              />

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                  <p className="text-[10px] tracking-wide text-slate-500 uppercase">Last update</p>
                  <p className="text-xs font-semibold text-slate-800">
                    {share.lastUpdateAt ? timeAgo(share.lastUpdateAt) : 'waiting…'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                  <p className="text-[10px] tracking-wide text-slate-500 uppercase">Updates sent</p>
                  <p className="text-xs font-semibold text-slate-800">
                    every 20 s{lastPush ? '' : ' (auto)'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                  <p className="text-[10px] tracking-wide text-slate-500 uppercase">Accuracy</p>
                  <p className="text-xs font-semibold text-slate-800">
                    {share.accuracy ? `±${Math.round(share.accuracy)} m` : '—'}
                  </p>
                </div>
              </div>

              {pushError ? <Alert tone="warning">{pushError}</Alert> : null}

              <button type="button" className="btn-danger w-full" onClick={() => setConfirmStop(true)}>
                <Square size={15} /> Stop sharing
              </button>
              <p className="text-center text-[11px] text-slate-400">
                Keep this tab open for updates. Closing it stops the automatic refresh.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState
                icon={Radio}
                title="Sharing is off"
                description="Start a sharing session before you leave. The link expires automatically and stops updating when you press stop."
              />

              <div className="grid gap-3">
                <div>
                  <label className="label" htmlFor="duration">Share for</label>
                  <div className="flex flex-wrap gap-2" id="duration">
                    {DURATIONS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => setDuration(minutes)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          duration === minutes
                            ? 'border-brand-500 bg-brand-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                        }`}
                      >
                        {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="label">What is this journey? (optional)</label>
                  <input
                    id="label"
                    className="input"
                    placeholder="e.g. Office to home via metro"
                    value={label}
                    maxLength={120}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>

                {geoError ? <Alert tone="warning">{geoError} The link will still work, but it will not show a location until GPS is available.</Alert> : null}

                <button type="button" className="btn-primary w-full" onClick={start} disabled={starting}>
                  {starting ? <Spinner size={15} /> : <Radio size={15} />}
                  {starting ? 'Starting…' : 'Start live sharing'}
                </button>
              </div>

              {contacts.length ? (
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-700">Send the link directly</p>
                  <ul className="mt-2 space-y-1.5">
                    {contacts.slice(0, 3).map((contact) => (
                      <li key={contact.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-slate-600">
                          {contact.name}
                          {contact.isPrimary ? ' (primary)' : ''} · {contact.phone}
                        </span>
                        <a href={`sms:${contact.phone}?&body=${messageText}`} className="btn-ghost px-2 py-1 text-[11px]">
                          <Share2 size={12} /> SMS
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-slate-400">
                    Links only work after you start sharing. Prefer one or two trusted people.
                  </p>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-brand-200 px-3 py-2.5 text-xs text-slate-500">
                  You have no trusted contacts yet.{' '}
                  <Link to="/contacts" className="font-semibold text-brand-700 underline">
                    Add one
                  </Link>{' '}
                  so you can send the link in one tap.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck size={16} className="text-brand-600" /> How your privacy is protected
            </h2>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-slate-600">
              <li>• The link uses a random 48-character token, so it cannot be guessed.</li>
              <li>• It expires automatically at the time you choose.</li>
              <li>• Pressing stop immediately hides your location from the link.</li>
              <li>• Only a first name, city and coordinates are shown — never your email or contacts.</li>
              <li>• Every session is logged in your database so you can audit it.</li>
            </ul>
          </div>

          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Link2 size={16} className="text-brand-600" /> Past sessions
            </h2>
            {history.length ? (
              <ul className="mt-2 space-y-2">
                {history.slice(0, 6).map((item) => (
                  <li key={item.id} className="rounded-lg border border-slate-100 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-slate-700">
                        {item.label || 'Journey'}
                      </p>
                      <span
                        className={`badge ${
                          item.isActive && new Date(item.expiresAt) > new Date()
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.isActive && new Date(item.expiresAt) > new Date() ? 'active' : 'ended'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Started {formatDateTime(item.createdAt)} · expires {formatDateTime(item.expiresAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No sharing sessions yet.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmStop}
        title="Stop sharing your location?"
        description="The link will immediately stop showing your location. You can start a new session any time."
        confirmLabel="Stop sharing"
        busy={busyStop}
        onConfirm={stop}
        onCancel={() => setConfirmStop(false)}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-900">
        <p className="flex items-center gap-2 font-semibold">
          <TriangleAlert size={14} /> Sharing is not a substitute for emergency help
        </p>
        <p className="mt-1 leading-relaxed">
          If you are in danger, call 112. Your trusted contact can see where you are, but SAFEPATH does
          not monitor journeys or contact the police automatically.
        </p>
      </div>
    </div>
  );
}
