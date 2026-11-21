import { describe, expect, it, vi } from 'vitest';

import type { ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import type { ITracker } from '../../src/core/tracker.js';
import { ArtistHelper } from '../../src/helpers/artist-helper.js';
import { sanitizeAllStrings } from '../../src/utils/html-to-markdown.js';

function makeTracker(): ITracker {
  return {
    set: vi.fn(),
    getUuid: vi.fn().mockReturnValue(null),
    has: vi.fn().mockReturnValue(false),
    resolve: vi.fn().mockResolvedValue(null),
  } as unknown as ITracker;
}

function makeLogger(): ILogger {
  return {
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    exception: vi.fn(),
    skip: vi.fn(),
    showProgress: vi.fn(),
    showSkipped: vi.fn(),
    showError: vi.fn(),
    showSummary: vi.fn(),
  } as unknown as ILogger;
}

describe('ArtistHelper', () => {
  it('returns null for empty name', async () => {
    const strategy = {} as unknown as IWriteStrategy;
    const helper = new ArtistHelper(strategy, makeTracker(), makeLogger());
    expect(await helper.findOrCreate('')).toBeNull();
    expect(await helper.findOrCreate('   ')).toBeNull();
  });

  it('sanitizes HTML entities and special characters in names', async () => {
    const rawName = 'Jean-Luc Godard &amp; Friends<br/>© MWNF';
    const sanitizedName = sanitizeAllStrings({ name: rawName.trim() }).name.trim().slice(0, 255);

    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeArtist: vi.fn().mockResolvedValue('artist-uuid-1'),
    } as unknown as IWriteStrategy;

    const helper = new ArtistHelper(strategy, makeTracker(), makeLogger());
    const result = await helper.findOrCreate(rawName);

    expect(result).toBe('artist-uuid-1');
    const written = (strategy.writeArtist as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      name: string;
    };
    expect(written.name).toBe(sanitizedName);
  });

  it('writes a name only, never life data', async () => {
    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeArtist: vi.fn().mockResolvedValue('artist-uuid-2'),
    } as unknown as IWriteStrategy;

    const helper = new ArtistHelper(strategy, makeTracker(), makeLogger());
    await helper.findOrCreate('Johann Baptist Zimmermann');

    expect(strategy.writeArtist).toHaveBeenCalledWith({
      name: 'Johann Baptist Zimmermann',
      internal_name: 'Johann Baptist Zimmermann',
      backward_compatibility: 'mwnf3:artists:Johann Baptist Zimmermann',
    });
  });

  it('truncates name to 255 characters before writing', async () => {
    const longName = 'A'.repeat(300);

    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeArtist: vi.fn().mockResolvedValue('artist-uuid-long'),
    } as unknown as IWriteStrategy;

    const helper = new ArtistHelper(strategy, makeTracker(), makeLogger());
    await helper.findOrCreate(longName);

    const written = (strategy.writeArtist as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      name: string;
    };
    expect(written.name.length).toBeLessThanOrEqual(255);
  });

  it('returns existing UUID from BC lookup without writing', async () => {
    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue('existing-uuid'),
      writeArtist: vi.fn(),
    } as unknown as IWriteStrategy;

    const helper = new ArtistHelper(strategy, makeTracker(), makeLogger());
    const result = await helper.findOrCreate('Leonardo da Vinci');

    expect(result).toBe('existing-uuid');
    expect(strategy.writeArtist).not.toHaveBeenCalled();
  });

  it('retries findByBackwardCompatibility and findArtistByName on duplicate error', async () => {
    const rawName = 'Rembrandt van Rijn';
    const sanitizedName = sanitizeAllStrings({ name: rawName.trim() }).name.trim().slice(0, 255);

    const strategy = {
      findByBackwardCompatibility: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('retry-uuid'),
      writeArtist: vi.fn().mockRejectedValue(new Error('Duplicate entry')),
      findArtistByName: vi.fn().mockResolvedValue(null),
    } as unknown as IWriteStrategy;

    const logger = makeLogger();
    const helper = new ArtistHelper(strategy, makeTracker(), logger);
    const result = await helper.findOrCreate(rawName);

    expect(result).toBe('retry-uuid');
    expect(strategy.findByBackwardCompatibility).toHaveBeenCalledTimes(2);
    expect(strategy.findArtistByName).not.toHaveBeenCalled();
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining(sanitizedName),
      ...[]
    );
  });

  it('falls back to findArtistByName when BC retry returns null', async () => {
    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeArtist: vi.fn().mockRejectedValue(new Error('Duplicate entry')),
      findArtistByName: vi
        .fn()
        .mockResolvedValue({ id: 'name-lookup-uuid' }),
    } as unknown as IWriteStrategy;

    const helper = new ArtistHelper(strategy, makeTracker(), makeLogger());
    const result = await helper.findOrCreate('Michelangelo');

    expect(result).toBe('name-lookup-uuid');
    expect(strategy.findArtistByName).toHaveBeenCalledTimes(1);
  });

  it('returns null and logs warning when all retries fail', async () => {
    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeArtist: vi.fn().mockRejectedValue(new Error('Duplicate entry')),
      findArtistByName: vi.fn().mockResolvedValue(null),
    } as unknown as IWriteStrategy;

    const logger = makeLogger();
    const helper = new ArtistHelper(strategy, makeTracker(), logger);
    const result = await helper.findOrCreate('Unknown Artist');

    expect(result).toBeNull();
    expect(logger.warning).toHaveBeenCalledTimes(2);
  });
});
