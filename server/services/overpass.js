import { config } from '../config.js';

/**
 * Thin Overpass (OpenStreetMap) client. Results are real OSM data, never invented.
 * All helpers return null on failure so callers can distinguish
 * "no data available" from "zero results".
 */
let preferredMirror = 0;

async function queryMirror(endpoint, query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    // GET keeps this compatible with proxies that reject form POSTs.
    const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SAFEPATH/1.0 (student women-safety project)',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Query Overpass with mirror failover (public instances routinely hit capacity).
 * Returns null only when every mirror failed, so callers can say "unknown".
 */
async function runQuery(query) {
  const mirrors = config.overpassUrls;
  for (let attempt = 0; attempt < mirrors.length; attempt++) {
    const index = (preferredMirror + attempt) % mirrors.length;
    const data = await queryMirror(mirrors[index], query);
    if (data) {
      preferredMirror = index;
      return data;
    }
  }
  return null;
}

const around = (lat, lng, radius) => `(around:${Math.round(radius)},${lat},${lng})`;

function elementToPlace(el, fallbackType) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:postcode'],
  ].filter(Boolean);
  return {
    osmId: `${el.type}/${el.id}`,
    name: tags.name || tags['name:en'] || fallbackType,
    type: tags.amenity || tags.healthcare || tags.shop || fallbackType,
    lat,
    lng,
    address: addressParts.join(', ') || tags['addr:full'] || null,
    phone: tags.phone || tags['contact:phone'] || tags['emergency:phone'] || null,
    openingHours: tags.opening_hours || null,
    emergency: tags.emergency === 'yes' || tags.emergency === 'ambulance',
    source: 'openstreetmap',
  };
}

/** Nearby police stations, hospitals/clinics and emergency services. */
export async function nearbyEmergencyServices(lat, lng, radiusMeters = 5000) {
  const a = around(lat, lng, radiusMeters);
  const query = `[out:json][timeout:25];
(
  node["amenity"="police"]${a};
  way["amenity"="police"]${a};
  relation["amenity"="police"]${a};
  node["amenity"~"^(hospital|clinic|doctors)$"]${a};
  way["amenity"~"^(hospital|clinic|doctors)$"]${a};
  relation["amenity"~"^(hospital|clinic|doctors)$"]${a};
  node["emergency"="ambulance_station"]${a};
  way["emergency"="ambulance_station"]${a};
  node["healthcare"="hospital"]${a};
  way["healthcare"="hospital"]${a};
);
out center 120;`;
  const data = await runQuery(query);
  if (!data) return null;
  return (data.elements || [])
    .map((el) => elementToPlace(el, el.tags?.amenity || 'service'))
    .filter(Boolean);
}

/**
 * Street lighting + public activity around a set of sample points.
 * One Overpass request covers every sample; the caller buckets the returned
 * elements per route. Returns null when Overpass is unavailable, which lets
 * the scorer report the input as "unknown" instead of guessing.
 */
export async function activityAndLighting(samples) {
  if (!samples.length) return null;
  const parts = [];
  for (const s of samples) {
    const a = around(s.lat, s.lng, 35);
    parts.push(`node["highway"="street_lamp"]${a};`);
    parts.push(`way["highway"="street_lamp"]${a};`);
    parts.push(
      `node["amenity"~"^(shop|restaurant|cafe|fast_food|pharmacy|bus_station|fuel|bank|marketplace|police)$"]${a};`,
    );
    parts.push(`node["shop"]${a};`);
    parts.push(`way["shop"]${a};`);
  }
  const query = `[out:json][timeout:25];
(
${parts.join('\n')}
);
out center 500;`;
  const data = await runQuery(query);
  if (!data) return null;

  const elements = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    elements.push({
      lat,
      lng,
      kind: tags.highway === 'street_lamp' ? 'lamp' : 'activity',
      openLate: Boolean(
        tags.opening_hours &&
          /(2[0-3]|0[0-5]):[0-5]\d\s*-\s*(0[0-5]|2[0-3])/.test(tags.opening_hours),
      ),
    });
  }
  return { elements, samples: samples.length };
}

/** Count OSM shops/amenities around a single point (for report context). */
export async function pointActivity(lat, lng, radius = 120) {
  const a = around(lat, lng, radius);
  const query = `[out:json][timeout:20];
(
  node["shop"]${a};
  node["amenity"~"^(restaurant|cafe|bus_station|pharmacy|bank|police)$"]${a};
);
out count;`;
  const data = await runQuery(query);
  if (!data) return null;
  // `out count` puts the total on the first element's tags
  const tags = data.elements?.[0]?.tags || {};
  const total = Number(tags.total || 0);
  return { total };
}
