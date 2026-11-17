// A partner page's map: legacy's "lat, long" and zoom (dxa-api's mapCoordinates / mapZoom) against the
// package's latitude / longitude / map_zoom. A museum carries its own; an institution takes them from
// its "All Partners" record since MWNF-656.
const show = (m) => `${m.lat}, ${m.lon} z${m.zoom ?? '-'}`;
// The inventory keeps a position to 8 decimals while legacy keeps what Google gave it (up to 15), so
// the same place differs in the last digits; a millionth of a degree is about 10 cm.
const near = (a, b) => Math.abs(a - b) < 1e-6;

export function compareMap(rec, p) {
  const [lat, lon] = String(rec?.mapCoordinates ?? '').split(',').map((x) => Number.parseFloat(x));
  const legacy = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, zoom: Number.parseInt(rec.mapZoom, 10) || null } : null;
  const pkg = p?.latitude != null && p?.longitude != null ? { lat: p.latitude, lon: p.longitude, zoom: p.map_zoom ?? null } : null;
  if (!legacy && !pkg) return { verdict: 'both-empty' };
  if (legacy && !pkg) return { verdict: 'missing-in-package', legacy: show(legacy) };
  if (!legacy && pkg) return { verdict: 'extra-in-package', pkg: show(pkg) };
  // A legacy record with no zoom draws the client's default, so only a stated zoom must match.
  const same = near(legacy.lat, pkg.lat) && near(legacy.lon, pkg.lon) && (legacy.zoom == null || legacy.zoom === pkg.zoom);
  return same ? { verdict: 'same' } : { verdict: 'different', legacy: show(legacy), pkg: show(pkg) };
}
