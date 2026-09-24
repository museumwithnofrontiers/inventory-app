/**
 * Core Types and Interfaces for the Unified Import Architecture
 *
 * This module defines the fundamental types used throughout the import system.
 * Following Single Responsibility Principle, types are grouped by their concern.
 */

// ============================================================================
// Import Result Types
// ============================================================================

/**
 * Result of an import operation
 */
export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

/**
 * Create a default import result
 */
export function createImportResult(): ImportResult {
  return {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };
}

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Supported entity types in the import system
 */
export type EntityType =
  | 'language'
  | 'language_translation'
  | 'country'
  | 'country_translation'
  | 'context'
  | 'collection'
  | 'collection_translation'
  | 'project'
  | 'partner'
  | 'partner_translation'
  | 'item'
  | 'item_translation'
  | 'image'
  | 'tag'
  | 'author'
  | 'author_translation'
  | 'artist'
  | 'dynasty'
  | 'dynasty_translation'
  | 'timeline'
  | 'timeline_event'
  | 'timeline_event_translation'
  | 'glossary'
  | 'glossary_translation'
  | 'glossary_spelling'
  | 'item_item_link'
  | 'item_item_link_translation'
  | 'item_media'
  | 'collection_media'
  | 'item_document'
  | 'contributor'
  | 'contributor_translation';

/**
 * Imported entity record for tracking
 */
export interface ImportedEntity {
  uuid: string;
  backwardCompatibility: string;
  entityType: EntityType;
  createdAt: Date;
}

// ============================================================================
// Base Data Types (Common across strategies)
// ============================================================================

/**
 * Base fields for all entities
 */
export interface BaseEntityData {
  internal_name: string;
  backward_compatibility: string;
}

/**
 * Language data for write operations
 */
export interface LanguageData extends Omit<BaseEntityData, 'backward_compatibility'> {
  id: string; // ISO 639-3 code
  backward_compatibility: string | null;
  is_default?: boolean;
}

/**
 * Language translation data
 */
export interface LanguageTranslationData {
  language_id: string; // The language being translated
  display_language_id: string; // The language of the translation
  name: string;
  backward_compatibility: string;
}

/**
 * Country data for write operations
 */
export interface CountryData extends Omit<BaseEntityData, 'backward_compatibility'> {
  id: string; // ISO 3166-1 alpha-3 code
  backward_compatibility: string | null;
}

/**
 * Country translation data
 */
export interface CountryTranslationData {
  country_id: string;
  language_id: string;
  name: string;
  backward_compatibility: string;
}

/**
 * Context data for write operations
 */
export interface ContextData extends BaseEntityData {
  is_default?: boolean;
}

/**
 * Context translation data
 */
export interface ContextTranslationData {
  context_id: string;
  language_id: string;
  name: string;
  description?: string | null;
}

/**
 * Collection data for write operations
 */
export interface CollectionData extends BaseEntityData {
  context_id: string;
  language_id: string; // Required: ISO 639-3 code
  parent_id?: string | null;
  type?: string | null; // collection, exhibition, gallery, theme, exhibition trail, itinerary, location
  purpose?: string | null; // functional role within the context (e.g. exhibitions-root); null for ordinary collections
  extra?: string | null; // JSON-encoded collection-level attributes (not per-language)
  display_order?: number | null;
  // GPS Location (optional)
  latitude?: number | null;
  longitude?: number | null;
  map_zoom?: number | null;
  // Country reference (optional)
  country_id?: string | null;
}

/**
 * Collection translation data
 */
export interface CollectionTranslationData {
  collection_id: string;
  language_id: string;
  context_id: string;
  backward_compatibility: string;
  title: string;
  description?: string | null;
  quote?: string | null;
  extra?: string | null;
}

/**
 * Project data for write operations
 */
export interface ProjectData extends BaseEntityData {
  context_id: string;
  language_id: string; // Required: ISO 639-3 code
  launch_date?: string | null;
  is_launched?: boolean;
  is_enabled?: boolean;
  site_url?: string | null;
  related_database_url?: string | null;
  artistic_introduction_url?: string | null;
}

/**
 * Project translation data
 */
export interface ProjectTranslationData {
  project_id: string;
  language_id: string;
  context_id: string;
  name: string;
  description?: string | null;
}

/**
 * Partner data for write operations
 */
export interface PartnerData extends BaseEntityData {
  type: 'museum' | 'institution' | 'school';
  latitude?: number | null;
  longitude?: number | null;
  map_zoom?: number | null;
  country_id?: string | null;
  project_id?: string | null;
  monument_item_id?: string | null;
  visible?: boolean | null;
}

/**
 * Partner translation data
 */
export interface PartnerTranslationData {
  partner_id: string;
  language_id: string;
  context_id: string;
  backward_compatibility: string;
  name: string;
  description?: string | null;
  city_display?: string | null;
  address?: string | null;
  contact_website?: string | null;
  contact_phone?: string | null;
  contact_email_general?: string | null;
  extra?: string | null;
}

/**
 * Item data for write operations
 */
export interface ItemData extends BaseEntityData {
  type: 'object' | 'monument' | 'detail' | 'picture';
  collection_id?: string | null; // Optional: some items (like explore monuments) may not have a default collection
  partner_id?: string | null;
  country_id?: string | null;
  project_id?: string | null;
  parent_id?: string | null;
  owner_reference?: string | null;
  mwnf_reference?: string | null;
  display_order?: number | null;
  start_date?: number | null;
  end_date?: number | null;
  // GPS Location (optional, primarily for monuments)
  latitude?: number | null;
  longitude?: number | null;
  map_zoom?: number | null;
}

/**
 * Collection-Item link data for pivot table (many-to-many)
 */
export interface CollectionItemData {
  collection_id: string;
  item_id: string;
  backward_compatibility?: string | null;
  display_order?: number | null;
  extra?: Record<string, unknown> | null;
}

/**
 * Item translation data
 */
export interface ItemTranslationData {
  item_id: string;
  language_id: string;
  context_id: string;
  backward_compatibility: string;
  name: string;
  /**
   * Nullable since the 2025-10-21 migration made `item_translations.description`
   * nullable. A legacy record can be fully catalogued — name, materials,
   * dimensions, dates, bibliography — and carry no descriptive text at all;
   * legacy publishes those, so the importer must too.
   */
  description: string | null;
  alternate_name?: string | null;
  type?: string | null;
  holder?: string | null;
  owner?: string | null;
  initial_owner?: string | null;
  dates?: string | null;
  location?: string | null;
  dimensions?: string | null;
  place_of_production?: string | null;
  method_for_datation?: string | null;
  method_for_provenance?: string | null;
  provenance?: string | null;
  obtention?: string | null;
  bibliography?: string | null;
  author_id?: string | null;
  text_copy_editor_id?: string | null;
  translator_id?: string | null;
  translation_copy_editor_id?: string | null;
  extra?: string | null;
}

/**
 * Tag data for write operations
 */
export interface TagData extends BaseEntityData {
  category: string;
  language_id: string;
  description?: string | null;
}

/**
 * Author data for write operations
 */
export interface AuthorData extends BaseEntityData {
  name: string;
  firstname?: string | null;
  lastname?: string | null;
  givenname?: string | null;
  originalname?: string | null;
}

/**
 * Author translation data for write operations
 */
export interface AuthorTranslationData {
  author_id: string;
  language_id: string;
  context_id: string;
  curriculum?: string | null;
  backward_compatibility?: string | null;
  extra?: string | null;
}

/**
 * Artist data for write operations
 */
export interface ArtistData extends BaseEntityData {
  name: string;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  date_of_birth?: string | null;
  date_of_death?: string | null;
  period_of_activity?: string | null;
}

/**
 * Item image data for write operations
 */
export interface ItemImageData {
  id?: string; // Optional: for preserving IDs from AvailableImage
  item_id: string;
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  alt_text?: string | null;
  copyright?: string | null; // Burned verbatim; see utils/image-copyright.ts
  display_order: number;
}

/**
 * Partner image data for write operations
 */
export interface PartnerImageData {
  id?: string; // Optional: for preserving IDs from AvailableImage
  partner_id: string;
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  alt_text?: string | null;
  copyright?: string | null; // Burned verbatim; see utils/image-copyright.ts
  display_order: number;
  extra?: string | null;
}

/**
 * Partner logo data for write operations
 */
export interface PartnerLogoData {
  id?: string; // Optional: for preserving IDs
  partner_id: string;
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  logo_type?: string; // 'primary', 'secondary', 'sponsor', etc.
  alt_text?: string | null;
  display_order: number;
}

/**
 * Collection image data for write operations
 */
export interface CollectionImageData {
  id?: string; // Optional: for preserving IDs
  collection_id: string;
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  alt_text?: string | null;
  copyright?: string | null; // Burned verbatim; see utils/image-copyright.ts
  display_order: number;
  /**
   * Pre-stringified JSON passenger data, mirroring `PartnerImageData.extra`.
   * Stringify at the call site — `SKIP_SANITIZE_FIELDS` exempts a field named
   * `extra` from the HTML→Markdown pass, so the JSON survives intact.
   */
  extra?: string | null;
}

/**
 * Glossary (Word) data for write operations
 */
export type GlossaryData = BaseEntityData;

/**
 * Glossary translation (definition) data for write operations
 */
export interface GlossaryTranslationData {
  glossary_id: string;
  language_id: string;
  definition: string;
}

/**
 * Glossary spelling data for write operations
 */
export interface GlossarySpellingData {
  glossary_id: string;
  language_id: string;
  spelling: string;
}

/**
 * Item-Item Link data for write operations
 */
export interface ItemItemLinkData {
  source_id: string;
  target_id: string;
  context_id: string;
  backward_compatibility?: string | null;
}

/**
 * Item-Item Link Translation data for write operations
 */
export interface ItemItemLinkTranslationData {
  item_item_link_id: string;
  language_id: string;
  description?: string | null;
  reciprocal_description?: string | null;
  backward_compatibility?: string | null;
}

// ============================================================================
// Dynasty Types
// ============================================================================

/**
 * Dynasty data for write operations
 */
export interface DynastyData {
  backward_compatibility: string;
  from_ah?: number | null;
  to_ah?: number | null;
  from_ad?: number | null;
  to_ad?: number | null;
}

/**
 * Dynasty translation data for write operations
 */
export interface DynastyTranslationData {
  dynasty_id: string;
  language_id: string;
  name?: string | null;
  also_known_as?: string | null;
  area?: string | null;
  history?: string | null;
  date_description_ah?: string | null;
  date_description_ad?: string | null;
  backward_compatibility?: string | null;
  extra?: string | null;
}

/**
 * Item-Dynasty link data for pivot table (many-to-many)
 */
export interface ItemDynastyData {
  item_id: string;
  dynasty_id: string;
}

// ============================================================================
// Timeline Types
// ============================================================================

/**
 * Timeline data for write operations
 */
export interface TimelineData {
  internal_name: string;
  country_id?: string | null;
  collection_id?: string | null;
  backward_compatibility: string;
  extra?: string | null;
}

/**
 * Timeline event data for write operations
 */
export interface TimelineEventData {
  timeline_id: string;
  internal_name: string;
  year_from: number;
  year_to: number;
  year_from_ah?: number | null;
  year_to_ah?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  display_order: number;
  backward_compatibility: string;
  extra?: string | null;
}

/**
 * Timeline event translation data for write operations
 */
export interface TimelineEventTranslationData {
  timeline_event_id: string;
  language_id: string;
  name?: string | null;
  description?: string | null;
  date_from_description?: string | null;
  date_to_description?: string | null;
  date_from_ah_description?: string | null;
  backward_compatibility?: string | null;
  extra?: string | null;
}

/**
 * Timeline event ↔ item pivot data
 */
export interface TimelineEventItemData {
  timeline_event_id: string;
  item_id: string;
  display_order: number;
  backward_compatibility?: string | null;
  extra?: string | null;
}

/**
 * Timeline event image data for write operations
 */
export interface TimelineEventImageData {
  id?: string;
  timeline_event_id: string;
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  alt_text?: string | null;
  display_order: number;
}

// ============================================================================
// Media Types (Audio/Video — external URLs)
// ============================================================================

/**
 * Item media data for write operations (audio/video URLs)
 */
export interface ItemMediaData {
  item_id: string;
  language_id?: string | null;
  type: 'audio' | 'video';
  title: string;
  description?: string | null;
  url: string;
  display_order: number;
  extra?: string | null;
  backward_compatibility?: string | null;
}

/**
 * Collection media data for write operations (audio/video/document URLs)
 */
export interface CollectionMediaData {
  collection_id: string;
  language_id?: string | null;
  type: 'audio' | 'video' | 'document';
  title: string;
  description?: string | null;
  url: string;
  display_order: number;
  extra?: string | null;
  backward_compatibility?: string | null;
}

// ============================================================================
// Document Types (uploaded files)
// ============================================================================

/**
 * Item document data for write operations (uploaded files — PDFs, etc.)
 */
export interface ItemDocumentData {
  item_id: string;
  language_id?: string | null;
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  title?: string | null;
  display_order: number;
  extra?: string | null;
  backward_compatibility?: string | null;
}

// ============================================================================
// Contributor Types
// ============================================================================

/**
 * Contributor data for write operations
 */
export interface ContributorData {
  id?: string;
  collection_id: string;
  category: string;
  display_order: number;
  visible: boolean;
  backward_compatibility?: string | null;
  internal_name: string;
}

/**
 * Contributor translation data for write operations
 */
export interface ContributorTranslationData {
  id?: string;
  contributor_id: string;
  language_id: string;
  context_id: string;
  name?: string | null;
  description?: string | null;
  link?: string | null;
  alt_text?: string | null;
  extra?: string | null;
  backward_compatibility?: string | null;
}

/**
 * Contributor image data for write operations
 */
export interface ContributorImageData {
  id?: string;
  contributor_id: string;
  path: string;
  original_name: string;
  mime_type: string;
  size: number;
  alt_text?: string | null;
  display_order: number;
}

/**
 * The six tables with no backward_compatibility column. An image row's
 * identity is (owner id, legacy path) instead — see
 * SqlWriteStrategy.imageExists() / computeImageId().
 */
export type ImageTable =
  | 'item_images'
  | 'partner_images'
  | 'partner_logos'
  | 'collection_images'
  | 'contributor_images'
  | 'timeline_event_images';
