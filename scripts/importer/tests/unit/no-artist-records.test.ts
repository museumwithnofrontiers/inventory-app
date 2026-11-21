/**
 * The importer makes no Artist record and no item-Artist link (ADR 006 rule 2,
 * #2734). Legacy has no artist table: the artist lines are display text, kept
 * as written on the item translations. Artists are editorial records, linked
 * in the panel.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('../../src', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('importer and Artists', () => {
  it('writes no artists or artist_item row anywhere', () => {
    const writers = sourceFiles(sourceRoot).filter((path) =>
      /\b(INSERT|UPDATE|REPLACE)\b[^`'"]*\b(artists|artist_item)\b/i.test(
        readFileSync(path, 'utf8')
      )
    );

    expect(writers).toEqual([]);
  });

  it('keys no record mwnf3:artists', () => {
    const keyed = sourceFiles(sourceRoot).filter((path) =>
      /table:\s*['"]artists['"]/.test(readFileSync(path, 'utf8'))
    );

    expect(keyed).toEqual([]);
  });
});
