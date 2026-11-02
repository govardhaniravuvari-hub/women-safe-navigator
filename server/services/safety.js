import { haversineMeters, minDistanceToPolyline, samplePolyline } from '../lib/geo.js';

const REPORT_WEIGHT = {
  harassment: 16,
  unsafe_route: 11,
  poor_lighting: 10,
  suspicious_activity: 8,
  unsafe_place: 7,
  other: 4,
};
const REPORT_BUFFER_M = 70;

export const SCORING_MODEL = {
  name: 'SAFEPATH Route Confidence v1',
  disclaimer:
    'Route confidence is an estimate calculated from verified community reports, OpenStreetMap street-lamp data and public-activity data. It is not a guarantee of safety. Always trust your instincts, travel with someone when you can, and contact 112 in an emergency.',
};

/**
 * Score one route. Unknown inputs are excluded and reported as such rather than
 * silently assumed safe.
 */
export function scoreRoute(route, reports, activity) {
  const coords = route.coordinates;
  const samples = samplePolyline(coords, 7);

  // 1) Verified community reports near the route
  const matched = [];
  for (const report of reports) {
    const distance = minDistanceToPolyline(
      { lat: Number(report.latitude), lng: Number(report.longitude) },
      coords,
    );
    if (distance <= REPORT_BUFFER_M) matched.push({ report, distance });
  }
  const reportPenalty = Math.min(
    55,
    matched.reduce((sum, m) => sum + (REPORT_WEIGHT[m.report.category] || 4), 0),
  );

  // 2) Street lighting (OSM)
  let lightingPenalty = 0;
  let lightingStatus = 'unknown';
  if (activity) {
    const perSample = activity.lamps / Math.max(activity.samples, 1);
    lightingStatus = 'known';
    if (perSample === 0) lightingPenalty = 18;
    else if (perSample < 1) lightingPenalty = 10;
    else if (perSample < 3) lightingPenalty = 4;
  }

  // 3) Public activity / footfall proxies (OSM POI density)
  let activityPenalty = 0;
  let activityStatus = 'unknown';
  if (activity) {
    const perSample = activity.activity / Math.max(activity.samples, 1);
    activityStatus = 'known';
    if (perSample < 0.5) activityPenalty = 12;
    else if (perSample < 2) activityPenalty = 6;
    if (activity.openLate > 0) activityPenalty = Math.max(0, activityPenalty - 3);
  }

  // 4) Long detours through side streets are slightly less predictable
  const detourPenalty = route.source === 'estimate' ? 0 : Math.min(6, Math.max(0, route.distanceMeters / 8000));

  // Missing lighting/activity data must not inflate confidence: cap the score
  // when OpenStreetMap context is unavailable.
  const dataComplete = Boolean(activity);
  const cap = dataComplete ? 100 : 70;
  const raw = 100 - reportPenalty - lightingPenalty - activityPenalty - detourPenalty;
  const score = Math.max(5, Math.min(cap, Math.round(raw)));

  const label =
    score >= 80
      ? 'Higher confidence'
      : score >= 60
        ? 'Moderate confidence'
        : 'Lower confidence';

  const factors = [
    {
      key: 'reports',
      title: 'Verified community reports',
      status: matched.length ? 'known' : 'known',
      impact: -reportPenalty,
      detail: matched.length
        ? `${matched.length} verified report${matched.length > 1 ? 's' : ''} within ${REPORT_BUFFER_M} m of this route.`
        : 'No verified reports within 70 m of this route.',
    },
    {
      key: 'lighting',
      title: 'Street lighting (OpenStreetMap)',
      status: lightingStatus,
      impact: -lightingPenalty,
      detail:
        lightingStatus === 'known'
          ? `${activity.lamps} street lamp${activity.lamps === 1 ? '' : 's'} mapped near ${activity.samples} sampled points along the route.`
          : 'Street-lighting data unavailable right now, so it was left out of the score.',
    },
    {
      key: 'activity',
      title: 'Public activity nearby',
      status: activityStatus,
      impact: -activityPenalty,
      detail:
        activityStatus === 'known'
          ? `${activity.activity} shop/amenity/bus-stop POIs mapped within 35 m of the sampled route points${activity.openLate ? `, ${activity.openLate} with late opening hours` : ''}.`
          : 'Public-activity data unavailable right now, so it was left out of the score.',
    },
    {
      key: 'detour',
      title: 'Route shape',
      status: 'known',
      impact: -detourPenalty,
      detail:
        route.source === 'estimate'
          ? 'No road-following route was available, so distance and time are straight-line estimates with a detour factor.'
          : `${(route.distanceMeters / 1000).toFixed(2)} km of routed walking path.`,
    },
  ];

  return {
    score,
    label,
    confidence: dataComplete ? 'full' : 'limited',
    confidenceNote: dataComplete
      ? 'All available data sources were used for this estimate.'
      : 'Street lighting / activity data could not be loaded, so this estimate is capped and less certain than usual.',
    factors,
    matchedReports: matched.map((m) => ({
      id: m.report.id,
      category: m.report.category,
      distanceMeters: Math.round(m.distance),
      severity: m.report.severity,
    })),
    model: SCORING_MODEL.name,
    disclaimer: SCORING_MODEL.disclaimer,
  };
}

/** Fetch verified reports that could affect a route, bounded by the route bbox. */
export function filterReportsNearRoute(reports, coords, bufferMeters = 1200) {
  const samples = samplePolyline(coords, 8);
  return reports.filter((r) => {
    const point = { lat: Number(r.latitude), lng: Number(r.longitude) };
    return samples.some((s) => haversineMeters(s, point) <= bufferMeters);
  });
}
