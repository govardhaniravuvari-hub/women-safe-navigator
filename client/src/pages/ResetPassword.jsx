import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Alert, Spinner } from '../components/ui';
import { post } from '../lib/api';
import { useToast } from '../context/ToastProvider';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const data = await post('/auth/reset-password', { token, ...form });
      setDone(true);
      toast.success('Password updated', data.message);
      window.setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Reset links expire after 30 minutes and work once.">
      {!token ? (
        <Alert tone="error" title="Missing reset token">
          Open the reset link from your email again, or{' '}
          <Link to="/forgot-password" className="font-semibold underline">
            request a new one
          </Link>
          .
        </Alert>
      ) : done ? (
        <Alert tone="success" title="Password changed" icon={ShieldCheck}>
          You can now sign in with your new password. Redirecting…
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Spinner size={16} /> : <ShieldCheck size={16} />}
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
