/**
 * Phase 07 Importers - Travels Data
 *
 * Imports virtual visit and exhibition trail data from the mwnf3_travels legacy database.
 * This includes:
 * - Trails (exhibition trails organized by project and country)
 * - Itineraries (routes within trails)
 * - Locations (places within itineraries)
 * - Travel-specific monuments (items within locations)
 *
 * Collection Hierarchy:
 * - "Travels" (root) → Trail (exhibition trail) → Itinerary → Location → Monuments (items)
 *
 * Note: Travel monuments are distinct from mwnf3.monuments - they are travel-specific
 * content items with their own titles and translations in each language.
 */

export { TravelsContextImporter } from './travels-context-importer.js';
export { TravelsRootCollectionImporter } from './travels-root-collection-importer.js';
export { TravelsTrailImporter } from './travels-trail-importer.js';
export { TravelsTrailTranslationImporter } from './travels-trail-translation-importer.js';
export { TravelsItineraryImporter } from './travels-itinerary-importer.js';
export { TravelsItineraryTranslationImporter } from './travels-itinerary-translation-importer.js';
export { TravelsLocationImporter } from './travels-location-importer.js';
export { TravelsLocationTranslationImporter } from './travels-location-translation-importer.js';
export { TravelsMonumentImporter } from './travels-monument-importer.js';
export { TravelsMonumentTranslationImporter } from './travels-monument-translation-importer.js';

// Picture Importers
export { TravelsTrailPictureImporter } from './travels-trail-picture-importer.js';
export { TravelsItineraryPictureImporter } from './travels-itinerary-picture-importer.js';
export { TravelsLocationPictureImporter } from './travels-location-picture-importer.js';
export { TravelsMonumentPictureImporter } from './travels-monument-picture-importer.js';

// Relations
export { TravelsTrailEntryImporter } from './travels-trail-entry-importer.js';
export { TravelsTrailPartnerImporter } from './travels-trail-partner-importer.js';
