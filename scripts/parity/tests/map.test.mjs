// A partner's map against legacy (MWNF-656 gave institutions theirs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareMap } from '../tools/lib/map.mjs';

const legacy = { mapCoordinates: '33.525749, 36.311855', mapZoom: '17' };

test('the same position and zoom match', () => {
  assert.equal(compareMap(legacy, { latitude: 33.525749, longitude: 36.311855, map_zoom: 17 }).verdict, 'same');
});

test('a position legacy draws and the package lacks is missing', () => {
  const r = compareMap(legacy, { latitude: null, longitude: null, map_zoom: 16 });
  assert.equal(r.verdict, 'missing-in-package');
  assert.equal(r.legacy, '33.525749, 36.311855 z17');
});

test('a position only the package has is extra', () => {
  assert.equal(compareMap({ mapCoordinates: null, mapZoom: null }, { latitude: 1, longitude: 2, map_zoom: 16 }).verdict, 'extra-in-package');
});

test('neither side having a position is both-empty', () => {
  assert.equal(compareMap({ mapCoordinates: '', mapZoom: '' }, { latitude: null, longitude: null }).verdict, 'both-empty');
});

test('another zoom differs; no legacy zoom accepts any', () => {
  assert.equal(compareMap(legacy, { latitude: 33.525749, longitude: 36.311855, map_zoom: 16 }).verdict, 'different');
  assert.equal(compareMap({ mapCoordinates: '33.525749,36.311855' }, { latitude: 33.525749, longitude: 36.311855, map_zoom: 16 }).verdict, 'same');
});
