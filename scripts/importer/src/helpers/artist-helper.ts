/**
 * Artist Helper
 *
 * Unified helper for managing Artist entities.
 * Uses write strategy for persistence.
 */

import type { IWriteStrategy } from '../core/strategy.js';
import type { ITracker } from '../core/tracker.js';
import type { ILogger } from '../core/base-importer.js';
import type { ArtistData } from '../core/types.js';
import { formatBackwardCompatibility } from '../utils/backward-compatibility.js';
import { sanitizeAllStrings } from '../utils/html-to-markdown.js';

export class ArtistHelper {
  private strategy: IWriteStrategy;
  private tracker: ITracker;
  private logger: ILogger;

  constructor(strategy: IWriteStrategy, tracker: ITracker, logger: ILogger) {
    this.strategy = strategy;
    this.tracker = tracker;
    this.logger = logger;
  }

  /**
   * Find or create an artist by name.
   *
   * The record gets a name only. The artist's life data (places and dates of
   * birth and death, period of activity) is display text: legacy writes it per
   * object and per language, and the item translation columns keep it as
   * written (`artist_birth_date`, …). Copying one language's text onto the
   * shared record would derive the record from a display text (ADR 006 rule 2)
   * and give every person split from one artist line the same life data.
   */
  async findOrCreate(name: string): Promise<string | null> {
    if (!name || name.trim() === '') {
      return null;
    }

    const sanitizedName = sanitizeAllStrings({ name: name.trim() }).name.trim().slice(0, 255);
    if (!sanitizedName) {
      return null;
    }
    const backwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'artists',
      pkValues: [sanitizedName],
    });

    // Check tracker first
    const existing = this.tracker.getUuid(backwardCompat, 'artist');
    if (existing) {
      return existing;
    }

    // Check database via strategy
    const found = await this.strategy.findByBackwardCompatibility('artists', backwardCompat);
    if (found) {
      return found;
    }

    // Create new artist
    const artistData: ArtistData = {
      name: sanitizedName,
      internal_name: sanitizedName,
      backward_compatibility: backwardCompat,
    };

    try {
      return await this.strategy.writeArtist(artistData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warning(`Artist write failed for '${sanitizedName}': ${message}, retrying lookup`);
      const retryResult = await this.strategy.findByBackwardCompatibility(
        'artists',
        backwardCompat
      );
      if (retryResult) {
        return retryResult;
      }
      const byName = await this.strategy.findArtistByName(sanitizedName);
      if (byName) {
        return byName.id;
      }
      this.logger.warning(`Artist retry lookup also failed for '${sanitizedName}' — entity lost`);
      return null;
    }
  }

  /**
   * Attach artists to an item
   */
  async attachToItem(itemId: string, artistIds: string[]): Promise<void> {
    if (artistIds.length === 0) return;
    await this.strategy.attachArtistsToItem(itemId, artistIds);
  }
}
