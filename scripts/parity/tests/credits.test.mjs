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

test('a label the dictionary writes without a colon is read from the start of its line', () => {
  const ar = new Map([['ar|الإعداد', 'db_writer'], ['ar|الترجمة', 'db_translator'], ['ar|تنقيح الترجمة', 'db_translationcopyeditor']]);
  ar.terms = new Map([...ar].map(([k, v]) => [k, new Set([v])]));
  const { credits } = parseCredits('<p>الإعداد: ينْس كروغر<br/>الترجمة: هاني صالح.<br/>تنقيح الترجمة عباس عباس<br/></p>', 'ar', ar);
  assert.deepEqual(credits, { db_writer: ['ينْس كروغر'], db_translator: ['هاني صالح.'], db_translationcopyeditor: ['عباس عباس'] });
});
