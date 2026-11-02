/** Geospatial helpers. */

const R = 6371e3; // earth radius (m)

export function haversineMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isValidCoord(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Interpolate n points (incl. endpoints) along a polyline given as [lng,lat] pairs. */
export function samplePolyline(coords, count = 6) {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  if (coords.length === 1) return [{ lat: coords[0][1], lng: coords[0][0] }];
  const points = coords.map(([lng, lat]) => ({ lat, lng }));
  const out = [];
  const segments = points.length - 1;
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * segments;
    const idx = Math.min(Math.floor(t), segments - 1);
    const frac = t - idx;
    const p1 = points[idx];
    const p2 = points[idx + 1];
    out.push({
      lat: p1.lat + (p2.lat - p1.lat) * frac,
      lng: p1.lng + (p2.lng - p1.lng) * frac,
    });
  }
  return out;
}

export function bboxAround(lat, lng, radiusMeters) {
  const dLat = (radiusMeters / R) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  return {
    south: lat - dLat,
    north: lat + dLat,
    west: lng - dLng,
    east: lng + dLng,
  };
}

export function minDistanceToPolyline(point, coords) {
  let min = Infinity;
  for (const [lng, lat] of coords) {
    const d = haversineMeters(point, { lat, lng });
    if (d < min) min = d;
  }
  return min;
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
