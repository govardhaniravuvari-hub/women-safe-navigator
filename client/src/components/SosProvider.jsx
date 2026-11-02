import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Loader2, PhoneCall, ShieldAlert, X } from 'lucide-react';
import { post } from '../lib/api';
import { mapsLink } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const SosContext = createContext(null);

function currentPosition(timeout = 9000) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ error: 'This device does not support GPS.' });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) =>
        resolve({
          error:
            err.code === 1
              ? 'Location permission was denied, so your location could not be attached.'
              : 'Your location could not be determined in time.',
        }),
      { enableHighAccuracy: true, timeout, maximumAge: 5000 },
    );
  });
}

export function SosProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('confirm'); // confirm | sending | result
  const [countdown, setCountdown] = useState(5);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [locationState, setLocationState] = useState(null);
  const timerRef = useRef(null);
  const toast = useToast();

  const reset = useCallback(() => {
    setPhase('confirm');
    setCountdown(5);
    setResult(null);
    setError(null);
    setMessage('');
    setLocationState(null);
    window.clearInterval(timerRef.current);
  }, []);

  const close = useCallback(() => {
    window.clearInterval(timerRef.current);
    setOpen(false);
    reset();
  }, [reset]);

  const send = useCallback(async () => {
    window.clearInterval(timerRef.current);
    setPhase('sending');
    setError(null);
    const pos = await currentPosition();
    setLocationState(pos);
    try {
      const data = await post('/sos', {
        lat: pos.lat ?? null,
        lng: pos.lng ?? null,
        accuracy: pos.accuracy ?? null,
        message: message.trim() || undefined,
      });
      setResult(data);
      setPhase('result');
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('SAFEPATH SOS activated', {
          body: data.delivery?.message || 'Your emergency alert was recorded.',
        });
      }
    } catch (err) {
      setError(err.message || 'Could not send the SOS alert.');
      setPhase('result');
    }
  }, [message]);

  const openSos = useCallback(() => {
    reset();
    setOpen(true);
    setCountdown(5);
    let remaining = 5;
    timerRef.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(timerRef.current);
        send();
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, send]);

  useEffect(() => () => window.clearInterval(timerRef.current), []);

  const cancelAlert = useCallback(async () => {
    if (!result?.alert?.id) return;
    try {
      const data = await post(`/sos/${result.alert.id}/cancel`);
      toast.success('SOS cancelled', data.message);
      close();
    } catch (err) {
      toast.error('Could not cancel', err.message);
    }
  }, [result, toast, close]);

  const copyLocation = useCallback(() => {
    const link = result?.alert?.mapsLink;
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => toast.success('Location link copied', 'Paste it into a message to anyone who can help.'),
      () => toast.error('Copy failed', 'Select and copy the link manually.'),
    );
  }, [result, toast]);

  const value = useMemo(() => ({ openSos }), [openSos]);

  const deliveryTone =
    result?.delivery?.level === 'sent'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : result?.delivery?.level === 'partial'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-rose-200 bg-rose-50 text-rose-900';

  return (
    <SosContext.Provider value={value}>
      {children}

      {open ? (
        <div className="fixed inset-0 z-[900] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="animate-fade-up w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <ShieldAlert size={22} />
                <div>
                  <p className="text-sm font-bold tracking-wide uppercase">Emergency SOS</p>
                  <p className="text-xs text-white/85">
                    {phase === 'confirm'
                      ? `Sending in ${Math.max(countdown, 0)} second${countdown === 1 ? '' : 's'} — cancel if this was a mistake.`
                      : phase === 'sending'
                        ? 'Getting your location and alerting your contacts…'
                        : 'Emergency alert status'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-full bg-white/15 p-1.5 transition hover:bg-white/25"
                aria-label="Close SOS dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              {phase === 'confirm' ? (
                <>
                  <p className="text-sm text-slate-600">
                    SAFEPATH will share your live location with your trusted contacts and log this
                    emergency. It will <strong>not</strong> call the police for you — dial 112 yourself
                    if you are in immediate danger.
                  </p>
                  <div>
                    <label className="label" htmlFor="sos-message">
                      Optional message for your contacts
                    </label>
                    <input
                      id="sos-message"
                      className="input"
                      placeholder="e.g. I am being followed near the metro station"
                      value={message}
                      maxLength={400}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="btn-secondary" onClick={close}>
                      Cancel
                    </button>
                    <button type="button" className="btn-danger" onClick={send}>
                      <AlertTriangle size={16} /> Send now
                    </button>
                  </div>
                  <a
                    href="tel:112"
                    className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
                  >
                    <PhoneCall size={16} /> Call 112 (India emergency)
                  </a>
                </>
              ) : null}

              {phase === 'sending' ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Loader2 size={30} className="animate-spin text-rose-600" />
                  <p className="text-sm font-medium text-slate-700">Sending your SOS…</p>
                  <p className="text-xs text-slate-500">Allow location access if your browser asks.</p>
                </div>
              ) : null}

              {phase === 'result' ? (
                <>
                  {error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <p className="font-semibold">The SOS alert could not be created</p>
                      <p className="mt-1">{error}</p>
                      <p className="mt-2 font-medium">
                        Call 112 and your contacts directly using the numbers below.
                      </p>
                    </div>
                  ) : null}

                  {result ? (
                    <>
                      <div className={`rounded-xl border px-4 py-3 text-sm ${deliveryTone}`}>
                        <div className="flex items-center gap-2 font-semibold">
                          {result.delivery.level === 'sent' ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          Delivery status: {result.delivery.level.replace('_', ' ')}
                        </div>
                        <p className="mt-1.5 leading-snug">{result.delivery.message}</p>
                        {result.delivery.channels?.email || result.delivery.channels?.webhook ? null : (
                          <p className="mt-2 text-xs opacity-80">
                            Email/SMS delivery is not configured on this server, so no message left
                            SAFEPATH. This is shown honestly rather than claiming an alert was sent.
                          </p>
                        )}
                      </div>

                      {locationState?.error ? (
                        <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                          {locationState.error}
                        </p>
                      ) : null}

                      {result.alert?.mapsLink ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={result.alert.mapsLink}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary text-xs"
                          >
                            Open my location in Google Maps
                          </a>
                          <button type="button" className="btn-ghost text-xs" onClick={copyLocation}>
                            <Copy size={14} /> Copy link
                          </button>
                        </div>
                      ) : null}

                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          Call your emergency contacts
                        </p>
                        {result.contacts?.length ? (
                          <ul className="space-y-2">
                            {result.contacts.map((contact) => (
                              <li
                                key={contact.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">
                                    {contact.name}
                                    {contact.isPrimary ? (
                                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                                        PRIMARY
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {contact.relationship || 'Contact'} · {contact.phone}
                                  </p>
                                </div>
                                <a href={`tel:${contact.phone}`} className="btn-primary px-3 py-1.5 text-xs">
                                  <PhoneCall size={13} /> Call
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
                            You have no trusted contacts saved yet.{' '}
                            <a href="/contacts" className="font-semibold text-brand-700 underline">
                              Add emergency contacts
                            </a>{' '}
                            so future alerts can reach them.
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <a href="tel:112" className="btn-danger">
                          <PhoneCall size={16} /> Call 112
                        </a>
                        <button type="button" className="btn-secondary" onClick={cancelAlert}>
                          I&apos;m safe — cancel alert
                        </button>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </SosContext.Provider>
  );
}

export function useSos() {
  const ctx = useContext(SosContext);
  if (!ctx) throw new Error('useSos must be used inside SosProvider');
  return ctx;
}
