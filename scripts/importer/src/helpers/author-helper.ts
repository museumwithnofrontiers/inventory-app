/**
 * Author Helper
 *
 * Finds or creates Author entities from unstructured name strings.
 * Used by object/monument importers where the author is a free-text field
 * with no legacy ID. Authors from structured tables (mwnf3.authors) are
 * imported first by AuthorImporter with proper ID-based backward_compatibility.
 *
 * This helper:
 * 1. Looks up by name — reuses the existing record if found (e.g., one
 *    already created by AuthorImporter from the structured table).
 * 2. Creates a new author WITHOUT backward_compatibility if not found
 *    (no legacy ID is available for free-text author references).
 */

import type { IWriteStrategy } from '../core/strategy.js';
import type { ITracker } from '../core/tracker.js';
import type { ILogger } from '../core/base-importer.js';
import type { AuthorData } from '../core/types.js';
import { sanitizeAllStrings } from '../utils/html-to-markdown.js';

export class AuthorHelper {
  private strategy: IWriteStrategy;
  private logger: ILogger;

  constructor(strategy: IWriteStrategy, _tracker: ITracker, logger: ILogger) {
    this.strategy = strategy;
    this.logger = logger;
  }

  private normalizeName(name: string): string {
    return sanitizeAllStrings({ name }).name.trim();
  }

  /**
   * Find or create an author by name.
   *
   * Since free-text author references have no legacy ID, these authors
   * do not get a backward_compatibility value. The lookup is purely
   * name-based.
   */
  async findOrCreate(name: string): Promise<string | null> {
    if (!name || name.trim() === '') {
      return null;
    }

    const trimmedName = name.trim();
    const normalizedName = this.normalizeName(trimmedName);
    if (normalizedName === '') {
      return null;
    }

    // Look up by name — may find an author already created by AuthorImporter
    const existing = await this.strategy.findAuthorByName(normalizedName);
    if (existing) {
      return existing;
    }

    // Create new author without backward_compatibility (no legacy ID available)
    const authorData: AuthorData = {
      name: normalizedName,
      internal_name: normalizedName,
      backward_compatibility: '',
    };

    try {
      return await this.strategy.writeAuthor(authorData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warning(
        `Author write failed for '${trimmedName}': ${message}, retrying name lookup`
      );
      // Retry: another thread/record may have created the same author concurrently
      const retryResult = await this.strategy.findAuthorByName(normalizedName);
      if (!retryResult) {
        this.logger.warning(`Author retry lookup also failed for '${trimmedName}' — entity lost`);
      }
      return retryResult;
    }
  }

  /**
   * The author whose name is exactly `name`, created when no author has a name
   * like it; null when the name cannot be kept as written. The authors' names
   * are unique without regard to accents or case, so "Comité cientifico"
   * cannot sit next to an existing "Comité científico": that text has no
   * author of its own, and the caller keeps it where it was (M16 I1, #2657).
   */
  async findOrCreateAsWritten(name: string): Promise<string | null> {
    const trimmedName = name?.trim() ?? '';
    if (trimmedName === '' || this.normalizeName(trimmedName) !== trimmedName) {
      return null;
    }

    const exact = await this.strategy.findAuthorByName(trimmedName, true);
    if (exact) {
      return exact;
    }
    if (await this.strategy.findAuthorByName(trimmedName)) {
      return null;
    }

    try {
      return await this.strategy.writeAuthor({
        name: trimmedName,
        internal_name: trimmedName,
        backward_compatibility: '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warning(`Author write failed for '${trimmedName}': ${message}`);
      return this.strategy.findAuthorByName(trimmedName, true);
    }
  }
}
