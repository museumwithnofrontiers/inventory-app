/**
 * Legacy's item sheet listed an exhibition by a confirmed relation only
 * (curator_status 'Y'); every rel_*_exhibitions row of the dump is 'N'. The
 * exhibition-level pivot keeps the status, as the theme and chapter ones do.
 */

import { describe, it, expect } from 'vitest';
import { withCuratorStatus } from '../../src/importers/phase-03/sh-exhibition-item-importer.js';

describe('SH exhibition-level curator status', () => {
  it('adds the status beside the justifications', () => {
    const justifications = { en: { partner: 'p', curator: null } };
    expect(withCuratorStatus({ justifications }, 'N')).toEqual({ justifications, curator_status: 'N' });
  });

  it('writes the status alone when the relation has no justification', () => {
    expect(withCuratorStatus(null, ' Y ')).toEqual({ curator_status: 'Y' });
  });

  it.each([[null], [''], ['X']])('leaves the extra as it is for a status of %j', (status) => {
    expect(withCuratorStatus(null, status)).toBeNull();
  });
});
