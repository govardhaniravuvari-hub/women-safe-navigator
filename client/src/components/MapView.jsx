import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PIN_STYLES = {
  police: { color: '#2563eb', glyph: '🚔' },
  hospital: { color: '#dc2626', glyph: '🏥' },
  ambulance: { color: '#ea580c', glyph: '🚑' },
  report: { color: '#e11d48', glyph: '⚠' },
  origin: { color: '#7c3aed', glyph: '●' },
  destination: { color: '#db2777', glyph: '★' },
  service: { color: '#0f766e', glyph: '＋' },
};

function makeIcon(type = 'service') {
  const style = PIN_STYLES[type] || PIN_STYLES.service;
  return L.divIcon({
    className: 'safepath-marker',
    html: `<div class="map-pin" style="background:${style.color}"><span>${style.glyph}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -24],
  });
}

function makeUserIcon() {
  return L.divIcon({
    className: 'safepath-user-marker',
    html: '<div class="map-dot" style="background:#7c3aed"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/**
 * Leaflet map for SAFEPATH. Markers are plain-data props so every page can
 * compose the map it needs (routes, reports, emergency services, live share).
 */
export default function MapView({
  center,
  zoom = 14,
  markers = [],
  routes = [],
  userPosition = null,
  onMapClick,
  className = '',
  height = 380,
  fitToMarkers = false,
  scrollWheelZoom = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ markers: null, routes: null, user: null });

  const stableCenter = useMemo(
    () => (center && Number.isFinite(center[0]) ? center : [20.5937, 78.9629]),
    [center?.[0], center?.[1]], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: stableCenter,
      zoom,
      zoomControl: true,
      scrollWheelZoom,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    layersRef.current.markers = L.layerGroup().addTo(map);
    layersRef.current.routes = L.layerGroup().addTo(map);
    layersRef.current.user = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (onMapClick) {
      map.on('click', (event) => onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }));
    }

    // Ensure tiles render correctly inside flex/grid containers.
    window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(stableCenter, map.getZoom() ?? zoom, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableCenter[0], stableCenter[1]]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = layersRef.current.routes;
    group.clearLayers();
    routes.forEach((route) => {
      if (!route?.coords?.length) return;
      L.polyline(
        route.coords.map(([lng, lat]) => [lat, lng]),
        {
          color: route.color || '#7c3aed',
          weight: route.weight || 5,
          opacity: route.opacity ?? 0.85,
          dashArray: route.dashed ? '8 8' : undefined,
          lineCap: 'round',
        },
      )
        .bindTooltip(escapeHtml(route.label || ''), { sticky: true })
        .addTo(group);
    });
  }, [routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = layersRef.current.markers;
    group.clearLayers();
    markers.forEach((marker) => {
      if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) return;
      const m = L.marker([marker.lat, marker.lng], { icon: makeIcon(marker.type), title: marker.title })
        .addTo(group);
      if (marker.popup) {
        const lines = [];
        if (marker.popup.title) lines.push(`<strong>${escapeHtml(marker.popup.title)}</strong>`);
        (marker.popup.lines || []).forEach((line) => lines.push(`<div>${escapeHtml(line)}</div>`));
        (marker.popup.links || []).forEach((link) => {
          lines.push(
            `<div><a href="${encodeURI(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a></div>`,
          );
        });
        m.bindPopup(lines.join(''), { maxWidth: 240 });
      }
    });

    if (fitToMarkers && markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((mk) => [mk.lat, mk.lng]));
      routes.forEach((route) => {
        route.coords?.forEach(([lng, lat]) => bounds.extend([lat, lng]));
      });
      map.fitBounds(bounds.pad(0.15), { maxZoom: 16, animate: true });
    }
  }, [markers, fitToMarkers, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = layersRef.current.user;
    group.clearLayers();
    if (userPosition && Number.isFinite(userPosition.lat)) {
      L.marker([userPosition.lat, userPosition.lng], { icon: makeUserIcon(), title: 'Your location' })
        .bindPopup(
          `<strong>Your current location</strong><div>Accuracy: ±${Math.round(userPosition.accuracy || 0)} m</div>`,
        )
        .addTo(group);
      if (userPosition.accuracy) {
        L.circle([userPosition.lat, userPosition.lng], {
          radius: Math.min(userPosition.accuracy, 400),
          color: '#7c3aed',
          weight: 1,
          fillColor: '#7c3aed',
          fillOpacity: 0.08,
        }).addTo(group);
      }
    }
  }, [userPosition]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-2xl border border-brand-100 ${className}`}
      style={{ height }}
      role="application"
      aria-label="Interactive safety map"
    />
  );
}
