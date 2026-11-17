/**
 * A partner's map position from legacy's `geoCoordinates` ("lat,long" or
 * "lat,long,zoom") and `zoom` columns.
 *
 * Museums carry both columns themselves; an institution takes them from its
 * Virtual Office "All Partners" record (mwnf3.all_partners), which is where
 * dxa-api reads them since MWNF-656. One parser for both, so a museum and an
 * institution with the same legacy values get the same position.
 */

export interface MapPosition {
  latitude: number | null;
  longitude: number | null;
  mapZoom: number;
}

const DEFAULT_ZOOM = 16;

export function parseMapPosition(
  geoCoordinates: string | null | undefined,
  zoom: string | number | null | undefined
): MapPosition {
  let latitude: number | null = null;
  let longitude: number | null = null;
  let mapZoom = DEFAULT_ZOOM;

  if (geoCoordinates) {
    const parts = geoCoordinates.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      latitude = parseFloat(parts[0]) || null;
      longitude = parseFloat(parts[1]) || null;
      if (parts.length >= 3) {
        mapZoom = parseInt(parts[2], 10) || DEFAULT_ZOOM;
      }
    }
  }

  // The zoom column applies when the coordinates did not carry one
  if (zoom && mapZoom === DEFAULT_ZOOM) {
    mapZoom = parseInt(String(zoom), 10) || DEFAULT_ZOOM;
  }

  return { latitude, longitude, mapZoom };
}
