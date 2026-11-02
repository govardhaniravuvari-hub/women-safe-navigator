import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Flag,
  LocateFixed,
  MapPin,
  Send,
  ShieldQuestion,
  Trash2,
  X,
} from 'lucide-react';
import MapView from '../components/MapView';
import { Alert, ConfirmationDialog, EmptyState, Spinner, StatusPill } from '../components/ui';
import { useGeolocation } from '../hooks/useGeolocation';
import { get, post, del } from '../lib/api';
import { CATEGORY_META, formatDateTime, formatLocalDateTimeInput } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const CATEGORIES = [
  { value: 'harassment', label: 'Harassment incident' },
  { value: 'poor_lighting', label: 'Poorly lit road' },
  { value: 'unsafe_route', label: 'Unsafe travelling route' },
  { value: 'suspicious_activity', label: 'Suspicious activity' },
  { value: 'unsafe_place', label: 'Unsafe public place' },
  { value: 'other', label: 'Other safety concern' },
];

const EMPTY = {
  category: 'poor_lighting',
  description: '',
  address: '',
  occurredAt: formatLocalDateTimeInput(),
  severity: 'medium',
  contactOk: true,
};

export default function Reports() {
  const toast = useToast();
  const { position, error: geoError, request } = useGeolocation({ auto: true });
  const [form, setForm] = useState(EMPTY);
  const [coords, setCoords] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nearby, setNearby] = useState([]);
  const [withdrawing, setWithdrawing] = useState(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await get('/reports/mine');
      setMine(data.reports);
    } catch (err) {
      toast.error('Could not load your reports', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (position && !coords) setCoords({ lat: position.lat, lng: position.lng });
  }, [position, coords]);

  useEffect(() => {
    if (!position) return;
    get(`/reports/nearby?lat=${position.lat}&lng=${position.lng}&radius=3000`)
      .then((d) => setNearby(d.reports || []))
      .catch(() => {});
  }, [position?.lat, position?.lng]);

  const pickFile = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!coords) {
      setError('Choose the location of the incident on the map or use your current location.');
      return;
    }
    if (form.description.trim().length < 15) {
      setError('Please describe what happened in at least 15 characters.');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('category', form.category);
      body.append('description', form.description.trim());
      body.append('lat', coords.lat);
      body.append('lng', coords.lng);
      if (form.address.trim()) body.append('address', form.address.trim());
      body.append('occurredAt', new Date(form.occurredAt).toISOString());
      body.append('severity', form.severity);
      body.append('contactOk', String(form.contactOk));
      if (file) body.append('image', file);

      const data = await post('/reports', undefined, { formData: body });
      setMine((prev) => [data.report, ...prev]);
      toast.success('Report submitted', data.message);
      setForm(EMPTY);
      setFile(null);
      setPreview('');
      setCoords(position ? { lat: position.lat, lng: position.lng } : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!withdrawing) return;
    setWithdrawBusy(true);
    try {
      await del(`/reports/${withdrawing.id}`);
      setMine((prev) => prev.filter((r) => r.id !== withdrawing.id));
      toast.success('Report withdrawn');
      setWithdrawing(null);
    } catch (err) {
      toast.error('Could not withdraw report', err.message);
    } finally {
      setWithdrawBusy(false);
    }
  };

  const markers = useMemo(() => {
    const list = [];
    if (coords) {
      list.push({
        lat: coords.lat,
        lng: coords.lng,
        type: 'report',
        title: 'Selected location',
        popup: { title: 'Report location', lines: ['Click the map to adjust the pin.'] },
      });
    }
    nearby.forEach((report) => {
      list.push({
        lat: report.lat,
        lng: report.lng,
        type: 'report',
        title: report.categoryLabel,
        popup: {
          title: `Verified: ${report.categoryLabel}`,
          lines: [report.description, report.isSample ? 'Sample data' : 'Verified by moderator'],
        },
      });
    });
    return list;
  }, [coords, nearby]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Community safety reporting</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Report an unsafe location</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Reports help other women travelling the same road. Every submission is reviewed by a moderator
          before it appears on the community map, and your identity is never shown publicly.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <form onSubmit={submit} className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Flag size={17} className="text-brand-600" /> New report
          </h2>

          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="category">Category</label>
              <select
                id="category"
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="severity">How serious was it?</label>
              <select
                id="severity"
                className="input"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="low">Low — inconvenient</option>
                <option value="medium">Medium — felt unsafe</option>
                <option value="high">High — immediate danger</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="description">What happened?</label>
            <textarea
              id="description"
              className="input min-h-24 resize-y"
              placeholder="Describe the location and what you experienced. Avoid naming private individuals."
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
            <p className="mt-1 text-right text-[10px] text-slate-400">{form.description.length}/2000</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="occurredAt">Date and time</label>
              <input
                id="occurredAt"
                type="datetime-local"
                className="input"
                value={form.occurredAt}
                max={formatLocalDateTimeInput()}
                onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="address">Landmark / address (optional)</label>
              <input
                id="address"
                className="input"
                placeholder="e.g. Behind the metro station"
                maxLength={255}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="label mb-1">Location</span>
              <button
                type="button"
                className="mb-1 text-[11px] font-semibold text-brand-700 hover:underline"
                onClick={request}
              >
                <LocateFixed size={11} className="mr-1 inline" /> Use my GPS location
              </button>
            </div>
            {coords ? (
              <p className="mb-2 flex items-center gap-1 text-[11px] text-slate-600">
                <MapPin size={12} className="text-brand-600" />
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — tap the map to adjust
              </p>
            ) : (
              <p className="mb-2 text-[11px] text-amber-600">
                {geoError || 'Tap the map below to place the pin.'}
              </p>
            )}
            <MapView
              center={coords ? [coords.lat, coords.lng] : position ? [position.lat, position.lng] : undefined}
              zoom={15}
              height={220}
              markers={markers}
              userPosition={position}
              onMapClick={(point) => setCoords(point)}
            />
          </div>

          <div>
            <span className="label">Photo (optional, max 5 MB)</span>
            {preview ? (
              <div className="relative mt-1 inline-block">
                <img src={preview} alt="Report attachment preview" className="h-24 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview('');
                  }}
                  className="absolute -top-2 -right-2 rounded-full bg-slate-900 p-1 text-white"
                  aria-label="Remove photo"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500 hover:border-brand-300 hover:bg-brand-50/40">
                <Camera size={15} className="text-brand-600" />
                Attach a photo (JPG, PNG or WEBP)
                <input type="file" accept="image/*" className="hidden" onChange={pickFile} />
              </label>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              Only attach a photo if it is safe to take one. Do not photograph people&apos;s faces.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-slate-50 p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand-600"
              checked={form.contactOk}
              onChange={(e) => setForm({ ...form, contactOk: e.target.checked })}
            />
            <span className="text-[11px] leading-snug text-slate-600">
              A moderator may contact me for clarification. My name and email are never shown on the
              public map.
            </span>
          </label>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner size={15} /> : <Send size={15} />}
            {busy ? 'Submitting for review…' : 'Submit report for verification'}
          </button>
        </form>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ShieldQuestion size={17} className="text-brand-600" /> Your reports
              </h2>
              <span className="text-xs text-slate-500">{mine.length} total</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <Spinner /> Loading…
              </div>
            ) : mine.length ? (
              <ul className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {mine.map((report) => (
                  <li key={report.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                          <span>{CATEGORY_META[report.category]?.emoji || '📝'}</span>
                          {report.categoryLabel}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                          {report.description}
                        </p>
                      </div>
                      <StatusPill status={report.status} />
                    </div>

                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock size={10} /> {formatDateTime(report.occurredAt)}
                    </p>

                    {report.adminNote ? (
                      <p className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                        <span className="font-semibold">Moderator:</span> {report.adminNote}
                      </p>
                    ) : null}

                    {report.imageUrl ? (
                      <img
                        src={report.imageUrl}
                        alt="Report attachment"
                        className="mt-2 h-20 w-full rounded-lg object-cover"
                      />
                    ) : null}

                    {report.status === 'pending' ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline"
                        onClick={() => setWithdrawing(report)}
                      >
                        <Trash2 size={11} /> Withdraw report
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState
                  icon={Flag}
                  title="No reports yet"
                  description="Your submitted reports and their verification status will appear here."
                />
              </div>
            )}
          </div>

          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 size={16} className="text-emerald-600" /> Verified alerts near you
            </h2>
            {nearby.length ? (
              <ul className="mt-2 space-y-2">
                {nearby.slice(0, 4).map((report) => (
                  <li key={report.id} className="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p className="text-xs font-semibold text-slate-800">{report.categoryLabel}</p>
                    <p className="line-clamp-2 text-[11px] text-slate-500">{report.description}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Verified {formatDateTime(report.verifiedAt)}
                      {report.isSample ? ' · sample data' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                No verified reports within 3 km of your location.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={Boolean(withdrawing)}
        title="Withdraw this report?"
        description="The report will be deleted before a moderator reviews it. This cannot be undone."
        confirmLabel="Withdraw"
        busy={withdrawBusy}
        onConfirm={withdraw}
        onCancel={() => setWithdrawing(null)}
      />
    </div>
  );
}
