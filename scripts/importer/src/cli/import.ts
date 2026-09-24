#!/usr/bin/env node
/**
 * Unified Legacy Import CLI
 *
 * This is the main entry point for the unified import system.
 * Currently implements SQL-based import strategy.
 *
 * Usage:
 *   npm run import [options]
 *
 * Options:
 *   --dry-run          Simulate import without writing data
 *   --start-at <name>  Start from specific importer
 *   --stop-at <name>   Stop at specific importer
 *   --only <name>      Run only the specified importer
 *   --list-importers   List all available importers
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import mysql from 'mysql2/promise';

import { UnifiedTracker } from '../core/tracker.js';
import { SqlWriteStrategy } from '../strategies/sql-strategy.js';
import type { ImportContext, ILegacyDatabase } from '../core/base-importer.js';
import type { ImportResult } from '../core/types.js';
import { FileLogger, type PhaseSummary } from '../core/file-logger.js';
import { orderConfigsByDependencies } from '../utils/importer-order.js';

import {
  DefaultContextImporter,
  LanguageImporter,
  LanguageTranslationImporter,
  CountryImporter,
  CountryTranslationImporter,
  ProjectImporter,
  PartnerImporter,
  ObjectImporter,
  MonumentImporter,
  MonumentDetailImporter,
  ItemItemLinkImporter,
  DynastyImporter,
  ObjectPictureImporter,
  MonumentPictureImporter,
  MonumentDetailPictureImporter,
  PartnerPictureImporter,
  PartnerLogoImporter,
  // Phase 03: Sharing History
  ShProjectImporter,
  ShPartnerImporter,
  ShPartnerLogoImporter,
  ShPartnerPictureImporter,
  ShObjectImporter,
  ShMonumentImporter,
  ShMonumentDetailImporter,
  ShObjectPictureImporter,
  ShMonumentPictureImporter,
  ShMonumentDetailPictureImporter,
  ShExhibitionImporter,
  ShExhibitionTranslationImporter,
  ShExhibitionItemImporter,
  // Phase 04: Glossary
  GlossaryImporter,
  GlossaryTranslationImporter,
  GlossarySpellingImporter,
  // Phase 06: Explore
  ExploreContextImporter,
  ExploreRootCollectionsImporter,
  ExploreThematicCycleImporter,
  ExploreThematicCyclePictureImporter,
  ExploreThematicCycleTranslationImporter,
  ExploreCountryImporter,
  ExploreRegionImporter,
  ExploreRegionLocationLinker,
  ExploreLocationImporter,
  ExploreLocationPictureImporter,
  ExploreLocationTranslationImporter,
  ExploreMonumentImporter,
  ExploreMonumentPictureImporter,
  ExploreMonumentTranslationImporter,
  ExploreMonumentCrossRefImporter,
  ExploreMonumentThemeLinkImporter,
  ExploreItineraryImporter,
  ExploreItineraryContentImporter,
  ExploreFilterImporter,
  // Phase 07: Travels
  TravelsContextImporter,
  TravelsRootCollectionImporter,
  TravelsTrailImporter,
  TravelsTrailTranslationImporter,
  TravelsItineraryImporter,
  TravelsItineraryTranslationImporter,
  TravelsLocationImporter,
  TravelsLocationTranslationImporter,
  TravelsMonumentImporter,
  TravelsMonumentTranslationImporter,
  TravelsTrailPictureImporter,
  TravelsItineraryPictureImporter,
  TravelsLocationPictureImporter,
  TravelsMonumentPictureImporter,
  // Phase 10: Thematic Galleries (runs last, after all other legacy DBs)
  ThgGalleryContextImporter,
  ThgRootCollectionsImporter,
  ThgGalleryImporter,
  ThgGalleryLangImporter,
  ThgGalleryTranslationImporter,
  ThgThemeImporter,
  ThgThemeTranslationImporter,
  ThgThemeItemImporter,
  ThgThemeItemTranslationImporter,
  ThgThemeCoverImageImporter,
  ThgItemRelatedImporter,
  ThgItemRelatedTranslationImporter,
  // Phase 10: Gallery-Item Link Importers
  ThgGalleryMwnf3ObjectImporter,
  ThgGalleryMwnf3MonumentImporter,
  ThgGalleryShObjectImporter,
  ThgGalleryShMonumentImporter,
  ThgGalleryTravelMonumentImporter,
  ThgGalleryExploreMonumentImporter,
  ThgGalleryNativeProjectImporter,
  ProjectCleanupImporter,
  PartnerMonumentLinker,
  ProjectExhibitionRootKeyingImporter,
  ShExhibitionRootKeyingImporter,
  ShExhibitionShowFlagImporter,
  ShItemDisplayStatusImporter,
  ShExhibitionItemJustificationsImporter,
  ShPartnerProjectLinkerImporter,
  ShHbGeneralImporter,
  ShHbRecontextImporter,
  ShHistoricalProfilesRootImporter,
  CollectionPurposeBackfillImporter,
  ExtraBitBufferBackfillImporter,
  MuseumProjectLinkBackfillImporter,
  ExhibitionI18nTextBackfillImporter,
  ExhibitionLogoExtraBackfillImporter,
  ExploreMonumentCountryBackfillImporter,
  AuthorImporter,
  TimelineImporter,
  ItemMediaImporter,
  ItemDocumentImporter,
  CollectionMediaImporter,
  SchoolImporter,
  ThgContributorImporter,
  ThgTagImporter,
  ThgTimelineImporter,
  ThgGalleryContentImporter,
  ThgHiddenMuseumImporter,
  PartnerHierarchyImporter,
  InstitutionHierarchyImporter,
  ArtintroRootCollectionImporter,
  ExhibitionsRootCollectionImporter,
  Mwnf3ExhibitionImporter,
  Mwnf3ExhibitionTranslationImporter,
  Mwnf3ExhibitionItemImporter,
  ShNationalContextImporter,
  ShBibliographyHbImporter,
} from '../importers/index.js';
import { ImageSyncTool } from '../tools/image-sync.js';
import { resolveImageTargetDir } from '../tools/image-target-dir.js';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Importer registry
interface ImporterConfig {
  key: string;
  name: string;
  description: string;
  importerClass: new (context: ImportContext) => {
    import(): Promise<ImportResult>;
    getName(): string;
  };
  dependencies?: string[];
}

const ALL_IMPORTERS: ImporterConfig[] = [
  // Phase 0: Reference Data
  {
    key: 'default-context',
    name: 'Default Context',
    description: 'Create default context with is_default=true',
    importerClass: DefaultContextImporter,
    dependencies: [],
  },
  {
    key: 'language',
    name: 'Languages',
    description: 'Import language reference data',
    importerClass: LanguageImporter,
    dependencies: [],
  },
  {
    key: 'language-translation',
    name: 'Language Translations',
    description: 'Import language name translations',
    importerClass: LanguageTranslationImporter,
    dependencies: ['language'],
  },
  {
    key: 'country',
    name: 'Countries',
    description: 'Import country reference data',
    importerClass: CountryImporter,
    dependencies: [],
  },
  {
    key: 'country-translation',
    name: 'Country Translations',
    description: 'Import country name translations',
    importerClass: CountryTranslationImporter,
    dependencies: ['language', 'country'],
  },
  // Phase 1: Core Data
  {
    key: 'project',
    name: 'Projects',
    description: 'Import projects (creates Context, Collection, Project)',
    importerClass: ProjectImporter,
    dependencies: ['default-context', 'language'],
  },
  {
    key: 'partner',
    name: 'Partners',
    description: 'Import museums and institutions',
    importerClass: PartnerImporter,
    dependencies: ['default-context', 'project', 'language', 'country'],
  },
  {
    key: 'school',
    name: 'Schools',
    description: 'Import schools as partners (type: school) with translations, logos, and pictures',
    importerClass: SchoolImporter,
    dependencies: ['default-context', 'project', 'language', 'country'],
  },
  {
    key: 'partner-hierarchy',
    name: 'Partner Hierarchy',
    description:
      'Import partner hierarchy levels (partner/associated/minor) from partner_museums tables',
    importerClass: PartnerHierarchyImporter,
    dependencies: ['project', 'partner'],
  },
  {
    key: 'institution-hierarchy',
    name: 'Institution Hierarchy',
    description:
      'Import institution hierarchy levels (partner/associated) from partner_institutions tables',
    importerClass: InstitutionHierarchyImporter,
    dependencies: ['project', 'partner'],
  },
  {
    key: 'object',
    name: 'Objects',
    description: 'Import object items',
    importerClass: ObjectImporter,
    dependencies: ['project', 'partner', 'language'],
  },
  {
    key: 'monument',
    name: 'Monuments',
    description: 'Import monument items',
    importerClass: MonumentImporter,
    dependencies: ['project', 'partner', 'language'],
  },
  {
    key: 'monument-detail',
    name: 'Monument Details',
    description: 'Import monument detail items (children of monuments)',
    importerClass: MonumentDetailImporter,
    dependencies: ['monument', 'default-context', 'language'],
  },
  {
    key: 'item-item-link',
    name: 'Item-Item Links',
    description:
      'Import relationships between items (object-object, object-monument, monument-monument, monument-object) with justification translations',
    importerClass: ItemItemLinkImporter,
    dependencies: ['object', 'monument', 'default-context', 'language'],
  },
  {
    key: 'dynasty',
    name: 'Dynasties',
    description: 'Import dynasties with translations and item-dynasty links from mwnf3',
    importerClass: DynastyImporter,
    dependencies: ['object', 'monument', 'language'],
  },
  // Phase 2: Images
  {
    key: 'object-picture',
    name: 'Object Pictures',
    description: 'Import object pictures (ItemImages + child picture Items)',
    importerClass: ObjectPictureImporter,
    dependencies: ['object', 'default-context', 'language'],
  },
  {
    key: 'monument-picture',
    name: 'Monument Pictures',
    description: 'Import monument pictures (ItemImages + child picture Items)',
    importerClass: MonumentPictureImporter,
    dependencies: ['monument', 'default-context', 'language'],
  },
  {
    key: 'monument-detail-picture',
    name: 'Monument Detail Pictures',
    description: 'Import monument detail pictures (ItemImages + child picture Items)',
    importerClass: MonumentDetailPictureImporter,
    dependencies: ['monument-detail', 'default-context', 'language'],
  },
  {
    key: 'partner-picture',
    name: 'Partner Pictures',
    description: 'Import museum and institution pictures (PartnerImages)',
    importerClass: PartnerPictureImporter,
    dependencies: ['partner'],
  },
  {
    key: 'partner-logo',
    name: 'Partner Logos',
    description: 'Import museum and institution logos (PartnerLogos)',
    importerClass: PartnerLogoImporter,
    dependencies: ['partner'],
  },
  // Phase 3: Sharing History Data
  {
    key: 'sh-project',
    name: 'SH Projects',
    description: 'Import Sharing History projects (Context, Collection, Project)',
    importerClass: ShProjectImporter,
    dependencies: ['default-context', 'language'],
  },
  {
    key: 'sh-partner',
    name: 'SH Partners',
    description: 'Import Sharing History partners (reuses mwnf3 partners via mapping)',
    importerClass: ShPartnerImporter,
    dependencies: ['default-context', 'sh-project', 'partner', 'language', 'country'],
  },
  {
    key: 'sh-partner-logo',
    name: 'SH Partner Logos',
    description: 'Import Sharing History partner logos',
    importerClass: ShPartnerLogoImporter,
    dependencies: ['sh-partner'],
  },
  {
    key: 'sh-partner-picture',
    name: 'SH Partner Pictures',
    description: 'Import Sharing History partner profile/gallery pictures',
    importerClass: ShPartnerPictureImporter,
    dependencies: ['sh-partner'],
  },
  {
    key: 'sh-object',
    name: 'SH Objects',
    description: 'Import Sharing History object items',
    importerClass: ShObjectImporter,
    dependencies: ['sh-project', 'sh-partner', 'language'],
  },
  {
    key: 'sh-monument',
    name: 'SH Monuments',
    description: 'Import Sharing History monument items',
    importerClass: ShMonumentImporter,
    dependencies: ['sh-project', 'sh-partner', 'language'],
  },
  {
    key: 'sh-monument-detail',
    name: 'SH Monument Details',
    description: 'Import Sharing History monument detail items',
    importerClass: ShMonumentDetailImporter,
    dependencies: ['sh-monument', 'default-context', 'language'],
  },
  {
    key: 'sh-object-picture',
    name: 'SH Object Pictures',
    description: 'Import Sharing History object pictures',
    importerClass: ShObjectPictureImporter,
    dependencies: ['sh-object', 'default-context', 'language'],
  },
  {
    key: 'sh-monument-picture',
    name: 'SH Monument Pictures',
    description: 'Import Sharing History monument pictures',
    importerClass: ShMonumentPictureImporter,
    dependencies: ['sh-monument', 'default-context', 'language'],
  },
  {
    key: 'sh-monument-detail-picture',
    name: 'SH Monument Detail Pictures',
    description: 'Import Sharing History monument detail pictures',
    importerClass: ShMonumentDetailPictureImporter,
    dependencies: ['sh-monument-detail', 'default-context', 'language'],
  },
  {
    key: 'sh-exhibition',
    name: 'SH Exhibitions',
    description:
      'Import SH exhibition hierarchy (exhibitions, themes, subthemes) as nested collections',
    importerClass: ShExhibitionImporter,
    dependencies: ['sh-project'],
  },
  {
    key: 'sh-exhibition-translation',
    name: 'SH Exhibition Translations',
    description: 'Import translations for SH exhibitions, themes, and subthemes',
    importerClass: ShExhibitionTranslationImporter,
    dependencies: ['sh-exhibition', 'language'],
  },
  {
    key: 'sh-exhibition-item',
    name: 'SH Exhibition Items',
    description:
      'Import item assignments and image references for SH exhibitions, themes, and subthemes',
    importerClass: ShExhibitionItemImporter,
    dependencies: ['sh-exhibition', 'sh-object', 'sh-monument'],
  },
  {
    key: 'sh-national-context',
    name: 'SH National Context',
    description:
      'Import SH National Context country-exhibition collections, images, and item assignments',
    importerClass: ShNationalContextImporter,
    dependencies: ['sh-exhibition', 'sh-object', 'sh-monument', 'country'],
  },
  {
    key: 'sh-bibliography-hb',
    name: 'SH Bibliography & Historical Background',
    description:
      'Import SH structured bibliography into targets, and Historical Background collections with pages/images/maps',
    importerClass: ShBibliographyHbImporter,
    dependencies: ['sh-exhibition', 'sh-object', 'sh-monument', 'sh-national-context'],
  },
  // Phase 1: mwnf3 Exhibition System
  {
    key: 'artintro-root-collection',
    name: 'Artistic Introduction Root Collection',
    description:
      'Create the "Artistic Introduction" marker collection (child of the ISL project collection) that the artintro hierarchy nests under',
    importerClass: ArtintroRootCollectionImporter,
    dependencies: ['project', 'language'],
  },
  {
    key: 'exhibitions-root-collection',
    name: 'Virtual Exhibitions Root Collection',
    description:
      'Create the "Virtual Exhibitions" marker collection (child of the ISL project collection) that ISL exhibitions nest under',
    importerClass: ExhibitionsRootCollectionImporter,
    dependencies: ['project', 'language'],
  },
  {
    key: 'mwnf3-exhibition',
    name: 'MWNF3 Exhibitions',
    description: 'Import mwnf3 exhibition + artintro hierarchy as nested collections',
    importerClass: Mwnf3ExhibitionImporter,
    dependencies: [
      'project',
      'language',
      'artintro-root-collection',
      'exhibitions-root-collection',
    ],
  },
  {
    key: 'mwnf3-exhibition-translation',
    name: 'MWNF3 Exhibition Translations',
    description:
      'Import EAV-based translations for mwnf3 exhibitions, themes, pages, and artintros',
    importerClass: Mwnf3ExhibitionTranslationImporter,
    dependencies: ['mwnf3-exhibition', 'language'],
  },
  {
    key: 'mwnf3-exhibition-item',
    name: 'MWNF3 Exhibition Items',
    description:
      'Import mwnf3 exhibition page images (item refs + custom) and exhibition-level images',
    importerClass: Mwnf3ExhibitionItemImporter,
    dependencies: ['mwnf3-exhibition', 'object', 'monument'],
  },
  // Phase 4: Glossary
  {
    key: 'glossary',
    name: 'Glossary Words',
    description: 'Import glossary words from legacy database',
    importerClass: GlossaryImporter,
    dependencies: ['language'],
  },
  {
    key: 'glossary-translation',
    name: 'Glossary Definitions',
    description: 'Import glossary definitions (translations)',
    importerClass: GlossaryTranslationImporter,
    dependencies: ['glossary', 'language'],
  },
  {
    key: 'glossary-spelling',
    name: 'Glossary Spellings',
    description: 'Import glossary spelling variants',
    importerClass: GlossarySpellingImporter,
    dependencies: ['glossary', 'language'],
  },
  // Phase 05: Timelines (HCR)
  {
    key: 'timeline',
    name: 'Timelines (HCR)',
    description:
      'Import Heritage Conservation Resources timelines, events, translations, item links, and bibliography from mwnf3 and Sharing History',
    importerClass: TimelineImporter,
    dependencies: ['country', 'language', 'object', 'monument', 'sh-object', 'sh-monument'],
  },
  // Phase 08: Media & Documents
  {
    key: 'item-media',
    name: 'Item Media',
    description: 'Import audio/video URLs attached to items from mwnf3 and Sharing History',
    importerClass: ItemMediaImporter,
    dependencies: ['object', 'monument', 'sh-object', 'language'],
  },
  {
    key: 'item-document',
    name: 'Item Documents',
    description: 'Import document files (PDFs) attached to SH items',
    importerClass: ItemDocumentImporter,
    dependencies: ['sh-object', 'language'],
  },
  // Phase 06: Explore
  {
    key: 'explore-context',
    name: 'Explore Context',
    description: 'Create context for Explore application',
    importerClass: ExploreContextImporter,
    dependencies: [],
  },
  {
    key: 'explore-root-collections',
    name: 'Explore Root Collections',
    description: 'Create root collections for Explore (by Theme, Country, Itinerary)',
    importerClass: ExploreRootCollectionsImporter,
    dependencies: ['explore-context', 'language'],
  },
  {
    key: 'explore-thematiccycle',
    name: 'Explore Thematic Cycles',
    description: 'Import thematic cycles from Explore database',
    importerClass: ExploreThematicCycleImporter,
    dependencies: ['explore-root-collections'],
  },
  {
    key: 'explore-thematiccycle-picture',
    name: 'Explore Thematic Cycle Pictures',
    description: 'Import thematic cycle pictures from Explore database',
    importerClass: ExploreThematicCyclePictureImporter,
    dependencies: ['explore-thematiccycle'],
  },
  {
    key: 'explore-thematiccycle-translation',
    name: 'Explore Thematic Cycle Translations',
    description:
      'Import multilingual translations, country associations, and country pictures for thematic cycles',
    importerClass: ExploreThematicCycleTranslationImporter,
    dependencies: ['explore-thematiccycle'],
  },
  {
    key: 'explore-country',
    name: 'Explore Countries',
    description: 'Import country collections from Explore locations',
    importerClass: ExploreCountryImporter,
    dependencies: ['explore-root-collections', 'country'],
  },
  {
    key: 'explore-region',
    name: 'Explore Regions',
    description: 'Import region collections from Explore, parented under country collections',
    importerClass: ExploreRegionImporter,
    dependencies: ['explore-country'],
  },
  {
    key: 'explore-location',
    name: 'Explore Locations',
    description: 'Import location collections (cities/places) from Explore',
    importerClass: ExploreLocationImporter,
    dependencies: ['explore-country'],
  },
  {
    key: 'explore-region-location-linker',
    name: 'Explore Region-Location Linker',
    description: 'Re-parent location collections under their most specific region',
    importerClass: ExploreRegionLocationLinker,
    dependencies: ['explore-region', 'explore-location'],
  },
  {
    key: 'explore-location-picture',
    name: 'Explore Location Pictures',
    description: 'Import location pictures from Explore database',
    importerClass: ExploreLocationPictureImporter,
    dependencies: ['explore-location'],
  },
  {
    key: 'explore-location-translation',
    name: 'Explore Location Translations',
    description: 'Import multilingual translations, visibility flags, and contacts for locations',
    importerClass: ExploreLocationTranslationImporter,
    dependencies: ['explore-location'],
  },
  {
    key: 'explore-monument',
    name: 'Explore Monuments',
    description: 'Import monuments with geocoordinates from Explore',
    importerClass: ExploreMonumentImporter,
    dependencies: ['explore-location', 'monument', 'sh-monument', 'travels-monument'],
  },
  {
    key: 'explore-monument-picture',
    name: 'Explore Monument Pictures',
    description: 'Import monument pictures from Explore database',
    importerClass: ExploreMonumentPictureImporter,
    dependencies: ['explore-monument'],
  },
  {
    key: 'explore-monument-translation',
    name: 'Explore Monument Translations',
    description: 'Import multilingual translations and further readings for Explore monuments',
    importerClass: ExploreMonumentTranslationImporter,
    dependencies: ['explore-monument'],
  },
  {
    key: 'explore-monument-crossref',
    name: 'Explore Monument Cross-References',
    description:
      'Import cross-schema item_item_links between Explore and mwnf3/travels/SH monuments',
    importerClass: ExploreMonumentCrossRefImporter,
    dependencies: ['explore-monument', 'monument', 'sh-monument', 'travels-monument'],
  },
  {
    key: 'explore-monument-theme-link',
    name: 'Explore Monument-Theme Links',
    description: 'Link Explore monuments to thematic cycle collections (collection_item pivot)',
    importerClass: ExploreMonumentThemeLinkImporter,
    dependencies: ['explore-monument', 'explore-thematiccycle'],
  },
  {
    key: 'explore-itinerary',
    name: 'Explore Itineraries',
    description: 'Import itineraries (curated routes) from Explore',
    importerClass: ExploreItineraryImporter,
    dependencies: ['explore-root-collections', 'explore-thematiccycle'],
  },
  {
    key: 'explore-itinerary-content',
    name: 'Explore Itinerary Content',
    description:
      'Import itinerary translations, monument links, metadata, old itineraries, and cross-schema links',
    importerClass: ExploreItineraryContentImporter,
    dependencies: ['explore-itinerary', 'explore-monument', 'explore-location'],
  },
  {
    key: 'explore-filter',
    name: 'Explore Filters',
    description: 'Import Explore filter tags and filter-monument links',
    importerClass: ExploreFilterImporter,
    dependencies: ['explore-monument'],
  },
  // Phase 07: Travels (virtual visits and exhibition trails)
  {
    key: 'travels-context',
    name: 'Travels Context',
    description: 'Create context for Travels application',
    importerClass: TravelsContextImporter,
    dependencies: [],
  },
  {
    key: 'travels-root-collection',
    name: 'Travels Root Collection',
    description: 'Create root collection for Travels',
    importerClass: TravelsRootCollectionImporter,
    dependencies: ['travels-context', 'language'],
  },
  {
    key: 'travels-trail',
    name: 'Travels Trails',
    description: 'Import trails (exhibition trails) from Travels database',
    importerClass: TravelsTrailImporter,
    dependencies: ['travels-root-collection', 'country'],
  },
  {
    key: 'travels-trail-translation',
    name: 'Travels Trail Translations',
    description: 'Import trail translations',
    importerClass: TravelsTrailTranslationImporter,
    dependencies: ['travels-trail', 'language'],
  },
  {
    key: 'travels-itinerary',
    name: 'Travels Itineraries',
    description: 'Import itineraries under trails',
    importerClass: TravelsItineraryImporter,
    dependencies: ['travels-trail'],
  },
  {
    key: 'travels-itinerary-translation',
    name: 'Travels Itinerary Translations',
    description: 'Import itinerary translations',
    importerClass: TravelsItineraryTranslationImporter,
    dependencies: ['travels-itinerary', 'language'],
  },
  {
    key: 'travels-location',
    name: 'Travels Locations',
    description: 'Import locations under itineraries',
    importerClass: TravelsLocationImporter,
    dependencies: ['travels-itinerary'],
  },
  {
    key: 'travels-location-translation',
    name: 'Travels Location Translations',
    description: 'Import location translations',
    importerClass: TravelsLocationTranslationImporter,
    dependencies: ['travels-location', 'language'],
  },
  {
    key: 'travels-monument',
    name: 'Travels Monuments',
    description: 'Import travel-specific monument items',
    importerClass: TravelsMonumentImporter,
    dependencies: ['travels-location', 'country'],
  },
  {
    key: 'travels-monument-translation',
    name: 'Travels Monument Translations',
    description: 'Import travel monument translations',
    importerClass: TravelsMonumentTranslationImporter,
    dependencies: ['travels-monument', 'language'],
  },
  // Phase 07: Travels Pictures
  {
    key: 'travels-trail-picture',
    name: 'Travels Trail Pictures',
    description: 'Import trail pictures (covers, maps, titles)',
    importerClass: TravelsTrailPictureImporter,
    dependencies: ['travels-trail'],
  },
  {
    key: 'travels-itinerary-picture',
    name: 'Travels Itinerary Pictures',
    description: 'Import itinerary pictures (sketches)',
    importerClass: TravelsItineraryPictureImporter,
    dependencies: ['travels-itinerary'],
  },
  {
    key: 'travels-location-picture',
    name: 'Travels Location Pictures',
    description: 'Import location pictures',
    importerClass: TravelsLocationPictureImporter,
    dependencies: ['travels-location'],
  },
  {
    key: 'travels-monument-picture',
    name: 'Travels Monument Pictures',
    description: 'Import travel monument pictures',
    importerClass: TravelsMonumentPictureImporter,
    dependencies: ['travels-monument'],
  },
  // Phase 10: Thematic Galleries (runs last, after all other legacy DBs are imported)
  {
    key: 'thg-gallery-context',
    name: 'THG Gallery Contexts',
    description: 'Create contexts for thematic galleries/exhibitions',
    importerClass: ThgGalleryContextImporter,
    dependencies: [],
  },
  {
    key: 'thg-root-collections',
    name: 'THG Root Collections',
    description: 'Create root collections for Galleries and Exhibitions',
    importerClass: ThgRootCollectionsImporter,
    dependencies: ['default-context', 'language'],
  },
  {
    key: 'thg-gallery',
    name: 'THG Galleries',
    description: 'Import thematic galleries as collections',
    importerClass: ThgGalleryImporter,
    dependencies: ['thg-gallery-context', 'thg-root-collections'],
  },
  {
    key: 'thg-gallery-translation',
    name: 'THG Gallery Translations',
    description:
      'Import thematic gallery translations (exhibition_i18n — exhibition-specific extra data)',
    importerClass: ThgGalleryTranslationImporter,
    dependencies: ['thg-gallery', 'language'],
  },
  {
    key: 'thg-gallery-lang',
    name: 'THG Gallery Lang',
    description: 'Import base gallery/exhibition translations from thg_gallery_lang',
    importerClass: ThgGalleryLangImporter,
    dependencies: ['thg-gallery', 'thg-gallery-context', 'language'],
  },
  {
    key: 'thg-theme',
    name: 'THG Themes',
    description: 'Import thematic gallery themes as child collections',
    importerClass: ThgThemeImporter,
    dependencies: ['thg-gallery', 'thg-gallery-context'],
  },
  {
    key: 'thg-theme-translation',
    name: 'THG Theme Translations',
    description: 'Import thematic gallery theme translations as collection translations',
    importerClass: ThgThemeTranslationImporter,
    dependencies: ['thg-theme', 'thg-gallery-context', 'language'],
  },
  {
    key: 'thg-theme-item',
    name: 'THG Theme Items',
    description: 'Attach items to theme collections (all legacy DBs)',
    importerClass: ThgThemeItemImporter,
    // Every picture family the resolver supports has to be listed here, because
    // a theme item is resolved to a PICTURE child and a picture that does not
    // exist yet is silently skipped — the row is never retried.
    //
    // The list used to name only the six mwnf3/SH item importers and to leave
    // out the Explore and Travels picture families, even though
    // thg-theme-item-resolver.ts resolves both. That happened to work for most
    // rows because the registry order runs Explore before the THG phase, but it
    // was not guaranteed and it did not hold: the 2026-08-28 full import lost
    // exactly the five Explore-monument selections of gallery 47 (themes 1, 5
    // and 15), which the exhibition needs — legacy shows 194 curated pictures,
    // the import produced 189. Re-running this importer alone afterwards
    // imported all 1,284 rows with zero skips, which is what "ordering, not
    // resolution" looks like. See museumwithnofrontiers/inventory-app#1546.
    dependencies: [
      'thg-theme',
      'object',
      'monument',
      'monument-detail',
      'sh-object',
      'sh-monument',
      'sh-monument-detail',
      'explore-monument-picture',
      'travels-monument-picture',
    ],
  },
  {
    key: 'thg-theme-item-translation',
    name: 'THG Theme Item Translations',
    description: 'Import contextual item descriptions and image captions for thematic galleries',
    importerClass: ThgThemeItemTranslationImporter,
    dependencies: ['thg-theme-item', 'thg-gallery-context', 'language'],
  },
  {
    key: 'thg-theme-cover-image',
    name: 'THG Theme Cover Images',
    description: 'Mark which selected picture is the cover of each exhibition theme',
    importerClass: ThgThemeCoverImageImporter,
    dependencies: ['thg-theme', 'thg-theme-item'],
  },
  {
    key: 'thg-item-related',
    name: 'THG Item Relations',
    description: 'Import item-to-item links within thematic galleries',
    importerClass: ThgItemRelatedImporter,
    dependencies: ['thg-theme-item', 'thg-gallery-context'],
  },
  {
    key: 'thg-item-related-translation',
    name: 'THG Item Relation Translations',
    description: 'Import translations for item-to-item links',
    importerClass: ThgItemRelatedTranslationImporter,
    dependencies: ['thg-item-related', 'language'],
  },
  // Phase 10: Gallery-Item Link Importers (direct links from thg_gallery to items)
  {
    key: 'thg-gallery-native-project',
    name: 'THG Gallery Native Project Items',
    description:
      "Attach the items of each gallery's native mwnf3 project to its collection (legacy union membership)",
    importerClass: ThgGalleryNativeProjectImporter,
    dependencies: ['thg-gallery', 'object', 'monument'],
  },
  {
    key: 'thg-gallery-mwnf3-object',
    name: 'THG Gallery MWNF3 Objects',
    description: 'Link mwnf3 objects to THG gallery collections',
    importerClass: ThgGalleryMwnf3ObjectImporter,
    dependencies: ['thg-gallery', 'object'],
  },
  {
    key: 'thg-gallery-mwnf3-monument',
    name: 'THG Gallery MWNF3 Monuments',
    description: 'Link mwnf3 monuments to THG gallery collections',
    importerClass: ThgGalleryMwnf3MonumentImporter,
    dependencies: ['thg-gallery', 'monument'],
  },
  {
    key: 'thg-gallery-sh-object',
    name: 'THG Gallery SH Objects',
    description: 'Link Sharing History objects to THG gallery collections',
    importerClass: ThgGalleryShObjectImporter,
    dependencies: ['thg-gallery', 'sh-object'],
  },
  {
    key: 'thg-gallery-sh-monument',
    name: 'THG Gallery SH Monuments',
    description: 'Link Sharing History monuments to THG gallery collections',
    importerClass: ThgGalleryShMonumentImporter,
    dependencies: ['thg-gallery', 'sh-monument'],
  },
  {
    key: 'thg-gallery-travel-monument',
    name: 'THG Gallery Travel Monuments',
    description: 'Link travel monuments to THG gallery collections',
    importerClass: ThgGalleryTravelMonumentImporter,
    dependencies: ['thg-gallery', 'travels-monument'],
  },
  {
    key: 'thg-gallery-explore-monument',
    name: 'THG Gallery Explore Monuments',
    description: 'Link Explore monuments to THG gallery collections',
    importerClass: ThgGalleryExploreMonumentImporter,
    dependencies: ['thg-gallery', 'explore-monument'],
  },
  // Phase 11: Collection Media (needs THG theme collections)
  {
    key: 'collection-media',
    name: 'Collection Media',
    description: 'Import audio/video URLs attached to THG theme collections',
    importerClass: CollectionMediaImporter,
    dependencies: ['thg-theme', 'language'],
  },
  // Phase 10: THG Contributors
  {
    key: 'thg-contributor',
    name: 'THG Contributors',
    description: 'Import THG contributor rows as Contributor entities',
    importerClass: ThgContributorImporter,
    dependencies: ['default-context', 'language', 'thg-gallery', 'thg-theme'],
  },
  // Phase 10: THG Tags (curated gallery tags + item-tag links)
  {
    key: 'thg-tag',
    name: 'THG Tags',
    description:
      'Import 2,629 curated gallery tags with dedup, and 27,543 item-tag links across mwnf3 and SH objects',
    importerClass: ThgTagImporter,
    dependencies: ['object', 'monument', 'sh-object', 'sh-monument', 'thg-gallery'],
  },
  // Phase 10: THG Timelines (exhibition/gallery HCR timeline events)
  {
    key: 'thg-timeline',
    name: 'THG Timelines',
    description: 'Import THG exhibition timelines and events from mwnf3_thematic_gallery.hcr',
    importerClass: ThgTimelineImporter,
    dependencies: ['thg-gallery', 'language'],
  },
  // Phase 10: THG Gallery Content (exhibition logos + related content)
  {
    key: 'thg-gallery-content',
    name: 'THG Gallery Content',
    description:
      'Import exhibition logos as collection images and related content as collection media',
    importerClass: ThgGalleryContentImporter,
    dependencies: ['thg-gallery', 'language'],
  },
  // Phase 10: THG Exhibition partner-page exclusions
  {
    key: 'thg-hidden-museum',
    name: 'THG Hidden Museums',
    description:
      'Import the museums curators suppressed from an exhibition\'s partner pages',
    importerClass: ThgHiddenMuseumImporter,
    dependencies: ['thg-gallery', 'partner'],
  },
  // Phase 11: Post-Import Linking
  {
    key: 'partner-monument-link',
    name: 'Partner Monument Link',
    description: 'Link partners (museums) to their monument locations',
    importerClass: PartnerMonumentLinker,
    dependencies: ['partner', 'monument'],
  },
  {
    key: 'project-exhibition-root-keying',
    name: 'Project Exhibition Root Keying',
    description:
      'Create per-project Virtual Exhibitions root collections (non-ISL) and re-parent their exhibitions',
    importerClass: ProjectExhibitionRootKeyingImporter,
    dependencies: ['project', 'mwnf3-exhibition'],
  },
  {
    key: 'sh-exhibition-root-keying',
    name: 'SH Exhibition Root Keying',
    description:
      'Create per-project Virtual Exhibitions root collections for Sharing History and re-parent their exhibitions (#1464)',
    importerClass: ShExhibitionRootKeyingImporter,
    dependencies: ['sh-project', 'sh-exhibition'],
  },
  {
    key: 'sh-exhibition-show-flag',
    name: 'SH Exhibition Show Flag',
    description:
      'Stamp legacy sh_exhibitions.show into collection_translations.extra.legacy_exhibition for SH exhibitions',
    importerClass: ShExhibitionShowFlagImporter,
    dependencies: ['sh-exhibition', 'sh-exhibition-translation'],
  },
  {
    key: 'sh-item-display-status',
    name: 'SH Item Display Status',
    description:
      "Stamp legacy display_status='N' (HB/HCR-only items) into item_translations.extra for SH objects/monuments",
    importerClass: ShItemDisplayStatusImporter,
    dependencies: ['sh-object', 'sh-monument'],
  },
  {
    key: 'sh-exhibition-item-justifications',
    name: 'SH Exhibition Item Justifications',
    description:
      'Merge SH theme/subtheme justification texts and curator_status into collection_item.extra',
    importerClass: ShExhibitionItemJustificationsImporter,
    dependencies: ['sh-exhibition', 'sh-exhibition-item'],
  },
  {
    key: 'sh-partner-project-linker',
    name: 'SH Partner Project Linker',
    description:
      'Attach SH partners to their project collection via collection_partner with flat tier levels',
    importerClass: ShPartnerProjectLinkerImporter,
    dependencies: ['sh-project', 'sh-partner'],
  },
  {
    key: 'sh-hb-general',
    name: 'SH General Historical Background',
    description:
      'Import the SH project-level Historical Background module (perspective pages + Read-more topics) as collections (#1498)',
    importerClass: ShHbGeneralImporter,
    dependencies: ['sh-project'],
  },
  {
    key: 'sh-hb-recontext',
    name: 'SH HB Recontext',
    description:
      "Move SH Historical Background collections (and their pages) into their legacy project's context (#1494)",
    importerClass: ShHbRecontextImporter,
    dependencies: ['sh-project', 'sh-bibliography-hb'],
  },
  {
    key: 'sh-historical-profiles-root',
    name: 'SH Historical Profiles Root Keying',
    description:
      'Create per-project Historical Profiles root collections for Sharing History and re-parent the HB record collections under them (#1505)',
    importerClass: ShHistoricalProfilesRootImporter,
    dependencies: ['sh-project', 'sh-bibliography-hb', 'sh-hb-recontext'],
  },
  // Runs late on purpose. Beyond creating author entities and CVs, this importer
  // resolves the legacy author junction tables onto item_translations and
  // dynasty_translations, so every item and dynasty it credits must already
  // exist — that includes dynasties, SH objects/monuments and THG items, all of
  // which are imported well after the mwnf3 objects and monuments.
  {
    key: 'author',
    name: 'Authors',
    description:
      'Import structured authors with name parts, CVs, and author-item/dynasty assignments from mwnf3, SH, THG',
    importerClass: AuthorImporter,
    dependencies: [
      'project',
      'object',
      'monument',
      'dynasty',
      'sh-object',
      'sh-monument',
      'default-context',
      'language',
    ],
  },
  {
    key: 'collection-purpose-backfill',
    name: 'Collection Purpose Backfill',
    description:
      'Backfill collections.purpose from known marker backward_compatibility keyspaces on an already-populated database (#1505)',
    importerClass: CollectionPurposeBackfillImporter,
  },
  {
    key: 'extra-bit-buffer-backfill',
    name: 'Extra Bit-Buffer Backfill',
    description:
      'Normalise serialized mysql2 bit(1) Buffers left in collection_translations.extra to JSON booleans on an already-populated database',
    importerClass: ExtraBitBufferBackfillImporter,
    dependencies: ['thg-gallery-translation', 'thg-gallery-lang'],
  },
  {
    key: 'museum-project-link-backfill',
    name: 'Museum Project Link Backfill',
    description:
      'Backfill partners.project_id from mwnf3.museums.project_id on an already-populated database, so gallery exporters can reproduce legacy MWNF-384',
    importerClass: MuseumProjectLinkBackfillImporter,
    dependencies: ['project', 'partner'],
  },
  {
    key: 'exhibition-i18n-text-backfill',
    name: 'Exhibition i18n Text Backfill',
    description:
      'Backfill exhibition_i18n subtitle/heading/about into collection_translations.extra on an already-populated database, so exhibition exporters can render the three separately',
    importerClass: ExhibitionI18nTextBackfillImporter,
    dependencies: ['thg-gallery-translation'],
  },
  {
    key: 'exhibition-logo-extra-backfill',
    name: 'Exhibition Logo Extra Backfill',
    description:
      'Backfill sponsor-logo link/category/visibility/captions into collection_images.extra and attach the image-type:logo tag on an already-populated database (#1592)',
    importerClass: ExhibitionLogoExtraBackfillImporter,
    dependencies: ['thg-gallery-content'],
  },
  {
    key: 'explore-monument-country-backfill',
    name: 'Explore Monument Country Backfill',
    description:
      'Backfill items.country_id on natively-imported Explore monuments from mwnf3_explore.locations.countryId, where it is still null (#1593)',
    importerClass: ExploreMonumentCountryBackfillImporter,
    dependencies: ['explore-monument'],
  },
  {
    key: 'project-cleanup',
    name: 'Project Cleanup',
    description: 'Remove projects that have no Items (post-import cleanup)',
    importerClass: ProjectCleanupImporter,
    dependencies: ['item-item-link'],
  },
];

// Ceiling on how long a single in-flight query can take before we treat the
// connection as dead. Needed because of a real gotcha with mysql2: attaching
// our own 'error' listener to a Connection (below) means that when the
// socket dies mid-query, the error can be fully consumed by that listener
// without ever rejecting the specific pending query's own promise — so
// `await connection.execute(...)` just hangs forever, and the retry loops
// below never get a chance to run at all (confirmed in practice: a legacy DB
// connection drop mid-query left the importer hung indefinitely at 0% CPU,
// with no further log output, during a `stage` run against the real legacy
// DB). Racing every execute() against this timeout turns that silent hang
// into a retryable error instead.
const QUERY_TIMEOUT_MS = 30000;

function withQueryTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${QUERY_TIMEOUT_MS}ms (connection likely dead)`));
    }, QUERY_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}

/**
 * Simple Legacy Database wrapper with automatic reconnection
 */
class LegacyDatabase implements ILegacyDatabase {
  private connection: mysql.Connection | null = null;
  private config: mysql.ConnectionOptions;
  private reconnecting = false;

  constructor() {
    this.config = {
      host: process.env['LEGACY_DB_HOST'] || 'localhost',
      port: parseInt(process.env['LEGACY_DB_PORT'] || '3306', 10),
      user: process.env['LEGACY_DB_USER'] || 'root',
      password: process.env['LEGACY_DB_PASSWORD'] || '',
      database: process.env['LEGACY_DB_DATABASE'] || 'mwnf3',
      multipleStatements: false, // Disabled for security - use single queries
      connectTimeout: 60000, // 60 second connection timeout
      enableKeepAlive: true, // Enable TCP keep-alive
      keepAliveInitialDelay: 10000, // 10 seconds
    };
  }

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection(this.config);

    // Handle connection errors
    this.connection.on('error', (err: Error & { code?: string }) => {
      console.error('[LegacyDatabase] Connection error:', err.message);
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        this.reconnect().catch((reconnectErr) =>
          console.error('[LegacyDatabase] Reconnect failed:', reconnectErr)
        );
      }
    });
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting) return;

    this.reconnecting = true;
    console.log('[LegacyDatabase] Connection lost, attempting to reconnect...');

    try {
      if (this.connection) {
        try {
          await this.connection.end();
        } catch {
          // Ignore errors when closing dead connection
        }
        this.connection = null;
      }

      await this.connect();
      console.log('[LegacyDatabase] Reconnected successfully');
    } finally {
      this.reconnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.connection) {
          await this.connect();
        }

        if (!this.connection) {
          throw new Error('Failed to establish connection');
        }

        const [rows] = params
          ? await withQueryTimeout(
              this.connection.execute(sql, params as (string | number | null)[]),
              '[LegacyDatabase] query'
            )
          : await withQueryTimeout(this.connection.execute(sql), '[LegacyDatabase] query');
        return rows as T[];
      } catch (err) {
        const error = err as Error & { code?: string };
        lastError = error;
        const isConnectionError =
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ECONNRESET' ||
          error.message?.includes('connection is in closed state') ||
          error.message?.includes('connection likely dead');

        if (isConnectionError && attempt < maxRetries) {
          console.log(
            `[LegacyDatabase] Connection error on attempt ${attempt}/${maxRetries}, retrying in ${attempt * 2}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          await this.reconnect();
        } else if (!isConnectionError) {
          // Not a connection error, throw immediately
          throw err;
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.connection) {
          await this.connect();
        }

        if (!this.connection) {
          throw new Error('Failed to establish connection');
        }

        if (params) {
          await withQueryTimeout(
            this.connection.execute(sql, params as (string | number | null)[]),
            '[LegacyDatabase] execute'
          );
        } else {
          await withQueryTimeout(this.connection.execute(sql), '[LegacyDatabase] execute');
        }
        return;
      } catch (err) {
        const error = err as Error & { code?: string };
        lastError = error;
        const isConnectionError =
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ECONNRESET' ||
          error.message?.includes('connection is in closed state') ||
          error.message?.includes('connection likely dead');

        if (isConnectionError && attempt < maxRetries) {
          console.log(
            `[LegacyDatabase] Connection error on attempt ${attempt}/${maxRetries}, retrying in ${attempt * 2}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          await this.reconnect();
        } else if (!isConnectionError) {
          // Not a connection error, throw immediately
          throw err;
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
  }
}

/**
 * Resilient database connection wrapper with automatic reconnection
 */
class ResilientConnection {
  private connection: mysql.Connection | null = null;
  private config: mysql.ConnectionOptions;
  private reconnecting = false;

  constructor(config: mysql.ConnectionOptions) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection(this.config);

    // Handle connection errors
    this.connection.on('error', (err: Error & { code?: string }) => {
      console.error('[ResilientConnection] Connection error:', err.message);
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        this.reconnect().catch((reconnectErr) =>
          console.error('[ResilientConnection] Reconnect failed:', reconnectErr)
        );
      }
    });
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting) return;

    this.reconnecting = true;
    console.log('[ResilientConnection] Connection lost, attempting to reconnect...');

    try {
      if (this.connection) {
        try {
          await this.connection.end();
        } catch {
          // Ignore errors when closing dead connection
        }
      }

      await this.connect();
      console.log('[ResilientConnection] Reconnected successfully');
    } finally {
      this.reconnecting = false;
    }
  }

  async execute<
    T extends
      | mysql.RowDataPacket[]
      | mysql.RowDataPacket[][]
      | mysql.OkPacket
      | mysql.OkPacket[]
      | mysql.ResultSetHeader,
  >(sql: string, values?: unknown): Promise<[T, mysql.FieldPacket[]]> {
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.connection) {
          await this.connect();
        }

        if (!this.connection) {
          throw new Error('Failed to establish connection');
        }

        return await withQueryTimeout(
          this.connection.execute<T>(sql, values as (string | number | null)[] | undefined),
          '[ResilientConnection] execute'
        );
      } catch (err) {
        const error = err as Error & { code?: string };
        lastError = error;
        const isConnectionError =
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ECONNRESET' ||
          error.message?.includes('connection is in closed state') ||
          error.message?.includes('connection likely dead');

        if (isConnectionError && attempt < maxRetries) {
          console.log(
            `[ResilientConnection] Connection error on attempt ${attempt}/${maxRetries}, retrying in ${attempt * 2}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          await this.reconnect();
        } else if (!isConnectionError) {
          // Not a connection error, throw immediately
          throw err;
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  async end(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async beginTransaction(): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }
    await this.connection!.beginTransaction();
  }

  async commit(): Promise<void> {
    await this.connection!.commit();
  }

  async rollback(): Promise<void> {
    await this.connection!.rollback();
  }

  getConnection(): mysql.Connection {
    if (!this.connection) {
      throw new Error('Connection not established');
    }
    return this.connection;
  }
}

/**
 * Create connection to new database
 */
async function createNewDbConnection(): Promise<ResilientConnection> {
  const resilientConn = new ResilientConnection({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '3306', 10),
    user: process.env['DB_USERNAME'] || 'root',
    password: process.env['DB_PASSWORD'] || '',
    database: process.env['DB_DATABASE'] || 'inventory',
  });

  await resilientConn.connect();
  return resilientConn;
}

/**
 * Determine if an importer should run
 */
function shouldRunImporter(
  config: ImporterConfig,
  only: string | undefined,
  startAt: string | undefined,
  stopAt: string | undefined
): boolean {
  if (only) {
    return config.key === only;
  }

  const importerIndex = ALL_IMPORTERS.findIndex((i) => i.key === config.key);

  if (startAt) {
    const startIndex = ALL_IMPORTERS.findIndex((i) => i.key === startAt);
    if (startIndex === -1) {
      throw new Error(`Unknown importer: ${startAt}`);
    }
    if (importerIndex < startIndex) {
      return false;
    }
  }

  if (stopAt) {
    const stopIndex = ALL_IMPORTERS.findIndex((i) => i.key === stopAt);
    if (stopIndex === -1) {
      throw new Error(`Unknown importer: ${stopAt}`);
    }
    if (importerIndex > stopIndex) {
      return false;
    }
  }

  return true;
}

// CLI
const program = new Command();

program
  .name('importer')
  .description('Unified Legacy Import Tool - Imports data from legacy database')
  .version('1.0.0');

program
  .command('import')
  .description('Run import process')
  .option('--dry-run', 'Simulate import without writing data', false)
  .option('--start-at <importer>', 'Start from specific importer')
  .option('--stop-at <importer>', 'Stop at specific importer')
  .option('--only <importer>', 'Run only the specified importer')
  .option('--list-importers', 'List all available importers')
  .action(async (options) => {
    // Initialize file logger
    const logger = new FileLogger('ImportCLI', 'logs');

    try {
      const dryRun = options.dryRun === true;
      const startAt = options.startAt;
      const stopAt = options.stopAt;
      const only = options.only;
      const listImporters = options.listImporters === true;

      // Handle --list-importers
      if (listImporters) {
        console.log(chalk.bold('\nAvailable Importers:\n'));
        ALL_IMPORTERS.forEach((imp, idx) => {
          console.log(
            `  ${(idx + 1).toString().padStart(2)}. ${imp.key.padEnd(22)} - ${imp.description}`
          );
        });
        console.log('\nUsage examples:');
        console.log('  npm run import                          # Run all importers');
        console.log('  npm run import -- --start-at project    # Start from project onwards');
        console.log('  npm run import -- --stop-at partner     # Run up to and including partner');
        console.log('  npm run import -- --only partner        # Run only partner');
        console.log('');
        process.exit(0);
      }

      console.log(chalk.bold('='.repeat(80)));
      console.log(chalk.bold.cyan('UNIFIED LEGACY IMPORT'));
      console.log(chalk.bold('='.repeat(80)));
      console.log(chalk.gray(`Start time: ${new Date().toISOString()}`));
      console.log(chalk.gray(`Log file: ${logger.getLogFilePath()}`));
      console.log(chalk.gray(`Dry-run: ${dryRun ? 'YES' : 'NO'}`));
      if (startAt) console.log(chalk.gray(`Start at: ${startAt}`));
      if (stopAt) console.log(chalk.gray(`Stop at: ${stopAt}`));
      if (only) console.log(chalk.gray(`Only: ${only}`));
      console.log('');

      logger.info(
        `Import started with options: dryRun=${dryRun}, startAt=${startAt || 'none'}, stopAt=${stopAt || 'none'}, only=${only || 'none'}`
      );

      // Connect to databases
      console.log(chalk.cyan('Connecting to databases...'));
      const legacyDb = new LegacyDatabase();
      await legacyDb.connect();
      console.log(chalk.green('✓ Legacy database connected'));
      logger.info('Legacy database connected');

      const newDb = await createNewDbConnection();
      console.log(chalk.green('✓ New database connected'));
      logger.info('New database connected');

      // Initialize tracker and strategy
      const tracker = new UnifiedTracker();
      const strategy = new SqlWriteStrategy(newDb, tracker);

      // Create import context
      const importContext: ImportContext = {
        legacyDb,
        strategy,
        tracker,
        logger,
        dryRun,
      };

      // Track results
      const results = new Map<string, ImportResult>();
      const importerTimings = new Map<string, number>();

      const selectedImporters = ALL_IMPORTERS.filter((config) => {
        const shouldRun = shouldRunImporter(config, only, startAt, stopAt);

        if (!shouldRun) {
          console.log(chalk.gray(`⏭  Skipping ${config.name}`));
          logger.info(`Skipping ${config.name}`);
        }

        return shouldRun;
      });

      const orderedImporters = orderConfigsByDependencies(selectedImporters);

      // Execute importers
      for (const config of orderedImporters) {
        logger.logImporterStart(config.name);
        const importerStart = Date.now();

        try {
          const importer = new config.importerClass(importContext);
          const result = await importer.import();
          results.set(config.key, result);

          const importerDuration = Date.now() - importerStart;
          importerTimings.set(config.key, importerDuration);

          logger.logImporterComplete(
            config.name,
            result.imported,
            result.skipped,
            result.errors.length,
            importerDuration
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const importerDuration = Date.now() - importerStart;
          importerTimings.set(config.key, importerDuration);
          logger.logImporterComplete(config.name, 0, 0, 1, importerDuration);
          logger.logImporterError(config.name, message);
          results.set(config.key, {
            success: false,
            imported: 0,
            skipped: 0,
            errors: [message],
            warnings: [],
          });
        }
      }

      // Build per-importer summaries for final report
      const summaries: PhaseSummary[] = [];
      for (const config of orderedImporters) {
        const result = results.get(config.key);
        if (!result) continue; // was skipped
        const duration = importerTimings.get(config.key) ?? 0;
        if (result.imported > 0 || result.skipped > 0 || result.errors.length > 0) {
          summaries.push({
            phase: config.name,
            duration,
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors.length,
          });
        }
      }

      // Calculate totals
      const totals = Array.from(results.values()).reduce(
        (acc, r) => ({
          imported: acc.imported + r.imported,
          skipped: acc.skipped + r.skipped,
          errors: acc.errors + r.errors.length,
          warnings: acc.warnings + (r.warnings?.length || 0),
        }),
        { imported: 0, skipped: 0, errors: 0, warnings: 0 }
      );

      // Log final summary (handles both console and file output)
      logger.logFinalSummary(summaries);

      // Cleanup
      logger.info('Disconnecting from databases...');
      await legacyDb.disconnect();
      await newDb.end();
      logger.info('Import process ended');

      if (totals.errors > 0) {
        process.exit(1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) {
        logger.exception('Fatal error', error);
      } else {
        logger.error('Fatal error', message);
      }
      console.error(chalk.red(`\nFatal error: ${message}`));
      if (error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate database connections')
  .action(async () => {
    console.log(chalk.cyan('Validating connections...\n'));

    let hasErrors = false;

    // Legacy database
    try {
      console.log('Testing legacy database connection...');
      const legacyDb = new LegacyDatabase();
      await legacyDb.connect();
      console.log(chalk.green('✓ Legacy database connection successful'));
      await legacyDb.disconnect();
    } catch (error) {
      hasErrors = true;
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`❌ Legacy database connection failed: ${message}`));
    }

    // New database
    try {
      console.log('Testing new database connection...');
      const newDb = await createNewDbConnection();
      console.log(chalk.green('✓ New database connection successful'));
      await newDb.end();
    } catch (error) {
      hasErrors = true;
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`❌ New database connection failed: ${message}`));
    }

    if (hasErrors) {
      console.log(chalk.red('\n❌ Validation failed. Fix errors above before importing.'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✓ All connections validated successfully.'));
    }
  });

program
  .command('image-sync')
  .description(
    'Synchronize legacy images to new storage (images with size=1 placeholder across all image tables)'
  )
  .option('--copy', 'Copy files instead of symbolic links', false)
  .option('--clear-destination', 'Clear destination image folder before synchronization', false)
  .option('--dry-run', 'Simulate synchronization without making changes', false)
  .option(
    '--target-dir <path>',
    'Target image directory (overrides NEW_IMAGES_ROOT env var and artisan fallback)'
  )
  .action(async (options) => {
    const logger = new FileLogger('ImageSync', 'logs');

    try {
      const useSymlink = options.copy !== true;
      const clearDestination = options.clearDestination === true;
      const dryRun = options.dryRun === true;

      console.log(chalk.bold('='.repeat(80)));
      console.log(chalk.bold.cyan('IMAGE SYNCHRONIZATION'));
      console.log(chalk.bold('='.repeat(80)));
      console.log(chalk.gray(`Start time: ${new Date().toISOString()}`));
      console.log(chalk.gray(`Log file: ${logger.getLogFilePath()}`));
      console.log(chalk.gray(`Mode: ${useSymlink ? 'SYMLINK' : 'COPY'}`));
      console.log(chalk.gray(`Clear destination: ${clearDestination ? 'YES' : 'NO'}`));
      console.log(chalk.gray(`Dry-run: ${dryRun ? 'YES' : 'NO'}`));
      console.log('');

      logger.info(
        `Image sync started with options: symlink=${useSymlink}, clearDestination=${clearDestination}, dryRun=${dryRun}`
      );

      // Get configuration
      const legacyImagesRoot =
        process.env['LEGACY_IMAGES_ROOT'] || 'C:\\mwnf-server\\pictures\\images';

      // Get new images root: prefer CLI option, then env var, fall back to
      // Laravel's private originals directory (see image-target-dir.ts)
      const { path: newImagesRoot, source: newImagesRootSource } = await resolveImageTargetDir({
        targetDir: options.targetDir as string | undefined,
        env: process.env,
        runArtisan: async (command) => {
          console.log(
            chalk.cyan('NEW_IMAGES_ROOT not set, getting image storage path from Laravel...')
          );
          logger.info(`NEW_IMAGES_ROOT not set, falling back to ${command}`);
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const { stdout } = await promisify(exec)(command, {
            cwd: resolve(process.cwd(), '../..'),
          });
          return stdout;
        },
      });
      const newImagesRootLabel = {
        option: '--target-dir',
        env: 'NEW_IMAGES_ROOT',
        artisan: 'artisan',
      }[newImagesRootSource];
      console.log(
        chalk.green(`✓ Image storage path (from ${newImagesRootLabel}): ${newImagesRoot}`)
      );
      logger.info(`Image storage path (from ${newImagesRootLabel}): ${newImagesRoot}`);

      // Connect to database
      console.log(chalk.cyan('Connecting to database...'));
      const newDb = await createNewDbConnection();
      console.log(chalk.green('✓ Database connected'));
      logger.info('Database connected');

      // Create and run image sync tool
      const tool = new ImageSyncTool(
        newDb.getConnection(),
        {
          useSymlink,
          legacyImagesRoot,
          newImagesRoot,
          clearDestination,
          dryRun,
        },
        logger
      );

      const result = await tool.run();

      // Cleanup
      await newDb.end();
      console.log(chalk.green('\n✓ Database disconnected'));

      // Final summary
      console.log('');
      console.log(chalk.bold('='.repeat(80)));
      if (result.success) {
        console.log(chalk.bold.green('IMAGE SYNC COMPLETED SUCCESSFULLY'));
        console.log(chalk.gray(`End time: ${new Date().toISOString()}`));
        console.log(chalk.green(`✓ ${result.imported} images synchronized`));
        console.log(chalk.yellow(`⊘ ${result.skipped} images skipped`));
      } else {
        console.log(chalk.bold.red('IMAGE SYNC COMPLETED WITH ERRORS'));
        console.log(chalk.gray(`End time: ${new Date().toISOString()}`));
        console.log(chalk.green(`✓ ${result.imported} images synchronized`));
        console.log(chalk.yellow(`⊘ ${result.skipped} images skipped`));
        console.log(chalk.red(`✗ ${result.errors.length} errors`));
        console.log('');
        // Log all errors to file, show first 10 on console
        for (const err of result.errors) {
          logger.error('ImageSync', err);
        }
        console.log(chalk.red('Errors:'));
        result.errors.slice(0, 10).forEach((err) => console.log(chalk.red(`  - ${err}`)));
        if (result.errors.length > 10) {
          console.log(
            chalk.red(`  ... and ${result.errors.length - 10} more (see log file for full list)`)
          );
        }
      }
      console.log(chalk.bold('='.repeat(80)));

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) {
        logger.exception('ImageSync', error);
      } else {
        logger.error('ImageSync', message);
      }
      console.log(chalk.red(`\n❌ Image sync failed: ${message}`));
      console.log(chalk.red(error instanceof Error ? error.stack : ''));
      process.exit(1);
    }
  });

program.parse();
