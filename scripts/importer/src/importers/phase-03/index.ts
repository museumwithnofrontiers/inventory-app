/**
 * Phase 03 Importers - Sharing History Data
 *
 * Imports data from the mwnf3_sharing_history legacy database.
 * Creates:
 * - Contexts, Collections, Projects for each SH project
 * - Partners (reusing mwnf3 partners where possible via mapping)
 * - Objects, Monuments, Monument Details as Items
 * - Pictures for all item types
 * - Logos for partners
 * - Exhibition hierarchy (exhibitions, themes, subthemes) as nested Collections
 * - Exhibition translations
 * - Exhibition item assignments (rel_* tables) and image references
 */

export { ShProjectImporter } from './sh-project-importer.js';
export { ShPartnerImporter } from './sh-partner-importer.js';
export { ShPartnerLogoImporter } from './sh-partner-logo-importer.js';
export { ShPartnerPictureImporter } from './sh-partner-picture-importer.js';
export { ShObjectImporter } from './sh-object-importer.js';
export { ShMonumentImporter } from './sh-monument-importer.js';
export { ShMonumentDetailImporter } from './sh-monument-detail-importer.js';
export { ShObjectPictureImporter } from './sh-object-picture-importer.js';
export { ShMonumentPictureImporter } from './sh-monument-picture-importer.js';
export { ShMonumentDetailPictureImporter } from './sh-monument-detail-picture-importer.js';
export { ShExhibitionImporter } from './sh-exhibition-importer.js';
export { ShExhibitionTranslationImporter } from './sh-exhibition-translation-importer.js';
export { ShExhibitionImageImporter } from './sh-exhibition-image-importer.js';
export { ShExhibitionItemImporter } from './sh-exhibition-item-importer.js';
export { ShNationalContextImporter } from './sh-national-context-importer.js';
export { ShBibliographyHbImporter } from './sh-bibliography-hb-importer.js';
