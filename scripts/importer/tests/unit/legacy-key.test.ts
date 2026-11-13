import { describe, expect, it } from 'vitest';

import { legacyKey } from '../../src/utils/legacy-key.js';

describe('legacyKey', () => {
  it('groups the rows legacy compares without case as one record', () => {
    // A Travels picture: its English row says iam/i, its Spanish row IAM/I.
    expect(legacyKey('iam', 'es', 1, 'i', '1', 'a', '', 1)).toBe(
      legacyKey('IAM', 'es', 1, 'I', '1', 'a', '', 1)
    );
  });

  it('keeps different records apart', () => {
    expect(legacyKey('IAM', 'es', 1, 'I', '1', 'a', '', 1)).not.toBe(
      legacyKey('IAM', 'es', 1, 'I', '1', 'b', '', 1)
    );
    expect(legacyKey('a', null, 'b')).toBe('a::b');
  });
});
