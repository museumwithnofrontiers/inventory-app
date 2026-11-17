/**
 * An institution's map position (MWNF-656): legacy keeps none on the
 * institution itself, dxa-api reads it from the Virtual Office "All Partners"
 * record, and the importer's query brings it as geoCoordinates / zoom.
 */

import { describe, expect, it } from 'vitest';

import { transformInstitution } from '../../src/domain/transformers/institution-transformer.js';
import { transformMuseum } from '../../src/domain/transformers/museum-transformer.js';
import type { LegacyInstitution, LegacyMuseum } from '../../src/domain/types/index.js';
import { parseMapPosition } from '../../src/utils/map-position.js';

const institution = (extra: Partial<LegacyInstitution> = {}): LegacyInstitution => ({
  institution_id: 'Mon01',
  country: 'sy',
  name: 'Ministry of Culture, Directorate General of Museums and Antiquities',
  ...extra,
});

describe('parseMapPosition', () => {
  it('reads "lat, long" and the zoom column', () => {
    expect(parseMapPosition('33.525749, 36.311855', '17')).toEqual({
      latitude: 33.525749,
      longitude: 36.311855,
      mapZoom: 17,
    });
  });

  it('prefers a zoom written into the coordinates', () => {
    expect(parseMapPosition('31.70777,35.199315,15', '17')).toEqual({
      latitude: 31.70777,
      longitude: 35.199315,
      mapZoom: 15,
    });
  });

  it('gives no position, at the default zoom, without coordinates', () => {
    expect(parseMapPosition(null, null)).toEqual({ latitude: null, longitude: null, mapZoom: 16 });
    expect(parseMapPosition('', '17')).toEqual({ latitude: null, longitude: null, mapZoom: 17 });
  });
});

describe('transformInstitution map position', () => {
  it('takes the coordinates its All Partners record carries', () => {
    const { data } = transformInstitution(
      institution({ geoCoordinates: '33.525749, 36.311855', zoom: '17' })
    );

    expect(data.latitude).toBe(33.525749);
    expect(data.longitude).toBe(36.311855);
    expect(data.map_zoom).toBe(17);
  });

  it('has no position when no All Partners record carries one', () => {
    const { data } = transformInstitution(institution({ geoCoordinates: null, zoom: null }));

    expect(data.latitude).toBeNull();
    expect(data.longitude).toBeNull();
    expect(data.map_zoom).toBe(16);
  });

  it('reads the same legacy values as a museum does', () => {
    const geo = { geoCoordinates: '30.0632686, 31.21700080000005', zoom: '16' };
    const museum = transformMuseum({
      museum_id: 'Mus01',
      country: 'eg',
      name: 'Museum',
      ...geo,
    } as LegacyMuseum).data;
    const inst = transformInstitution(institution(geo)).data;

    expect([inst.latitude, inst.longitude, inst.map_zoom]).toEqual([
      museum.latitude,
      museum.longitude,
      museum.map_zoom,
    ]);
  });
});
