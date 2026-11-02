import { config } from '../config.js';
import { haversineMeters, isValidCoord } from '../lib/geo.js';

const WALK_SPEED_MPS = 1.3; // ~4.7 km/h
const UA = 'SAFEPATH/1.0 (women safety navigator; student project)';

/** Decode a Google/Valhalla encoded polyline. */
export function decodePolyline(str, precision = 6) {
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = 10 ** precision;
  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

/**
 * Valhalla public routing (OpenStreetMap data) supports real pedestrian
 * alternatives, which is what route comparison needs.
 */
async function fetchValhallaRoutes(from, to) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${config.valhallaUrl}/route`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({
        locations: [
          { lat: from.lat, lon: from.lng },
          { lat: to.lat, lon: to.lng },
        ],
        costing: 'pedestrian',
        alternates: 2,
        units: 'kilometers',
        directions_options: { units: 'kilometers' },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const trips = [data.trip, ...(data.alternates || [])].filter(Boolean);
    return trips.map((trip, i) => {
      const coords = [];
      let lengthKm = 0;
      let seconds = 0;
      for (const leg of trip.legs || []) {
        const shape = leg.shape ? decodePolyline(leg.shape, 6) : [];
        if (coords.length && shape.length) shape.shift();
        coords.push(...shape);
        lengthKm += leg.summary?.length || 0;
        seconds += leg.summary?.time || 0;
      }
      return {
        id: `valhalla-${i}`,
        source: 'valhalla',
        distanceMeters: Math.round(lengthKm * 1000),
        durationSeconds: Math.round(seconds),
        coordinates: coords,
      };
    }).filter((r) => r.coordinates.length > 1 && r.distanceMeters > 0);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** OSRM fallback (public demo server often returns a single route). */
async function fetchOsrmRoutes(from, to) {
  const url =
    `${config.osrmUrl}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?alternatives=3&overview=full&geometries=geojson&steps=false';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 'Ok' || !Array.isArray(data.routes)) return [];
    return data.routes.map((r, i) => ({
      id: `osrm-${i}`,
      source: 'osrm',
      distanceMeters: Math.round(r.distance),
      durationSeconds: Math.round(r.duration),
      coordinates: r.geometry.coordinates,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Try Valhalla, then OSRM, then a clearly-labelled straight-line estimate. */
export async function fetchRoutes(from, to) {
  if (!isValidCoord(from.lat, from.lng) || !isValidCoord(to.lat, to.lng)) {
    return { routes: [], source: 'none' };
  }
  let routes = await fetchValhallaRoutes(from, to);
  if (routes.length) return { routes, source: 'valhalla' };

  routes = await fetchOsrmRoutes(from, to);
  if (routes.length) return { routes, source: 'osrm' };

  return { routes: [estimateRoute(from, to)], source: 'estimate' };
}

/** Straight-line fallback with a detour factor, clearly marked as an estimate. */
export function estimateRoute(from, to) {
  const straight = haversineMeters(from, to);
  const distanceMeters = Math.round(straight * 1.35);
  return {
    id: 'estimate-0',
    source: 'estimate',
    distanceMeters,
    durationSeconds: Math.round(distanceMeters / WALK_SPEED_MPS),
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
  };
}

async function nominatim(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(path, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Forward geocoding via Nominatim (OpenStreetMap). */
export async function geocode(queryText) {
  const data = await nominatim(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(
      queryText,
    )}`,
  );
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    label: item.display_name,
    shortLabel:
      [item.name, item.address?.suburb, item.address?.city || item.address?.town || item.address?.state]
        .filter(Boolean)
        .join(', ') || item.display_name?.split(',').slice(0, 2).join(','),
    lat: Number(item.lat),
    lng: Number(item.lon),
    type: item.type,
  }));
}

export async function reverseGeocode(lat, lng) {
  const data = await nominatim(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`,
  );
  return data?.display_name || null;
}
