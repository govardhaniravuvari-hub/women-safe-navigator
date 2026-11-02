import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  KeyRound,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Alert, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthProvider';
import { get, patch, post } from '../lib/api';
import { formatDate, initials } from '../lib/format';
import { useToast } from '../context/ToastProvider';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    city: '',
    bloodGroup: '',
    medicalNotes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changing, setChanging] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        city: user.city || '',
        bloodGroup: user.bloodGroup || '',
        medicalNotes: user.medicalNotes || '',
      });
    }
  }, [user]);

  useEffect(() => {
    get('/users/me/summary')
      .then(setSummary)
      .catch(() => {});
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = await patch('/users/me', form);
      setUser(data.user);
      toast.success('Profile updated', 'Your details are saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setChanging(true);
    try {
      const data = await post('/users/me/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Password changed', data.message);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChanging(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Account</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Your profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep this accurate — your name and city appear on the private live-share page, nothing more.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <form onSubmit={saveProfile} className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UserRound size={17} className="text-brand-600" /> Personal details
            </h2>
            {error ? <Alert tone="error">{error}</Alert> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  className="input"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="email">Email (cannot be changed)</label>
                <input id="email" className="input bg-slate-50" value={user?.email || ''} disabled />
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="label" htmlFor="city">City</label>
                <input
                  id="city"
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Bengaluru"
                />
              </div>
              <div>
                <label className="label" htmlFor="bloodGroup">Blood group (optional)</label>
                <input
                  id="bloodGroup"
                  className="input"
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  placeholder="O+"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="label" htmlFor="medicalNotes">Medical notes (optional)</label>
                <input
                  id="medicalNotes"
                  className="input"
                  value={form.medicalNotes}
                  onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
                  placeholder="Allergies, conditions"
                  maxLength={400}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size={15} /> : <Save size={15} />} Save changes
            </button>
          </form>

          <form onSubmit={changePassword} className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <KeyRound size={17} className="text-brand-600" /> Change password
            </h2>
            {passwordError ? <Alert tone="error">{passwordError}</Alert> : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="currentPassword">Current password</label>
                <input
                  id="currentPassword"
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="newPassword">New password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              At least 8 characters with a letter and a number. You will stay signed in on this device.
            </p>
            <button type="submit" className="btn-secondary" disabled={changing}>
              {changing ? <Spinner size={15} /> : <ShieldCheck size={15} />} Update password
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="card p-5 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-600 text-xl font-extrabold text-white">
              {initials(user?.fullName || 'User')}
            </span>
            <p className="mt-3 font-bold text-slate-900">{user?.fullName}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <p className="mt-1 text-[11px] text-slate-400">Member since {formatDate(user?.createdAt)}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-sm font-bold text-slate-900">{summary?.stats.contacts ?? '–'}</p>
                <p className="text-[10px] text-slate-500">Contacts</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-sm font-bold text-slate-900">{summary?.stats.myReports ?? '–'}</p>
                <p className="text-[10px] text-slate-500">Reports</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-sm font-bold text-slate-900">{summary?.stats.unreadNotifications ?? '–'}</p>
                <p className="text-[10px] text-slate-500">Unread</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold text-slate-900">Data &amp; privacy</h2>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-600">
              <li>• Your password is stored as a bcrypt hash, never in plain text.</li>
              <li>• Location history keeps your last 500 GPS fixes, visible only to you.</li>
              <li>• Public reports show the incident, never your name or email.</li>
              <li>• Live links contain only your first name, city and coordinates.</li>
            </ul>
            <Link to="/contacts" className="btn-secondary mt-3 w-full text-xs">
              Manage trusted contacts
            </Link>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold text-slate-900">Session</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Signed in with a secure httpOnly cookie. Signing out clears it on this device.
            </p>
            <button type="button" className="btn-danger mt-3 w-full text-xs" onClick={handleLogout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
