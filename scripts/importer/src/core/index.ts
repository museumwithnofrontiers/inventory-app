/**
 * Core Module Exports
 *
 * This module exports all core interfaces, types, and base classes
 * needed by the import system.
 */

// Types
export type {
  ImportResult,
  EntityType,
  ImportedEntity,
  BaseEntityData,
  LanguageData,
  LanguageTranslationData,
  CountryData,
  CountryTranslationData,
  ContextData,
  ContextTranslationData,
  CollectionData,
  CollectionTranslationData,
  ProjectData,
  ProjectTranslationData,
  PartnerData,
  PartnerTranslationData,
  ItemData,
  ItemTranslationData,
  TagData,
  AuthorData,
  PartnerLogoData,
} from './types.js';

export { createImportResult } from './types.js';

// Tracker
export type { ITracker } from './tracker.js';
export { UnifiedTracker } from './tracker.js';

// Strategy
export type { IWriteStrategy } from './strategy.js';

// Base Importer
export type {
  SampleReason,
  ISampleCollector,
  ILegacyDatabase,
  ImportContext,
  ILogger,
} from './base-importer.js';
export { BaseImporter, ConsoleLogger } from './base-importer.js';

// File Logger
export type { PhaseSummary } from './file-logger.js';
export { FileLogger } from './file-logger.js';
