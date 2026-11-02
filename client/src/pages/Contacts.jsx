import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Pencil,
  PhoneCall,
  Plus,
  Star,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Alert, ConfirmationDialog, EmptyState, Spinner } from '../components/ui';
import { del, get, patch, post } from '../lib/api';
import { useToast } from '../context/ToastProvider';

const EMPTY = { name: '', phone: '', email: '', relationship: '', isPrimary: false };

const RELATIONSHIPS = ['Mother', 'Father', 'Sister', 'Brother', 'Spouse', 'Friend', 'Roommate', 'Colleague', 'Neighbour', 'Other'];

export default function Contacts() {
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await get('/contacts');
      setContacts(data.contacts);
    } catch (err) {
      toast.error('Could not load contacts', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.name.trim().length < 2) {
      setError('Enter the contact name.');
      return;
    }
    if (!/^[0-9+\-\s()]{6,20}$/.test(form.phone.trim())) {
      setError('Enter a valid phone number (6–20 digits, + and spaces allowed).');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || '',
        relationship: form.relationship.trim(),
        isPrimary: form.isPrimary,
      };
      if (editingId) {
        const data = await patch(`/contacts/${editingId}`, payload);
        setContacts((prev) => prev.map((c) => (c.id === editingId ? data.contact : c)));
        toast.success('Contact updated', data.message);
      } else {
        const data = await post('/contacts', payload);
        setContacts((prev) => {
          const next = [data.contact, ...prev];
          return payload.isPrimary ? next.map((c) => ({ ...c, isPrimary: c.id === data.contact.id })) : next;
        });
        toast.success('Contact added', data.message);
      }
      setForm(EMPTY);
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (contact) => {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      relationship: contact.relationship || '',
      isPrimary: contact.isPrimary,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const makePrimary = async (contact) => {
    try {
      await patch(`/contacts/${contact.id}`, { isPrimary: true });
      setContacts((prev) => prev.map((c) => ({ ...c, isPrimary: c.id === contact.id })));
      toast.success('Primary contact updated', `${contact.name} will be listed first for emergencies.`);
    } catch (err) {
      toast.error('Could not update', err.message);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await del(`/contacts/${deleting.id}`);
      setContacts((prev) => prev.filter((c) => c.id !== deleting.id));
      toast.success('Contact removed');
      setDeleting(null);
    } catch (err) {
      toast.error('Could not remove contact', err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Emergency contacts</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Your trusted circle</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          These are the people SAFEPATH can alert during an SOS and the ones you can send a live
          location link to. Up to 10 contacts, one marked primary.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <UserPlus size={17} className="text-brand-600" />
            {editingId ? 'Edit contact' : 'Add a trusted contact'}
          </h2>

          {error ? <Alert tone="error">{error}</Alert> : null}

          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input
              id="name"
              className="input"
              placeholder="e.g. Anita Sharma"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input
              id="phone"
              className="input"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="email">
              Email <span className="font-normal normal-case text-slate-400">(needed for SOS emails)</span>
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="name@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="relationship">Relationship</label>
            <select
              id="relationship"
              className="input"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            >
              <option value="">Select relationship</option>
              {RELATIONSHIPS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand-600"
              checked={form.isPrimary}
              onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Make this the primary contact</span>
              <span className="block text-[11px] text-slate-500">
                Shown first during an SOS. Only one contact can be primary.
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            {editingId ? (
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                  setError('');
                }}
              >
                Cancel
              </button>
            ) : null}
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? <Spinner size={15} /> : <Plus size={15} />}
              {editingId ? 'Save changes' : 'Add contact'}
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            Phone numbers are stored in the SAFEPATH database and only used for the calls you start
            yourself. Email addresses are used only for SOS alerts when the server has SMTP configured.
          </p>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Users size={17} className="text-brand-600" /> Saved contacts ({contacts.length}/10)
            </h2>
          </div>

          {loading ? (
            <div className="card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <Spinner /> Loading contacts…
            </div>
          ) : contacts.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <li key={contact.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-bold text-slate-900">
                        {contact.name}
                        {contact.isPrimary ? (
                          <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                            <Star size={10} /> Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {contact.relationship || 'Contact'}
                      </p>
                    </div>
                    <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                      {contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </span>
                  </div>

                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <PhoneCall size={12} className="text-slate-400" />
                      <a href={`tel:${contact.phone}`} className="font-medium hover:text-brand-700">
                        {contact.phone}
                      </a>
                    </div>
                    {contact.email ? (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <BadgeCheck size={12} className="text-slate-400" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-600">No email — SMS/call only for alerts.</p>
                    )}
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <a href={`tel:${contact.phone}`} className="btn-secondary px-2.5 py-1.5 text-[11px]">
                      <PhoneCall size={12} /> Call
                    </a>
                    {!contact.isPrimary ? (
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1.5 text-[11px]"
                        onClick={() => makePrimary(contact)}
                      >
                        <Star size={12} /> Make primary
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1.5 text-[11px]"
                      onClick={() => startEdit(contact)}
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1.5 text-[11px] text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleting(contact)}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title="No trusted contacts yet"
              description="Add at least one person — ideally with an email address — so SOS alerts have somewhere to go."
            />
          )}

          <Alert tone="warning" title="Verify your contacts">
            SAFEPATH cannot confirm that a phone number or email belongs to the person you added. Tell
            each contact they are on your list, and test the flow before you rely on it.
          </Alert>
        </div>
      </div>

      <ConfirmationDialog
        open={Boolean(deleting)}
        title={`Remove ${deleting?.name || 'contact'}?`}
        description="They will no longer receive SOS alerts or live location links from you."
        confirmLabel="Remove contact"
        busy={deleteBusy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
