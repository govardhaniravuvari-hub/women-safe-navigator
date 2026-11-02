import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Alert, Spinner } from '../components/ui';
import { post } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await post('/auth/forgot-password', { email: email.trim() });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll create a reset link for your account."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {result ? (
        <div className="space-y-4">
          <Alert tone={result.emailSent ? 'success' : 'warning'} title={result.emailSent ? 'Check your inbox' : 'Email delivery not configured'} icon={MailCheck}>
            {result.message}
          </Alert>

          {result.resetUrl ? (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm">
              <p className="font-semibold text-brand-900">Reset link (shown because email is not configured)</p>
              <p className="mt-1 text-xs text-brand-800">{result.note}</p>
              <Link
                to={`/reset-password?token=${result.resetToken}`}
                className="btn-primary mt-3 w-full"
              >
                <KeyRound size={15} /> Open reset page
              </Link>
              <p className="mt-2 break-all font-mono text-[10px] text-brand-700">{result.resetUrl}</p>
            </div>
          ) : null}

          <button type="button" className="btn-secondary w-full" onClick={() => setResult(null)}>
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div>
            <label className="label" htmlFor="email">Registered email address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Spinner size={16} /> : <KeyRound size={16} />}
            {busy ? 'Creating reset link…' : 'Send reset link'}
          </button>
          <p className="text-[11px] leading-relaxed text-slate-400">
            If SMTP is configured on the server, the link is emailed. Otherwise the link is shown on
            screen so the demo still works — this is stated clearly rather than pretending an email
            was sent.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
