/**
 * One rule, four transformers: the item's rights statement always lands in
 * `item_translations.extra.copyright`.
 *
 * Legacy declares a `copyright` column on all four source tables and it has
 * never been filled — the text editors actually entered is in `notice_b`, and
 * that is what the legacy clients render as "Additional Copyright Information".
 * The transformers used to read `copyright` (mwnf3 objects), nothing at all
 * (mwnf3 monuments), or `notice_b` under its own legacy name (both Sharing
 * History paths), so the same statement reached consumers three different ways
 * or not at all.
 *
 * These tests pin the rule rather than any one transformer: real column first
 * so a backfill wins, `notice_b` as the fallback, HTML converted, nothing
 * written when neither is present, and `notice_b` gone from the vocabulary.
 *
 * See museumwithnofrontiers/inventory-app#1629 (mwnf3) and #1631 (Sharing History).
 */

import { describe, it, expect } from 'vitest';
import { transformObjectTranslation } from '../../src/domain/transformers/object-transformer.js';
import { transformMonumentTranslation } from '../../src/domain/transformers/monument-transformer.js';
import { transformShObjectTranslation } from '../../src/domain/transformers/sh-object-transformer.js';
import { transformShMonumentTranslation } from '../../src/domain/transformers/sh-monument-transformer.js';
import type { LegacyObject, LegacyMonument } from '../../src/domain/types/legacy.js';
import type { ShLegacyObjectText, ShLegacyMonumentText } from '../../src/domain/types/sh-legacy.js';

/** The `extra` JSON a transformer wrote, decoded. */
function extraOf(result: { data: { extra?: string | null } } | null): Record<string, unknown> {
  expect(result).not.toBeNull();
  return result!.data.extra ? (JSON.parse(result!.data.extra) as Record<string, unknown>) : {};
}

/**
 * Each path builds its own minimal valid translation row — only `name` is
 * required — and takes the rights columns under test.
 */
type Rights = { copyright?: string | null; notice_b?: string | null };

const paths = [
  {
    name: 'mwnf3 object',
    transform: (rights: Rights) =>
      transformObjectTranslation({
        project_id: 'EPM',
        country: 'eg',
        museum_id: 'cairo',
        number: '001',
        lang: 'en',
        name: 'Test Object',
        ...rights,
      } as LegacyObject),
  },
  {
    name: 'mwnf3 monument',
    transform: (rights: Rights) =>
      transformMonumentTranslation({
        project_id: 'EPM',
        country: 'eg',
        institution_id: 'inst',
        number: '001',
        lang: 'en',
        name: 'Test Monument',
        ...rights,
      } as LegacyMonument),
  },
  {
    name: 'sharing history object',
    transform: (rights: Rights) =>
      transformShObjectTranslation({
        project_id: 'AWE',
        country: 'it',
        number: 1,
        lang: 'en',
        name: 'Test Object',
        ...rights,
      } as ShLegacyObjectText),
  },
  {
    name: 'sharing history monument',
    transform: (rights: Rights) =>
      transformShMonumentTranslation({
        project_id: 'AWE',
        country: 'it',
        number: 1,
        lang: 'en',
        name: 'Test Monument',
        ...rights,
      } as ShLegacyMonumentText),
  },
];

describe.each(paths)('$name — extra.copyright', ({ transform }) => {
  it('takes notice_b when the copyright column is empty', () => {
    const extra = extraOf(
      transform({ notice_b: 'Copyright image: Biblioteca Nazionale Centrale, Roma.' })
    );

    expect(extra.copyright).toBe('Copyright image: Biblioteca Nazionale Centrale, Roma.');
  });

  it('prefers the copyright column when it is populated', () => {
    // It is 0% filled in every dump today, so this pins the precedence for a
    // future backfill rather than describing current data.
    const extra = extraOf(
      transform({
        copyright: 'The Metropolitan Museum of Art',
        notice_b: 'Copyright image: Ignored.',
      })
    );

    expect(extra.copyright).toBe('The Metropolitan Museum of Art');
  });

  it('falls through a copyright column that is present but blank', () => {
    // MySQL dumps carry '' rather than NULL for untouched varchars, so a
    // null-check alone would drop the real text.
    const extra = extraOf(transform({ copyright: '   ', notice_b: 'Copyright image: Kept.' }));

    expect(extra.copyright).toBe('Copyright image: Kept.');
  });

  it('writes nothing when neither column has a value', () => {
    expect(extraOf(transform({}))).not.toHaveProperty('copyright');
  });

  it('converts HTML in the value, like every other text field', () => {
    const extra = extraOf(
      transform({ notice_b: '<p>Copyright image: <strong>Museo Egizio</strong>, Torino.</p>' })
    );

    expect(extra.copyright).toBe('Copyright image: **Museo Egizio**, Torino.');
  });

  it('never exports the legacy column name', () => {
    const extra = extraOf(transform({ notice_b: 'Copyright image: Anything.' }));

    expect(extra).not.toHaveProperty('notice_b');
  });
});
