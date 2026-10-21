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

test('the same names in another order are a format difference', () => {
  const legacy = 'Etching: Giacomo Maria Giovannini (1667, Bologna – 1717, Parma), designer: Marco Antonio Chiarini (1652, Bologna – 1730, Bologna)';
  const r = compareJoined(legacy, ['designer: Marco Antonio Chiarini (1652, Bologna – 1730, Bologna)', 'Etching: Giacomo Maria Giovannini (1667, Bologna – 1717, Parma)']);
  assert.equal(r.verdict, 'format');
  assert.equal(r.why, 'same entries, other order');
});

test('a reordered list with a name missing is still different', () => {
  assert.equal(compareJoined('Jenig, clockmaker, Paolo Pagani', ['Paolo Pagani', 'Simon Forstner']).verdict, 'different');
});

test('another name is still different', () => {
  assert.equal(compareJoined('Jenig, clockmaker', ['Paolo Pagani']).verdict, 'different');
});

test('no names in the package is missing', () => {
  assert.equal(compareJoined('Jenig, clockmaker', undefined).verdict, 'missing-in-package');
});
