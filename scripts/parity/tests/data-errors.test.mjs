// Differences that come from errors in the legacy data count as known, citing their task.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dataError } from '../tools/lib/data-errors.mjs';
import { Report } from '../tools/lib/report.mjs';

test('a listed record is a known data error for its field, in any case', () => {
  assert.match(dataError('mwnf3:objects:isl:uk:mus02:40|es', 'item.bibliography'), /#2341/);
  assert.match(dataError('MWNF3:OBJECTS:ISL:UK:MUS02:40|es', 'item.bibliography'), /#2341/);
  assert.equal(dataError('mwnf3:objects:isl:uk:mus02:40|es', 'item.description'), null);
  assert.equal(dataError('mwnf3:objects:isl:uk:mus02:40|en', 'item.bibliography'), null);
  assert.match(dataError('mwnf3:objects:epm:ua:mus21:10|ar', 'record.package language'), /#2343/);
});

test('the report counts a known data error as expected, and leaves agreement alone', () => {
  const R = new Report('test', {});
  R.field('item', 'bibliography', { verdict: 'different', legacy: 'a', pkg: 'a*' }, 'mwnf3:objects:isl:uk:mus02:40|es');
  R.field('item', 'bibliography', { verdict: 'same' }, 'mwnf3:objects:isl:uk:mus02:40|es');
  R.field('item', 'bibliography', { verdict: 'different', legacy: 'b', pkg: 'c' }, 'mwnf3:objects:isl:uk:mus02:41|es');
  const verdicts = R.fields['item.bibliography'];
  assert.equal(verdicts.same, 1);
  assert.equal(verdicts.different, 1);
  assert.equal(Object.keys(verdicts).filter((v) => v.startsWith('expected:')).length, 1);
});
