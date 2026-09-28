/**
 * Importers Module Index
 */

// Phase 00: Reference Data
export { DefaultContextImporter } from './phase-00/index.js';
export { LanguageImporter, LanguageTranslationImporter } from './phase-00/index.js';
export { CountryImporter, CountryTranslationImporter } from './phase-00/index.js';

// Phase 01: Core Data
export { ProjectImporter } from './phase-01/index.js';
export { PartnerImporter } from './phase-01/index.js';
export { ObjectImporter } from './phase-01/index.js';
export { MonumentImporter } from './phase-01/index.js';
export { MonumentDetailImporter } from './phase-01/index.js';
export { ItemItemLinkImporter } from './phase-01/index.js';
export { DynastyImporter } from './phase-01/index.js';
export { AuthorImporter } from './phase-01/index.js';
export { SchoolImporter } from './phase-01/index.js';
export { PartnerHierarchyImporter } from './phase-01/index.js';
export { InstitutionHierarchyImporter } from './phase-01/index.js';
export { ArtintroRootCollectionImporter } from './phase-01/index.js';
export { ExhibitionsRootCollectionImporter } from './phase-01/index.js';
export { Mwnf3ExhibitionImporter } from './phase-01/index.js';
export { Mwnf3ExhibitionTranslationImporter } from './phase-01/index.js';
export { Mwnf3ExhibitionItemImporter } from './phase-01/index.js';

// Phase 02: Images
export { ObjectPictureImporter } from './phase-02/index.js';
export { MonumentPictureImporter } from './phase-02/index.js';
export { MonumentDetailPictureImporter } from './phase-02/index.js';
export { PartnerPictureImporter } from './phase-02/index.js';
export { PartnerLogoImporter } from './phase-02/index.js';

// Phase 03: Sharing History Data
export {
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
  ShNationalContextImporter,
  ShBibliographyHbImporter,
} from './phase-03/index.js';

// Phase 04: Glossary & THG Contributors
export {
  GlossaryImporter,
  GlossaryTranslationImporter,
  GlossarySpellingImporter,
} from './phase-04/index.js';
export { ThgContributorImporter } from './phase-04/index.js';

// Phase 10: Thematic Galleries (runs last, after all other legacy DBs are imported)
export {
  ThgGalleryContextImporter,
  ThgRootCollectionsImporter,
  ThgGalleryImporter,
  ThgGalleryTranslationImporter,
  ThgThemeImporter,
  ThgThemeTranslationImporter,
  ThgThemeItemImporter,
  ThgThemeItemTranslationImporter,
  ThgThemeCoverImageImporter,
  ThgItemRelatedImporter,
  ThgItemRelatedTranslationImporter,
  // Gallery-Item Link Importers
  ThgGalleryNativeProjectImporter,
  ThgGalleryMwnf3ObjectImporter,
  ThgGalleryMwnf3MonumentImporter,
  ThgGalleryShObjectImporter,
  ThgGalleryShMonumentImporter,
  ThgGalleryTravelMonumentImporter,
  ThgGalleryExploreMonumentImporter,
  // THG Tags
  ThgTagImporter,
  // THG Gallery Lang (base translations)
  ThgGalleryLangImporter,
  // THG Timelines
  ThgTimelineImporter,
  // THG Gallery Content (logos, related content)
  ThgGalleryContentImporter,
  // THG Exhibition partner-page exclusions
  ThgHiddenMuseumImporter,
} from './phase-10/index.js';
// Phase 05: Timelines
export { TimelineImporter } from './phase-05/index.js';
// Phase 06: Explore
export {
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
  ExploreHomeImporter,
  ExploreTravelImporter,
} from './phase-06/index.js';

// Phase 07: Travels
export {
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
  // Picture Importers
  TravelsTrailPictureImporter,
  TravelsItineraryPictureImporter,
  TravelsLocationPictureImporter,
  TravelsMonumentPictureImporter,
} from './phase-07/index.js';

// Phase 08: Media & Documents
export { ItemMediaImporter, ItemDocumentImporter } from './phase-08/index.js';

// Phase 11: Post-Import Linking (runs after all data is imported)
export {
  PartnerMonumentLinker,
  ProjectCleanupImporter,
  CollectionMediaImporter,
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
} from './phase-11/index.js';
