import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CheckCheck,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Siren,
  TriangleAlert,
} from 'lucide-react';
import { Alert, EmptyState, Spinner } from '../components/ui';
import { useGeolocation } from '../hooks/useGeolocation';
import { get, post } from '../lib/api';
import { formatDateTime, formatDistance, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const TYPE_META = {
  safety_alert: { icon: TriangleAlert, className: 'bg-rose-50 text-rose-600', label: 'Safety alert' },
  report_update: { icon: CheckCheck, className: 'bg-emerald-50 text-emerald-600', label: 'Report update' },
  emergency: { icon: Siren, className: 'bg-rose-100 text-rose-700', label: 'Emergency' },
  announcement: { icon: Megaphone, className: 'bg-brand-50 text-brand-600', label: 'Announcement' },
  system: { icon: Bell, className: 'bg-slate-100 text-slate-500', label: 'System' },
};

const FILTERS = [
  ['all', 'All'],
  ['safety_alert', 'Safety alerts'],
  ['report_update', 'My reports'],
  ['announcement', 'Announcements'],
  ['emergency', 'Emergency'],
];

export default function Notifications() {
  const toast = useToast();
  const { position, error: geoError, request } = useGeolocation({ auto: true });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [nearby, setNearby] = useState([]);
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );

  const load = useCallback(async () => {
    try {
      const data = await get('/notifications');
      setItems(data.notifications);
    } catch (err) {
      toast.error('Could not load notifications', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 45000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!position) return;
    get(`/notifications/nearby?lat=${position.lat}&lng=${position.lng}&radius=3000`)
      .then((d) => setNearby(d.reports || []))
      .catch(() => {});
  }, [position?.lat, position?.lng]);

  const markRead = async (note) => {
    if (note.isRead) return;
    setItems((prev) => prev.map((n) => (n.id === note.id ? { ...n, isRead: true } : n)));
    try {
      await post(`/notifications/${note.id}/read`);
    } catch {
      setItems((prev) => prev.map((n) => (n.id === note.id ? { ...n, isRead: false } : n)));
    }
  };

  const markAll = async () => {
    try {
      await post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Could not update', err.message);
    }
  };

  const enableBrowser = async () => {
    if (!('Notification' in window)) {
      toast.warning('Not supported', 'This browser cannot show system notifications.');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification('SAFEPATH notifications enabled', {
        body: 'You will see SOS and safety alerts here while SAFEPATH is open.',
      });
      toast.success('Browser notifications enabled');
    } else {
      toast.warning('Permission not granted', 'You can enable notifications in your browser settings.');
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((n) => n.type === filter)),
    [items, filter],
  );
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Notifications</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Safety updates</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unread > 0 ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You are all caught up.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="btn-primary text-xs" onClick={markAll} disabled={!unread}>
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  filter === key
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                }`}
              >
                {label}
                {key === 'all' && unread ? ` · ${unread}` : ''}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <Spinner /> Loading notifications…
            </div>
          ) : filtered.length ? (
            <ul className="space-y-2">
              {filtered.map((note) => {
                const meta = TYPE_META[note.type] || TYPE_META.system;
                const Icon = meta.icon;
                return (
                  <li
                    key={note.id}
                    className={`card p-4 transition ${note.isRead ? '' : 'border-brand-200 bg-brand-50/30'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${meta.className}`}>
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{note.title}</p>
                          {!note.isRead ? <span className="size-2 rounded-full bg-blush-500" /> : null}
                        </div>
                        {note.body ? (
                          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{note.body}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span>{formatDateTime(note.createdAt)} · {timeAgo(note.createdAt)}</span>
                          {note.link ? (
                            <Link to={note.link} className="font-semibold text-brand-700 hover:underline">
                              Open
                            </Link>
                          ) : null}
                          {!note.isRead ? (
                            <button
                              type="button"
                              className="font-semibold text-slate-500 hover:text-brand-700"
                              onClick={() => markRead(note)}
                            >
                              Mark as read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Bell}
              title="Nothing here yet"
              description="Verified safety alerts, report updates and announcements will appear in this list."
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <BellRing size={16} className="text-brand-600" /> Browser notifications
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Allow your browser to show SAFEPATH alerts on this device. These appear while the app is
              open — this is not a background push service.
            </p>
            <button
              type="button"
              onClick={enableBrowser}
              className="btn-primary mt-3 w-full text-xs"
              disabled={permission === 'granted' || permission === 'denied'}
            >
              {permission === 'granted'
                ? 'Notifications enabled'
                : permission === 'denied'
                  ? 'Blocked in browser settings'
                  : 'Enable browser notifications'}
            </button>
          </div>

          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <TriangleAlert size={16} className="text-rose-500" /> Alerts near you
            </h2>
            {!position ? (
              <div className="mt-2">
                <p className="text-xs text-slate-500">{geoError || 'Allow location access to see nearby verified alerts.'}</p>
                <button type="button" className="btn-secondary mt-2 w-full text-xs" onClick={request}>
                  Use my location
                </button>
              </div>
            ) : nearby.length ? (
              <ul className="mt-2 space-y-2">
                {nearby.slice(0, 6).map((report) => (
                  <li key={report.id} className="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p className="text-xs font-semibold text-slate-800">{report.categoryLabel}</p>
                    <p className="line-clamp-2 text-[11px] text-slate-500">{report.description}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {formatDistance(report.distanceMeters)} away · verified {timeAgo(report.verifiedAt)}
                      {report.isSample ? ' · sample' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                No verified reports within 3 km. Fewer alerts does not guarantee safety.
              </p>
            )}
          </div>

          <Alert tone="warning" title="Emergency? Don't wait" icon={ShieldAlert}>
            Notifications are informational. Call <a href="tel:112" className="font-bold underline">112</a>{' '}
            immediately if you are in danger.
          </Alert>
        </div>
      </div>
    </div>
  );
}
