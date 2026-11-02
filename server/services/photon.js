import { haversineMeters } from '../lib/geo.js';

/**
 * Photon (Komoot) is an OpenStreetMap-based geocoder with POI filtering.
 * It is used as a second live source when Overpass is at capacity, so nearby
 * emergency services still come from real OSM data rather than invented entries.
 */
const UA = 'SAFEPATH/1.0 (student women-safety project)';
const BASE = process.env.PHOTON_URL || 'https://photon.komoot.io/api/';

function bboxFor(lat, lng, radiusMeters) {
  const dLat = radiusMeters / 111320;
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
  // Photon expects minLon,minLat,maxLon,maxLat
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(5)).join(',');
}

function toPlace(feature, fallbackType) {
  const p = feature.properties || {};
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (lat == null || lng == null) return null;
  const address = [p.housenumber, p.street, p.district, p.city || p.state, p.postcode]
    .filter(Boolean)
    .join(', ');
  return {
    osmId: `photon/${p.osm_type || 'x'}${p.osm_id || Math.random().toString(36).slice(2)}`,
    name: p.name || address || `${fallbackType} (unnamed on OpenStreetMap)`,
    type: p.osm_value || fallbackType,
    lat,
    lng,
    address: address || null,
    phone: p.phone || p['contact:phone'] || null,
    openingHours: p.opening_hours || null,
    emergency: p.osm_value === 'ambulance_station' || p.osm_value === 'hospital',
    source: 'photon',
    city: p.city || p.state || null,
  };
}

async function search(tag, lat, lng, radiusMeters, query) {
  const url = `${BASE}?q=${encodeURIComponent(query)}&bbox=${bboxFor(lat, lng, radiusMeters)}&limit=25&osm_tag=${tag}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.features || []).map((f) => toPlace(f, tag.split(':')[1]));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function nearbyEmergencyServicesPhoton(lat, lng, radiusMeters = 5000) {
  const [police, hospitals, clinics, ambulances] = await Promise.all([
    search('amenity:police', lat, lng, radiusMeters, 'police station'),
    search('amenity:hospital', lat, lng, radiusMeters, 'hospital'),
    search('amenity:clinic', lat, lng, radiusMeters, 'clinic'),
    search('emergency:ambulance_station', lat, lng, radiusMeters, 'ambulance station'),
  ]);
  const batches = [police, hospitals, clinics, ambulances];
  if (batches.every((b) => b === null)) return null;

  const seen = new Set();
  const places = [];
  for (const batch of batches) {
    for (const place of batch || []) {
      const key = `${place.name.toLowerCase()}|${place.lat.toFixed(3)}|${place.lng.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const distance = haversineMeters({ lat, lng }, { lat: place.lat, lng: place.lng });
      if (distance > radiusMeters) continue;
      places.push({ ...place, distanceMeters: Math.round(distance) });
    }
  }
  return places;
}
