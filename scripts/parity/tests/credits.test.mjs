// Legacy's credit block, as the item sheets print it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCredits } from '../tools/legacy-php.mjs';

const labels = new Map([['fr|rédaction', 'db_writer'], ['fr|édition', 'db_translationcopyeditor']]);
labels.terms = new Map([['fr|rédaction', new Set(['db_writer'])], ['fr|édition', new Set(['db_copyeditor', 'db_translationcopyeditor'])]]);

test('a label one term prints is keyed by that term', () => {
  const { credits, shared } = parseCredits('<p>Rédaction: Houria Cherid<br/>Édition: Margot Cortez<br/></p>', 'fr', labels);
  assert.deepEqual(credits, { db_writer: ['Houria Cherid'] });
  assert.deepEqual(shared, [{ terms: ['db_copyeditor', 'db_translationcopyeditor'], names: ['Margot Cortez'] }]);
});
