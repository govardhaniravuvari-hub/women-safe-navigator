import { Router } from 'express';
import { q } from '../db/pool.js';
import { asyncHandler } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { haversineMeters, isValidCoord } from '../lib/geo.js';
import { nearbyEmergencyServices } from '../services/overpass.js';
import { nearbyEmergencyServicesPhoton } from '../services/photon.js';

export const servicesRouter = Router();

/** Official Indian helplines. Verified public numbers, not invented. */
export const HELPLINES = [
  {
    name: 'National Emergency Number',
    number: '112',
    description: 'Single emergency number for police, fire and ambulance across India.',
    available: '24x7',
    source: 'Government of India (ERSS)',
  },
  {
    name: 'Women Helpline (national)',
    number: '181',
    description: 'Women in distress helpline operated by state women & child development departments.',
    available: '24x7 (availability varies by state)',
    source: 'Ministry of Women & Child Development',
  },
  {
    name: 'Police',
    number: '100',
    description: 'Direct police control room line in most cities.',
    available: '24x7',
    source: 'State police departments',
  },
  {
    name: 'Ambulance',
    number: '108',
    description: 'Emergency medical response and ambulance service in most states.',
    available: '24x7',
    source: 'State health departments / EMRI',
  },
  {
    name: 'Women Helpline (Delhi)',
    number: '1091',
    description: "Delhi Police women's helpline for immediate assistance.",
    available: '24x7 (Delhi)',
    source: 'Delhi Police',
  },
  {
    name: 'Cyber Crime Helpline',
    number: '1930',
    description: 'Report online harassment, stalking, morphing or financial cyber fraud.',
    available: '24x7',
    source: 'Ministry of Home Affairs — cybercrime.gov.in',
  },
  {
    name: 'Childline',
    number: '1098',
    description: 'Help for children and young people in distress.',
    available: '24x7',
    source: 'Childline India Foundation',
  },
];

servicesRouter.get('/helplines', (_req, res) => {
  res.json({
    helplines: HELPLINES,
    resources: [
      { name: 'National Commission for Women', url: 'https://ncw.nic.in/' },
      { name: 'National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in/' },
      { name: 'ERSS 112 official portal', url: 'https://112.gov.in/' },
    ],
    note: 'Helpline availability can change. 112 is the single emergency number for all of India.',
  });
});

/** Nearby emergency services combining real OSM data with the local directory. */
servicesRouter.get(
  '/nearby',
  requireUser,
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Math.min(Number(req.query.radius || 5000), 15000);
    if (!isValidCoord(lat, lng)) {
      return res.status(400).json({ error: 'A valid location is required to find nearby services.' });
    }

    // Live OpenStreetMap sources first: Overpass, then Photon when Overpass is
    // at capacity. Neither invents entries; both omit unknown fields.
    let osmPlaces = await nearbyEmergencyServices(lat, lng, radius);
    let osmProvider = 'overpass';
    if (!osmPlaces || !osmPlaces.length) {
      const photonPlaces = await nearbyEmergencyServicesPhoton(lat, lng, radius);
      if (photonPlaces && photonPlaces.length) {
        osmPlaces = photonPlaces;
        osmProvider = 'photon';
      } else if (!osmPlaces) {
        osmPlaces = photonPlaces;
      }
    }

    let places = [];
    let source;
    let note;

    if (osmPlaces && osmPlaces.length) {
      source = osmProvider === 'photon' ? 'openstreetmap-photon' : 'openstreetmap';
      note =
        'Live results from OpenStreetMap. Names, addresses and phone numbers are community-mapped and may be incomplete — call 112 in an emergency.';
      places = osmPlaces.map((p) => ({
        id: p.osmId,
        name: p.name,
        kind: p.type === 'police' ? 'police' : p.type === 'ambulance_station' ? 'ambulance' : 'hospital',
        type: p.type,
        address: p.address,
        phone: p.phone,
        openingHours: p.openingHours,
        city: p.city || null,
        lat: p.lat,
        lng: p.lng,
        source: 'openstreetmap',
        distanceMeters: Math.round(haversineMeters({ lat, lng }, { lat: p.lat, lng: p.lng })),
      }));
    } else {
      // Fallback: local directory rows (clearly labelled as reference/sample data)
      const police = await q(
        `SELECT id, name, address, phone, latitude, longitude, source FROM police_stations
          WHERE is_active = 1 AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`,
        [lat - 0.35, lat + 0.35, lng - 0.35, lng + 0.35],
      );
      const hospitals = await q(
        `SELECT id, name, address, phone, emergency_phone, latitude, longitude, type, source
           FROM hospitals
          WHERE is_active = 1 AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`,
        [lat - 0.35, lat + 0.35, lng - 0.35, lng + 0.35],
      );
      places = [
        ...police.map((p) => ({
          id: `db-police-${p.id}`,
          name: p.name,
          kind: 'police',
          type: 'police',
          address: p.address,
          phone: p.phone,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          source: p.source,
          distanceMeters: Math.round(
            haversineMeters({ lat, lng }, { lat: Number(p.latitude), lng: Number(p.longitude) }),
          ),
        })),
        ...hospitals.map((h) => ({
          id: `db-hospital-${h.id}`,
          name: h.name,
          kind: h.type === 'ambulance' ? 'ambulance' : 'hospital',
          type: h.type,
          address: h.address,
          phone: h.emergency_phone || h.phone,
          lat: Number(h.latitude),
          lng: Number(h.longitude),
          source: h.source,
          distanceMeters: Math.round(
            haversineMeters({ lat, lng }, { lat: Number(h.latitude), lng: Number(h.longitude) }),
          ),
        })),
      ].filter((p) => p.distanceMeters <= radius);

      source = 'local_directory';
      note = osmPlaces
        ? 'OpenStreetMap returned no emergency services near this point, so SAFEPATH’s local directory (sample/reference data managed by admins) is shown instead.'
        : 'OpenStreetMap could not be reached, so SAFEPATH’s local directory (sample/reference data managed by admins) is shown instead. Call 112 in an emergency.';
    }

    places.sort((a, b) => a.distanceMeters - b.distanceMeters);
    res.json({
      places: places.slice(0, 60),
      source,
      note,
      radius,
      counts: {
        police: places.filter((p) => p.kind === 'police').length,
        hospital: places.filter((p) => p.kind === 'hospital').length,
        ambulance: places.filter((p) => p.kind === 'ambulance').length,
      },
    });
  }),
);
