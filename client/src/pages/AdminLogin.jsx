import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Logo, { LogoMark } from '../components/Logo';
import { Alert, Spinner } from '../components/ui';
import { get, post } from '../lib/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get('/admin/me')
      .then(() => navigate('/admin', { replace: true }))
      .catch(() => {});
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await post('/admin/login', { email: form.email.trim(), password: form.password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2.5">
            <LogoMark size={40} />
            <span className="text-xl font-extrabold text-white">
              SAFE<span className="text-blush-400">PATH</span>
            </span>
          </div>
          <p className="mt-2 text-xs tracking-wide text-brand-200 uppercase">Administrator console</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="text-xl font-extrabold text-slate-900">Administrator sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review reports, manage the service directory and monitor activity.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {error ? <Alert tone="error">{error}</Alert> : null}

            <div>
              <label className="label" htmlFor="admin-email">Administrator email</label>
              <input
                id="admin-email"
                type="email"
                className="input"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                className="input"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? <Spinner size={16} /> : <ShieldCheck size={16} />}
              {busy ? 'Signing in…' : 'Sign in to admin console'}
            </button>
          </form>

          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            Administrator accounts are seeded from <code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code>{' '}
            in the server <code>.env</code> file. Change the default before presenting the project.
          </p>

          <div className="mt-4 flex items-center justify-between text-xs">
            <Link to="/" className="text-slate-500 hover:text-brand-700">← Back to SAFEPATH</Link>
            <Link to="/login" className="font-semibold text-brand-700 hover:underline">User sign in</Link>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-brand-300">
          Administrator access is logged and audited.
        </p>
      </div>
    </div>
  );
}
