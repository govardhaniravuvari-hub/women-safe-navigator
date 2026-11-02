import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  Flag,
  LayoutDashboard,
  LogOut,
  Megaphone,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Trash2,
  UserMinus,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import Logo from '../components/Logo';
import { Alert, ConfirmationDialog, EmptyState, PageLoader, Spinner, StatusPill } from '../components/ui';
import { del, get, patch, post } from '../lib/api';
import { CATEGORY_META, formatDate, formatDateTime } from '../lib/format';
import { useToast } from '../context/ToastProvider';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'reports', label: 'Safety reports', icon: Flag },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'directory', label: 'Service directory', icon: Building2 },
  { key: 'awareness', label: 'Awareness content', icon: BookOpen },
  { key: 'announce', label: 'Announcements', icon: Megaphone },
  { key: 'sos', label: 'SOS monitor', icon: Siren },
  { key: 'activity', label: 'Activity log', icon: Activity },
];

function StatCard({ label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-slate-900">{value}</p>
      {hint ? (
        <span className={`badge mt-2 ${tones[tone]}`}>{hint}</span>
      ) : null}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('pending');
  const [notes, setNotes] = useState({});
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [police, setPolice] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [directoryTab, setDirectoryTab] = useState('police');
  const [awareness, setAwareness] = useState([]);
  const [editingAwareness, setEditingAwareness] = useState(null);
  const [announcement, setAnnouncement] = useState({ title: '', body: '', link: '' });
  const [sosAlerts, setSosAlerts] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loadingTab, setLoadingTab] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const requireAdmin = useCallback(async () => {
    try {
      const data = await get('/admin/me');
      setAdmin(data.admin);
    } catch {
      navigate('/admin/login', { replace: true });
    } finally {
      setChecking(false);
    }
  }, [navigate]);

  useEffect(() => {
    requireAdmin();
  }, [requireAdmin]);

  const loadTab = useCallback(async () => {
    setLoadingTab(true);
    try {
      if (tab === 'overview' || tab === 'activity') {
        const [s, a] = await Promise.all([get('/admin/stats'), get('/admin/activity')]);
        setStats(s);
        setActivity(a);
      } else if (tab === 'reports') {
        const data = await get(`/admin/reports?status=${reportFilter}`);
        setReports(data.reports);
      } else if (tab === 'users') {
        const data = await get(`/admin/users${userSearch ? `?search=${encodeURIComponent(userSearch)}` : ''}`);
        setUsers(data.users);
      } else if (tab === 'directory') {
        const [p, h] = await Promise.all([get('/admin/police'), get('/admin/hospitals')]);
        setPolice(p.places);
        setHospitals(h.places);
      } else if (tab === 'awareness') {
        const data = await get('/admin/awareness');
        setAwareness(data.content);
      } else if (tab === 'sos') {
        const data = await get('/admin/sos');
        setSosAlerts(data.alerts);
      }
    } catch (err) {
      toast.error('Could not load data', err.message);
    } finally {
      setLoadingTab(false);
    }
  }, [tab, reportFilter, userSearch, toast]);

  useEffect(() => {
    if (admin) loadTab();
  }, [admin, loadTab]);

  const moderateReport = async (report, status) => {
    try {
      const data = await patch(`/admin/reports/${report.id}`, {
        status,
        adminNote: notes[report.id] || undefined,
      });
      toast.success('Report updated', data.message);
      setReports((prev) =>
        reportFilter === 'all'
          ? prev.map((r) => (r.id === report.id ? { ...r, status, adminNote: notes[report.id] } : r))
          : prev.filter((r) => r.id !== report.id),
      );
      setNotes((prev) => ({ ...prev, [report.id]: '' }));
    } catch (err) {
      toast.error('Could not update report', err.message);
    }
  };

  const toggleUser = async (user) => {
    const status = user.status === 'active' ? 'suspended' : 'active';
    try {
      const data = await patch(`/admin/users/${user.id}`, { status });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status } : u)));
      toast.success('User updated', data.message);
    } catch (err) {
      toast.error('Could not update user', err.message);
    }
  };

  const addDirectoryEntry = async (event, kind) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = {
      name: formData.get('name')?.toString().trim(),
      address: formData.get('address')?.toString().trim() || '',
      phone: formData.get('phone')?.toString().trim() || '',
      city: formData.get('city')?.toString().trim() || '',
      lat: Number(formData.get('lat')),
      lng: Number(formData.get('lng')),
    };
    if (kind === 'hospital') {
      payload.emergencyPhone = formData.get('emergencyPhone')?.toString().trim() || '';
      payload.type = 'hospital';
    }
    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
      toast.error('Invalid coordinates', 'Enter latitude and longitude of the facility.');
      return;
    }
    try {
      await post(kind === 'police' ? '/admin/police' : '/admin/hospitals', payload);
      toast.success('Directory updated', `${payload.name} added to the SAFEPATH directory.`);
      event.target.reset();
      loadTab();
    } catch (err) {
      toast.error('Could not add entry', err.message);
    }
  };

  const removeDirectoryEntry = async (kind, id) => {
    try {
      await del(kind === 'police' ? `/admin/police/${id}` : `/admin/hospitals/${id}`);
      toast.success('Entry removed');
      loadTab();
    } catch (err) {
      toast.error('Could not remove entry', err.message);
    } finally {
      setConfirm(null);
    }
  };

  const saveAwareness = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = {
      slug: formData.get('slug')?.toString().trim(),
      title: formData.get('title')?.toString().trim(),
      summary: formData.get('summary')?.toString().trim() || '',
      body: formData.get('body')?.toString().trim(),
      category: formData.get('category')?.toString(),
      icon: formData.get('icon')?.toString().trim() || '',
      source: formData.get('source')?.toString().trim() || '',
      sortOrder: Number(formData.get('sortOrder') || 0),
      isPublished: formData.get('isPublished') === 'on',
    };
    try {
      if (editingAwareness?.id) {
        await patch(`/admin/awareness/${editingAwareness.id}`, payload);
        toast.success('Guide updated');
      } else {
        await post('/admin/awareness', payload);
        toast.success('Guide published');
      }
      setEditingAwareness(null);
      event.target.reset();
      loadTab();
    } catch (err) {
      toast.error('Could not save guide', err.message);
    }
  };

  const sendAnnouncement = async (event) => {
    event.preventDefault();
    try {
      const data = await post('/admin/announcements', announcement);
      toast.success('Announcement sent', data.message);
      setAnnouncement({ title: '', body: '', link: '' });
    } catch (err) {
      toast.error('Could not send announcement', err.message);
    }
  };

  const handleLogout = async () => {
    await post('/admin/logout').catch(() => {});
    navigate('/admin/login', { replace: true });
  };

  if (checking) return <PageLoader label="Verifying administrator access…" />;
  if (!admin) return null;

  return (
    <div className="min-h-screen bg-[#f8f7fc]">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
          <Logo to="/admin" size={36} compact />
          <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-200">
            <ShieldCheck size={12} /> Admin console
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn-ghost text-xs" onClick={loadTab} disabled={loadingTab}>
              {loadingTab ? <Spinner size={14} /> : <RefreshCw size={14} />} Refresh
            </button>
            <span className="hidden text-xs text-slate-500 sm:inline">
              {admin.name} · {admin.role.replace('_', ' ')}
            </span>
            <button type="button" className="btn-secondary text-xs" onClick={handleLogout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 no-scrollbar lg:px-8">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                tab === item.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-brand-50'
              }`}
            >
              <item.icon size={14} /> {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8">
        {tab === 'overview' && stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Registered users" value={stats.totals.users} hint={`${stats.totals.active_users} active`} />
              <StatCard label="Safety reports" value={stats.totals.reports} hint={`${stats.totals.pending_reports} pending`} tone="amber" />
              <StatCard label="Verified alerts" value={stats.totals.verified_reports} hint={`${stats.totals.rejected_reports} rejected`} tone="emerald" />
              <StatCard label="SOS alerts" value={stats.totals.sos_alerts} hint={`${stats.totals.active_sos} active`} tone="rose" />
              <StatCard label="Trusted contacts" value={stats.totals.contacts} hint="stored" />
              <StatCard label="Active live shares" value={stats.totals.active_shares} hint="right now" tone="emerald" />
              <StatCard label="New users (14 days)" value={stats.signups.reduce((sum, s) => sum + s.count, 0)} hint="signups" />
              <StatCard label="Open reports today" value={stats.recentReports.filter((r) => r.status === 'pending').length} hint="from latest 8" tone="amber" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="text-sm font-bold text-slate-900">Verified reports by category</h2>
                {stats.byCategory.length ? (
                  <ul className="mt-3 space-y-2">
                    {stats.byCategory.map((row) => {
                      const max = Math.max(...stats.byCategory.map((r) => r.count));
                      return (
                        <li key={row.category}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">{row.label}</span>
                            <span className="font-bold text-slate-900">{row.count}</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${(row.count / max) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No verified reports yet.</p>
                )}
              </div>

              <div className="card p-5">
                <h2 className="text-sm font-bold text-slate-900">Latest submissions</h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {stats.recentReports.map((report) => (
                    <li key={report.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {CATEGORY_META[report.category]?.emoji} {report.category.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {report.reporter} · {formatDateTime(report.created_at)}
                        </p>
                      </div>
                      <StatusPill status={report.status} />
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn-secondary mt-3 w-full text-xs" onClick={() => setTab('reports')}>
                  Open moderation queue
                </button>
              </div>
            </div>
          </>
        ) : null}

        {tab === 'reports' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {['pending', 'verified', 'rejected', 'all'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setReportFilter(status)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    reportFilter === status
                      ? 'border-brand-500 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {loadingTab ? (
              <div className="card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
                <Spinner /> Loading reports…
              </div>
            ) : reports.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {reports.map((report) => (
                  <div key={report.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {CATEGORY_META[report.category]?.emoji} {report.categoryLabel}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {report.reporter} ({report.reporterEmail}) · reported {formatDateTime(report.occurredAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusPill status={report.status} />
                        <span className="badge bg-slate-100 text-slate-600 capitalize">{report.severity} severity</span>
                        {report.isSample ? (
                          <span className="badge bg-amber-50 text-amber-700">sample data</span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{report.description}</p>

                    <p className="mt-2 text-[11px] text-slate-500">
                      📍 {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                      {report.address ? ` · ${report.address}` : ''} ·{' '}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=18/${report.lat}/${report.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand-700 underline"
                      >
                        view on map
                      </a>
                    </p>

                    {report.imageUrl ? (
                      <a href={report.imageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={report.imageUrl}
                          alt="Report attachment"
                          className="mt-2 h-32 w-full rounded-xl object-cover"
                        />
                      </a>
                    ) : null}

                    {report.status === 'pending' ? (
                      <div className="mt-3 space-y-2">
                        <input
                          className="input text-xs"
                          placeholder="Moderator note (optional, shown to the reporter)"
                          value={notes[report.id] || ''}
                          maxLength={400}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary flex-1 text-xs"
                            onClick={() => moderateReport(report, 'verified')}
                          >
                            <CheckCircle2 size={14} /> Verify &amp; publish
                          </button>
                          <button
                            type="button"
                            className="btn-secondary flex-1 text-xs text-rose-600"
                            onClick={() => moderateReport(report, 'rejected')}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-[11px] text-slate-500">
                          {report.adminNote ? `Note: ${report.adminNote}` : `Verified ${formatDateTime(report.verifiedAt)}`}
                        </p>
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => moderateReport(report, 'pending')}
                        >
                          Reopen
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Flag}
                title={`No ${reportFilter} reports`}
                description="Nothing to moderate in this queue right now."
              />
            )}
          </>
        ) : null}

        {tab === 'users' ? (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Search by name, email or city"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
              <button type="button" className="btn-primary text-xs" onClick={loadTab}>
                <Search size={14} /> Search
              </button>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Contacts</th>
                    <th className="px-4 py-3">Reports</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Last login</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{user.fullName}</p>
                        <p className="text-[11px] text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{user.city || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{user.contacts}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{user.reports}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'never'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={user.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className={`btn-ghost text-xs ${user.status === 'active' ? 'text-rose-600' : 'text-emerald-600'}`}
                          onClick={() => toggleUser(user)}
                        >
                          {user.status === 'active' ? (
                            <>
                              <UserMinus size={13} /> Suspend
                            </>
                          ) : (
                            <>
                              <UserCheck size={13} /> Reactivate
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No users matched.</p>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === 'directory' ? (
          <>
            <div className="flex gap-2">
              {[
                ['police', 'Police stations'],
                ['hospital', 'Hospitals & clinics'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDirectoryTab(key)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    directoryTab === key
                      ? 'border-brand-500 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Alert tone="info" title="Directory is a fallback, not the primary source">
              Nearby services come from live OpenStreetMap data first. Entries here are used when
              OpenStreetMap is unreachable, so add only facilities you have verified yourself — including
              their real phone numbers.
            </Alert>

            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <form
                className="card space-y-3 p-5"
                onSubmit={(event) => addDirectoryEntry(event, directoryTab)}
              >
                <h2 className="text-sm font-bold text-slate-900">
                  Add {directoryTab === 'police' ? 'police station' : 'hospital'}
                </h2>
                <input name="name" className="input" placeholder="Facility name" required />
                <input name="address" className="input" placeholder="Address" />
                <input name="city" className="input" placeholder="City" />
                <input
                  name="phone"
                  className="input"
                  placeholder={directoryTab === 'police' ? 'Control room phone' : 'Phone'}
                />
                {directoryTab === 'hospital' ? (
                  <input name="emergencyPhone" className="input" placeholder="Emergency phone" />
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <input name="lat" className="input" placeholder="Latitude" required />
                  <input name="lng" className="input" placeholder="Longitude" required />
                </div>
                <button type="submit" className="btn-primary w-full text-xs">
                  Add to directory
                </button>
              </form>

              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Coordinates</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(directoryTab === 'police' ? police : hospitals).map((place) => (
                      <tr key={place.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{place.name}</p>
                          <p className="text-[11px] text-slate-500">{place.address || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{place.city || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {place.emergency_phone || place.phone || '—'}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">
                          {Number(place.latitude).toFixed(4)}, {Number(place.longitude).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="badge bg-slate-100 text-slate-600">{place.source}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="btn-ghost text-xs text-rose-600"
                            onClick={() =>
                              setConfirm({
                                title: `Remove ${place.name}?`,
                                description: 'It will no longer appear in the fallback directory.',
                                action: () => removeDirectoryEntry(directoryTab, place.id),
                              })
                            }
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!(directoryTab === 'police' ? police : hospitals).length ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    No directory entries yet. Live OpenStreetMap results are used first.
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {tab === 'awareness' ? (
          <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <form className="card space-y-3 p-5" onSubmit={saveAwareness} key={editingAwareness?.id || 'new'}>
              <h2 className="text-sm font-bold text-slate-900">
                {editingAwareness ? 'Edit guide' : 'Create a safety guide'}
              </h2>
              <input
                name="title"
                className="input"
                placeholder="Guide title"
                defaultValue={editingAwareness?.title || ''}
                required
              />
              <input
                name="slug"
                className="input"
                placeholder="slug-lowercase-with-dashes"
                defaultValue={editingAwareness?.slug || ''}
                pattern="[a-z0-9-]+"
                required
              />
              <select name="category" className="input" defaultValue={editingAwareness?.category || 'travel'}>
                {['travel', 'night', 'digital', 'emergency', 'navigation', 'helplines', 'general'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                name="summary"
                className="input"
                placeholder="One-line summary"
                defaultValue={editingAwareness?.summary || ''}
              />
              <textarea
                name="body"
                className="input min-h-40 resize-y"
                placeholder="One tip per line — each line becomes a bullet point"
                defaultValue={editingAwareness?.body || ''}
                required
              />
              <input
                name="source"
                className="input"
                placeholder="Source (e.g. NCW advisory, 112 portal)"
                defaultValue={editingAwareness?.source || ''}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="icon"
                  className="input"
                  placeholder="icon key (moon, route…)"
                  defaultValue={editingAwareness?.icon || ''}
                />
                <input
                  name="sortOrder"
                  type="number"
                  className="input"
                  placeholder="Order"
                  defaultValue={editingAwareness?.sort_order ?? 0}
                  min="0"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="isPublished"
                  className="size-4 accent-brand-600"
                  defaultChecked={editingAwareness ? Boolean(editingAwareness.is_published) : true}
                />
                Published (visible to users)
              </label>
              <div className="flex gap-2">
                {editingAwareness ? (
                  <button
                    type="button"
                    className="btn-secondary flex-1 text-xs"
                    onClick={() => setEditingAwareness(null)}
                  >
                    Cancel
                  </button>
                ) : null}
                <button type="submit" className="btn-primary flex-1 text-xs">
                  {editingAwareness ? 'Save changes' : 'Publish guide'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {awareness.map((item) => (
                <div key={item.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.slug} · {item.category} · order {item.sort_order}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`badge ${item.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.is_published ? 'published' : 'hidden'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{item.summary}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-secondary text-xs" onClick={() => setEditingAwareness(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={async () => {
                        await patch(`/admin/awareness/${item.id}`, { isPublished: !item.is_published });
                        loadTab();
                      }}
                    >
                      {item.is_published ? 'Hide' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs text-rose-600"
                      onClick={() =>
                        setConfirm({
                          title: `Delete "${item.title}"?`,
                          description: 'This removes the guide from the awareness section.',
                          action: async () => {
                            await del(`/admin/awareness/${item.id}`);
                            toast.success('Guide deleted');
                            loadTab();
                            setConfirm(null);
                          },
                        })
                      }
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
              {!awareness.length ? <EmptyState icon={BookOpen} title="No guides yet" /> : null}
            </div>
          </div>
        ) : null}

        {tab === 'announce' ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <form className="card space-y-3 p-5" onSubmit={sendAnnouncement}>
              <h2 className="text-sm font-bold text-slate-900">Send a safety announcement</h2>
              <p className="text-xs text-slate-500">
                Creates an in-app notification for every active user. Use it sparingly, for genuinely
                important information.
              </p>
              <input
                className="input"
                placeholder="Announcement title"
                value={announcement.title}
                onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
                required
              />
              <textarea
                className="input min-h-32 resize-y"
                placeholder="What should users know?"
                value={announcement.body}
                onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Link (optional, e.g. /awareness)"
                value={announcement.link}
                onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })}
              />
              <button type="submit" className="btn-primary w-full text-xs">
                <Megaphone size={14} /> Send to all active users
              </button>
            </form>

            <Alert tone="warning" title="Not an emergency channel">
              Announcements appear in the app only. They do not send SMS or email and cannot alert
              someone in danger. Encourage users to call 112.
            </Alert>
          </div>
        ) : null}

        {tab === 'sos' ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contacts notified</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sosAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{alert.userName}</p>
                      <p className="text-[11px] text-slate-500">
                        {alert.userPhone || alert.userEmail}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(alert.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {alert.lat != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-brand-700 underline"
                        >
                          {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                        </a>
                      ) : (
                        'not captured'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{alert.contactsNotified}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={alert.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sosAlerts.length ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No SOS alerts recorded.</p>
            ) : null}
          </div>
        ) : null}

        {tab === 'activity' && activity ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Activity size={16} className="text-brand-600" /> Administrator audit log
              </h2>
              <ul className="mt-3 space-y-2">
                {activity.audit.map((entry) => (
                  <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-800">
                      {entry.adminName} · {entry.action} · {entry.entity}
                      {entry.entityId ? ` #${entry.entityId}` : ''}
                    </p>
                    {entry.detail ? <p className="text-[11px] text-slate-600">{entry.detail}</p> : null}
                    <p className="text-[10px] text-slate-400">{formatDateTime(entry.createdAt)}</p>
                  </li>
                ))}
                {!activity.audit.length ? (
                  <p className="text-sm text-slate-500">No administrator actions logged yet.</p>
                ) : null}
              </ul>
            </div>

            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Clock size={16} className="text-brand-600" /> Recent user logins
                </h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {activity.recentLogins.map((login) => (
                    <li key={login.id} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{login.full_name}</p>
                        <p className="truncate text-[11px] text-slate-500">{login.email}</p>
                      </div>
                      <span className="text-[11px] text-slate-500">{formatDateTime(login.last_login_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-5">
                <h2 className="text-sm font-bold text-slate-900">Live location sharing</h2>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] tracking-wide text-slate-500 uppercase">Total sessions</p>
                    <p className="text-lg font-bold text-slate-900">{activity.sharing.total}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] tracking-wide text-slate-500 uppercase">Active now</p>
                    <p className="text-lg font-bold text-slate-900">{activity.sharing.active}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Only aggregate counts are shown. Administrators cannot read a user&apos;s live location.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {loadingTab && tab !== 'reports' ? (
          <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Spinner size={14} /> Loading…
          </p>
        ) : null}
      </main>

      <ConfirmationDialog
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        description={confirm?.description}
        confirmLabel="Confirm"
        onConfirm={confirm?.action}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
