/**
 * Phase 12 Importers - Publications (legacy "books", mwnf3.bookbase / mwnf3.books)
 *
 * Runs after every other phase: publications point to the Travels trails
 * (phase 07) and their entries, to mwnf3 items (phase 01) and to Explore's
 * Travel Books (phase 06). project-cleanup runs after it, so a project that
 * only a publication refers to is kept.
 */

export { PublicationImporter } from './publication-importer.js';
export {
  PublicationTranslationImporter,
  PublicationEditionImporter,
} from './publication-edition-importer.js';
export {
  PublicationTagImporter,
  PublicationCollectionImporter,
  PublicationItemImporter,
  PublicationExploreLinkImporter,
} from './publication-relation-importer.js';
export { PublicationImageImporter } from './publication-image-importer.js';
