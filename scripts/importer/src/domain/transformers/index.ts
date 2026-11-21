/**
 * Transformers Module Exports
 */

export {
  transformProject,
  transformProjectTranslation,
  type TransformedProjectBundle,
  type TransformedProjectTranslationBundle,
} from './project-transformer.js';

export {
  transformMuseum,
  transformMuseumTranslation,
  groupMuseumsByKey,
  type TransformedMuseum,
  type TransformedMuseumTranslation,
  type MuseumGroup,
  type MuseumExtraFields,
  type MuseumMonumentReference,
  type ContactPerson,
} from './museum-transformer.js';

export {
  transformInstitution,
  transformInstitutionTranslation,
  groupInstitutionsByKey,
  type TransformedInstitution,
  type TransformedInstitutionTranslation,
  type InstitutionGroup,
  type InstitutionExtraFields,
  type ContactPerson as InstitutionContactPerson,
} from './institution-transformer.js';

export {
  groupObjectsByPK,
  transformObject,
  transformObjectTranslation,
  extractObjectTags,
  parseTagString,
  planTranslations,
  type TransformedObject,
  type TransformedObjectTranslation,
  type ExtractedTags,
  type TranslationPlan,
} from './object-transformer.js';

export {
  groupMonumentsByPK,
  transformMonument,
  transformMonumentTranslation,
  extractMonumentTags,
  planMonumentTranslations,
  type TransformedMonument,
  type TransformedMonumentTranslation,
  type ExtractedMonumentTags,
  type MonumentTranslationPlan,
} from './monument-transformer.js';

export {
  groupMonumentDetailsByPK,
  isBlankMonumentDetailGroup,
  transformMonumentDetail,
  transformMonumentDetailTranslation,
  type TransformedMonumentDetail,
  type TransformedMonumentDetailTranslation,
} from './monument-detail-transformer.js';

// Sharing History (SH) Transformers
export {
  formatShBackwardCompatibility,
  transformShProject,
  transformShProjectTranslation,
  type TransformedShProjectBundle,
  type TransformedShProjectTranslationBundle,
} from './sh-project-transformer.js';

export {
  transformShPartner,
  transformShPartnerTranslation,
  groupShPartnersByKey,
  type TransformedShPartner,
  type TransformedShPartnerTranslation,
  type ShPartnerGroup,
  type ShPartnerExtraFields,
} from './sh-partner-transformer.js';

export {
  groupShObjectsByPK,
  transformShObject,
  transformShObjectTranslation,
  type TransformedShObject,
  type TransformedShObjectTranslation,
} from './sh-object-transformer.js';

export {
  groupShMonumentsByPK,
  transformShMonument,
  transformShMonumentTranslation,
  type TransformedShMonument,
  type TransformedShMonumentTranslation,
} from './sh-monument-transformer.js';

export {
  groupShMonumentDetailsByPK,
  transformShMonumentDetail,
  transformShMonumentDetailTranslation,
  type TransformedShMonumentDetail,
  type TransformedShMonumentDetailTranslation,
} from './sh-monument-detail-transformer.js';

export {
  transformDynasty,
  transformDynastyTranslation,
  type TransformedDynasty,
  type TransformedDynastyTranslation,
} from './dynasty-transformer.js';

export {
  transformAuthor,
  transformAuthorCv,
  transformShAuthorCv,
  type TransformedAuthor,
  type TransformedAuthorTranslation,
} from './author-transformer.js';

export {
  transformHcrEvent,
  transformHcrEventTranslation,
  transformShHcrEvent,
  transformShHcrEventTranslation,
  type TransformedTimelineEvent,
  type TransformedTimelineEventTranslation,
} from './timeline-transformer.js';

export {
  transformObjectVideo,
  transformShObjectVideoAudio,
  transformThgThemeMedia,
  transformShObjectDocument,
  type TransformedItemMedia,
  type TransformedCollectionMedia,
  type TransformedItemDocument,
} from './media-transformer.js';

export {
  transformSchool,
  transformSchoolTranslation,
  groupSchoolsByKey,
  type TransformedSchool,
  type TransformedSchoolTranslation,
  type SchoolGroup,
  type SchoolExtraFields,
  type ContactPerson as SchoolContactPerson,
} from './school-transformer.js';
