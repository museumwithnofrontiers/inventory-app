// A list line from a legacy PHP sheet is compared whole, so a name holding a comma stays one name (#2262).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareJoined } from '../tools/lib/text.mjs';

test('a single name holding a comma matches', () => {
  assert.equal(compareJoined('Jenig, clockmaker', ['Jenig, clockmaker']).verdict, 'same');
});

test('several names match legacy\'s comma-joined line', () => {
  const legacy = 'Franz Ignaz Günther (1725 Altmonstein – 1775 Mnichov), Simon Forstner (před 1714 Salcburk – 1733 Olomouc)';
  assert.equal(compareJoined(legacy, ['Franz Ignaz Günther (1725 Altmonstein – 1775 Mnichov)', 'Simon Forstner (před 1714 Salcburk – 1733 Olomouc)']).verdict, 'same');
});

test('another name is still different', () => {
  assert.equal(compareJoined('Jenig, clockmaker', ['Paolo Pagani']).verdict, 'different');
});

test('no names in the package is missing', () => {
  assert.equal(compareJoined('Jenig, clockmaker', undefined).verdict, 'missing-in-package');
});
