export const CATEGORY_META = {
  unsafe_route: { label: 'Unsafe route', tone: 'amber', emoji: '🛣️' },
  poor_lighting: { label: 'Poor lighting', tone: 'amber', emoji: '💡' },
  harassment: { label: 'Harassment', tone: 'rose', emoji: '⚠️' },
  suspicious_activity: { label: 'Suspicious activity', tone: 'orange', emoji: '👀' },
  unsafe_place: { label: 'Unsafe place', tone: 'violet', emoji: '📍' },
  other: { label: 'Other concern', tone: 'slate', emoji: '📝' },
};

export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(value) {
  if (!value) return '—';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

export function scoreTone(score) {
  if (score == null) return { text: 'text-slate-600', bg: 'bg-slate-100', ring: 'ring-slate-200', bar: 'bg-slate-400' };
  if (score >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', bar: 'bg-emerald-500' };
  if (score >= 60) return { text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', bar: 'bg-amber-500' };
  return { text: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-200', bar: 'bg-rose-500' };
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function directionsLink(lat, lng, fromLat, fromLng) {
  const dest = `${lat},${lng}`;
  return fromLat != null
    ? `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${dest}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
}

export function formatLocalDateTimeInput(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
