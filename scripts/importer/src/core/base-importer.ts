/**
 * Base Importer - Abstract base class for all importers
 *
 * This class implements the Template Method pattern, providing a skeleton
 * for the import algorithm while allowing subclasses to override specific steps.
 *
 * Key responsibilities:
 * - Provide common logging infrastructure
 * - Manage import context (tracker, strategy, database)
 * - Define the import result structure
 * - Collect samples for testing
 */

import type { ITracker } from './tracker.js';
import type { IWriteStrategy } from './strategy.js';
import type { ImportResult, EntityType, ImageTable } from './types.js';
import { createImportResult } from './types.js';

/**
 * Sample reason types for test fixture collection
 */
export type SampleReason = 'success' | 'warning' | 'edge' | 'foundation';

/**
 * Sample collector interface for test fixture generation
 */
export interface ISampleCollector {
  collectSample(
    entityType: string,
    data: Record<string, unknown>,
    reason: SampleReason,
    details?: string,
    language?: string,
    sourceDb?: string
  ): void;
}

/**
 * Legacy database interface for reading source data
 */
export interface ILegacyDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Import context containing all dependencies needed by importers
 */
export interface ImportContext {
  legacyDb: ILegacyDatabase;
  strategy: IWriteStrategy;
  tracker: ITracker;
  logger: ILogger;
  dryRun: boolean;
  sampleCollector?: ISampleCollector;
  sampleOnlyMode?: boolean;
  logPath?: string;
}

/**
 * Logger interface for import operations
 */
export interface ILogger {
  info(message: string): void;
  warning(message: string, details?: unknown): void;
  /**
   * Log a skip - for expected/handled deduplication (duplicate pivots, already-exists checks)
   */
  skip(message: string): void;
  /**
   * Log an error - for expected/handled errors (data issues, constraint violations)
   * No stack trace is written.
   */
  error(context: string, message: string, additionalContext?: Record<string, unknown>): void;
  /**
   * Log an exception - for unexpected runtime errors (connection lost, bugs)
   * Stack trace IS written.
   */
  exception(context: string, error: Error, additionalContext?: Record<string, unknown>): void;
  showProgress(): void;
  showSkipped(): void;
  showError(): void;
  showSummary(imported: number, skipped: number, errors: number, warnings?: number): void;
}

/**
 * Simple console logger implementation
 */
export class ConsoleLogger implements ILogger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  info(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  warning(message: string, _details?: unknown): void {
    console.log(`[${this.name}] ⚠️  ${message}`);
  }

  skip(message: string): void {
    console.log(`[${this.name}] ⏭  ${message}`);
  }

  error(context: string, message: string, _additionalContext?: Record<string, unknown>): void {
    console.error(`[${this.name}] ❌ ${context}: ${message}`);
  }

  exception(context: string, error: Error, _additionalContext?: Record<string, unknown>): void {
    console.error(`[${this.name}] 💥 EXCEPTION ${context}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }

  showProgress(): void {
    process.stdout.write('.');
  }

  showSkipped(): void {
    process.stdout.write('s');
  }

  showError(): void {
    process.stdout.write('×');
  }

  showSummary(imported: number, skipped: number, errors: number, warnings?: number): void {
    const parts = [`${imported} imported`, `${skipped} skipped`, `${errors} errors`];
    if (warnings) {
      parts.push(`${warnings} warnings`);
    }
    console.log(`\n[${this.name}] Summary: ${parts.join(', ')}`);
  }
}

/**
 * Abstract base class for all importers
 *
 * Subclasses must implement:
 * - getName(): Returns the importer name for logging
 * - import(): Performs the actual import operation
 */
export abstract class BaseImporter {
  protected context: ImportContext;
  protected logger: ILogger;

  constructor(context: ImportContext) {
    this.context = context;
    this.logger = context.logger;
  }

  /**
   * Get importer name for logging
   */
  abstract getName(): string;

  /**
   * Execute the import process
   */
  abstract import(): Promise<ImportResult>;

  /**
   * Create a new import result
   */
  protected createResult(): ImportResult {
    return createImportResult();
  }

  /**
   * Get the default language ID from tracker or database
   * First checks tracker metadata, then falls back to database lookup by is_default=true.
   * Returns the language ID (ISO-3 code, e.g., 'eng')
   */
  protected async getDefaultLanguageIdAsync(): Promise<string> {
    // Check tracker first (fast path)
    const trackerValue = this.context.tracker.getMetadata('default_language_id');
    if (trackerValue) {
      return trackerValue;
    }

    // Fall back to database lookup by backward_compatibility
    // The default language is English with backward_compatibility='en' (id='eng')
    // Note: We look up by backward_compatibility because that's how languages are tracked
    const result = await this.context.strategy.findByBackwardCompatibility(
      'languages',
      'en' // backward_compatibility value for English (default language)
    );

    if (result) {
      // Cache in tracker for future lookups
      this.context.tracker.setMetadata('default_language_id', result);
      return result;
    }

    throw new Error(
      'Default language ID not found in tracker or database. Language import must run first.'
    );
  }

  /**
   * Get a language ID by its legacy 2-character code (backward_compatibility)
   * Returns the language ID (ISO-3 code) or null if not found.
   *
   * Example: getLanguageIdByLegacyCodeAsync('en') returns 'eng'
   *
   * @param legacyCode The 2-character legacy language code (e.g., 'en', 'de', 'fr')
   * @returns The language ID (ISO-3 code) or null if not found
   */
  protected async getLanguageIdByLegacyCodeAsync(legacyCode: string): Promise<string | null> {
    // The tracker uses backward_compatibility (legacy code) as the key
    // and stores the language ID (ISO-3 code) as the UUID
    const trackerResult = this.context.tracker.getUuid(legacyCode, 'language');
    if (trackerResult) {
      return trackerResult;
    }

    // Fall back to database lookup by backward_compatibility
    const dbResult = await this.context.strategy.findByBackwardCompatibility(
      'languages',
      legacyCode
    );

    if (dbResult) {
      // Cache in tracker for future lookups
      this.context.tracker.set(legacyCode, dbResult, 'language');
    }

    return dbResult;
  }

  /**
   * Get the default context ID from tracker or database
   * First checks tracker (memory), then falls back to database for skipped phases.
   */
  protected async getDefaultContextIdAsync(): Promise<string> {
    // Check tracker first (fast path)
    const trackerValue = this.context.tracker.getMetadata('default_context_id');
    if (trackerValue) {
      return trackerValue;
    }

    // Fall back to the database, for a run that starts after the default
    // context's step (--start-at, --only): the key DefaultContextImporter gives it.
    const result = await this.context.strategy.findByBackwardCompatibility(
      'contexts',
      '__default_context__'
    );

    if (result) {
      // Cache in tracker for future lookups
      this.context.tracker.setMetadata('default_context_id', result);
      return result;
    }

    throw new Error(
      'Default context ID not found in tracker or database. Default context import must run first.'
    );
  }

  /**
   * Check if we're in dry-run mode
   */
  protected get isDryRun(): boolean {
    return this.context.dryRun;
  }

  /**
   * Check if we're in sample-only mode
   */
  protected get isSampleOnlyMode(): boolean {
    return this.context.sampleOnlyMode === true;
  }

  /**
   * Log info message
   */
  protected logInfo(message: string): void {
    this.logger.info(message);
  }

  /**
   * Log warning message
   */
  protected logWarning(message: string, details?: unknown): void {
    this.logger.warning(message, details);
  }

  /**
   * Log skip message - for expected deduplication (duplicate pivots, already-exists)
   * Also writes the 's' progress indicator.
   */
  protected logSkip(message: string): void {
    this.logger.skip(message);
    this.logger.showSkipped();
  }

  /**
   * Log error message - for expected/handled errors (data issues, constraint violations)
   * No stack trace is written.
   */
  protected logError(
    context: string,
    message: string,
    additionalContext?: Record<string, unknown>
  ): void {
    this.logger.error(context, message, additionalContext);
  }

  /**
   * Log exception - for unexpected runtime errors (connection lost, bugs)
   * Stack trace IS written.
   */
  protected logException(
    context: string,
    error: Error,
    additionalContext?: Record<string, unknown>
  ): void {
    this.logger.exception(context, error, additionalContext);
  }

  /**
   * Show progress indicator
   */
  protected showProgress(): void {
    this.logger.showProgress();
  }

  /**
   * Show skipped indicator
   */
  protected showSkipped(): void {
    this.logger.showSkipped();
  }

  /**
   * Show error indicator
   */
  protected showError(): void {
    this.logger.showError();
  }

  /**
   * Show import summary
   */
  protected showSummary(
    imported: number,
    skipped: number,
    errors: number,
    warnings?: number
  ): void {
    this.logger.showSummary(imported, skipped, errors, warnings);
  }

  /**
   * Collect a sample for test fixtures
   */
  protected collectSample(
    entityType: string,
    data: Record<string, unknown>,
    reason: SampleReason,
    details?: string,
    language?: string,
    sourceDb?: string
  ): void {
    if (this.context.sampleCollector) {
      this.context.sampleCollector.collectSample(
        entityType,
        data,
        reason,
        details,
        language,
        sourceDb
      );
    }
  }

  /**
   * Register an imported entity in the tracker
   */
  protected registerEntity(
    uuid: string,
    backwardCompatibility: string,
    entityType: EntityType
  ): void {
    this.context.tracker.register({
      uuid,
      backwardCompatibility,
      entityType,
      createdAt: new Date(),
    });
  }

  /**
   * Map EntityType to database table name for lookup queries
   */
  private entityTypeToTable(entityType: EntityType): string {
    const mapping: Record<EntityType, string> = {
      language: 'languages',
      language_translation: 'language_translations',
      country: 'countries',
      country_translation: 'country_translations',
      context: 'contexts',
      collection: 'collections',
      collection_translation: 'collection_translations',
      project: 'projects',
      partner: 'partners',
      partner_translation: 'partner_translations',
      item: 'items',
      item_translation: 'item_translations',
      image: 'item_images',
      tag: 'tags',
      author: 'authors',
      author_translation: 'author_translations',
      artist: 'artists',
      glossary: 'glossaries',
      glossary_translation: 'glossary_translations',
      glossary_spelling: 'glossary_spellings',
      item_item_link: 'item_item_links',
      item_item_link_translation: 'item_item_link_translations',
      dynasty: 'dynasties',
      dynasty_translation: 'dynasty_translations',
      timeline: 'timelines',
      timeline_event: 'timeline_events',
      timeline_event_translation: 'timeline_event_translations',
      item_media: 'item_media',
      collection_media: 'collection_media',
      item_document: 'item_documents',
      contributor: 'contributors',
      contributor_translation: 'contributor_translations',
    };
    return mapping[entityType];
  }

  /**
   * Check if entity already exists in tracker or database
   * First checks tracker (memory), then falls back to database for skipped phases.
   */
  protected async entityExistsAsync(
    backwardCompatibility: string,
    entityType: EntityType
  ): Promise<boolean> {
    // Check tracker first (fast path)
    if (this.context.tracker.exists(backwardCompatibility, entityType)) {
      return true;
    }

    // Fall back to database lookup for entities from skipped phases
    const table = this.entityTypeToTable(entityType);
    return this.context.strategy.exists(table, backwardCompatibility);
  }

  /**
   * Get UUID from tracker or database by backward_compatibility
   * First checks tracker (memory), then falls back to database for entities from skipped phases.
   * This is essential when starting import from a later phase (e.g., --start-at phase-10).
   */
  protected async getEntityUuidAsync(
    backwardCompatibility: string,
    entityType: EntityType
  ): Promise<string | null> {
    // Check tracker first (fast path)
    const trackerResult = this.context.tracker.getUuid(backwardCompatibility, entityType);
    if (trackerResult) {
      return trackerResult;
    }

    // Fall back to database lookup for entities from skipped phases
    const table = this.entityTypeToTable(entityType);
    const dbResult = await this.context.strategy.findByBackwardCompatibility(
      table,
      backwardCompatibility
    );

    // If found in database, cache in tracker for future lookups
    if (dbResult) {
      this.context.tracker.set(backwardCompatibility, dbResult, entityType);
    }

    return dbResult;
  }

  /**
   * Check if an image row already exists for a given owner + legacy path.
   * The image-table counterpart to entityExistsAsync(): item_images and its
   * five siblings have no backward_compatibility column, so identity is
   * (owner id, legacy path) instead — always queries the database directly
   * (via IWriteStrategy.imageExists()), since these tables aren't tracked
   * in the in-memory tracker across the composite (owner, path) key.
   */
  protected async imageExistsAsync(
    table: ImageTable,
    ownerId: string,
    path: string
  ): Promise<boolean> {
    return (await this.context.strategy.imageExists(table, ownerId, path)) !== null;
  }
}
