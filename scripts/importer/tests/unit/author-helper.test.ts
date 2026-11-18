import { describe, expect, it, vi } from 'vitest';

import type { ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import type { ITracker } from '../../src/core/tracker.js';
import { AuthorHelper } from '../../src/helpers/author-helper.js';
import { sanitizeAllStrings } from '../../src/utils/html-to-markdown.js';

describe('AuthorHelper', () => {
  it('normalizes HTML-like names before lookup and duplicate retry', async () => {
    const rawName =
      'arch. Francesco Petrucci<br/>Copy-editor (Italian): Saverio Capozzi<br/>© Museum With No Frontiers (MWNF)';
    const normalizedName = sanitizeAllStrings({ name: rawName }).name.trim();

    const strategy = {
      findAuthorByName: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('author-uuid'),
      writeAuthor: vi.fn().mockRejectedValue(new Error('Duplicate entry')),
    } as unknown as IWriteStrategy;

    const logger = {
      warning: vi.fn(),
    } as unknown as ILogger;

    const tracker = {} as ITracker;

    const helper = new AuthorHelper(strategy, tracker, logger);

    const result = await helper.findOrCreate(rawName);

    expect(result).toBe('author-uuid');
    expect(strategy.findAuthorByName).toHaveBeenNthCalledWith(1, normalizedName);
    expect(strategy.writeAuthor).toHaveBeenCalledWith({
      name: normalizedName,
      internal_name: normalizedName,
      backward_compatibility: '',
    });
    expect(strategy.findAuthorByName).toHaveBeenNthCalledWith(2, normalizedName);
  });

  describe('findOrCreateAsWritten (M16 I1)', () => {
    const helperWith = (strategy: Partial<IWriteStrategy>) =>
      new AuthorHelper(strategy as IWriteStrategy, {} as ITracker, { warning: vi.fn() } as unknown as ILogger);

    it('returns the author whose name is exactly the text', async () => {
      const strategy = { findAuthorByName: vi.fn().mockResolvedValue('exact-uuid'), writeAuthor: vi.fn() };
      expect(await helperWith(strategy).findOrCreateAsWritten(' Mário Pereira ')).toBe('exact-uuid');
      expect(strategy.findAuthorByName).toHaveBeenCalledWith('Mário Pereira', true);
      expect(strategy.writeAuthor).not.toHaveBeenCalled();
    });

    it('creates the author when no name is like the text', async () => {
      const strategy = {
        findAuthorByName: vi.fn().mockResolvedValue(null),
        writeAuthor: vi.fn().mockResolvedValue('new-uuid'),
      };
      expect(await helperWith(strategy).findOrCreateAsWritten('Mário Pereira')).toBe('new-uuid');
      expect(strategy.writeAuthor).toHaveBeenCalledWith({
        name: 'Mário Pereira',
        internal_name: 'Mário Pereira',
        backward_compatibility: '',
      });
    });

    it('gives no author when one spells the name with other accents', async () => {
      const strategy = {
        findAuthorByName: vi.fn(async (_name: string, exact?: boolean) => (exact ? null : 'accented-uuid')),
        writeAuthor: vi.fn(),
      };
      expect(await helperWith(strategy).findOrCreateAsWritten('Comité cientifico')).toBeNull();
      expect(strategy.writeAuthor).not.toHaveBeenCalled();
    });

    it('gives no author for a text the name normalisation would change', async () => {
      const strategy = { findAuthorByName: vi.fn(), writeAuthor: vi.fn() };
      expect(await helperWith(strategy).findOrCreateAsWritten('A<br/>B')).toBeNull();
      expect(strategy.findAuthorByName).not.toHaveBeenCalled();
    });
  });
});
