/**
 * Legacy Data Types
 *
 * These types represent the structure of data in the legacy database.
 * They are used as input to transformers.
 */

// ============================================================================
// Language Types
// ============================================================================

export interface LegacyLanguage {
  code: string;
  name: string;
  active?: number | boolean;
}

export interface LegacyLanguageName {
  code: string;
  lang: string;
  name: string;
}

// ============================================================================
// Country Types
// ============================================================================

export interface LegacyCountry {
  code: string;
  name: string;
}

export interface LegacyCountryName {
  code: string;
  lang: string;
  name: string;
}

// ============================================================================
// Project Types
// ============================================================================

export interface LegacyProject {
  project_id: string;
  name?: string;
  launchdate?: Date | string | null;
  active?: number | boolean;
}

export interface LegacyProjectName {
  project_id: string;
  lang: string;
  name: string;
  description?: string;
}

// ============================================================================
// Museum Types
// ============================================================================

export interface LegacyMuseum {
  museum_id: string;
  country: string;
  name: string;
  city?: string;
  address?: string;
  postal_address?: string;
  // Monument location reference (museum is located in this monument)
  mon_project_id?: string | null;
  mon_country_id?: string | null;
  mon_institution_id?: string | null;
  mon_monument_id?: number | null;
  mon_lang_id?: string | null;
  // Connected museum reference
  con_museum_id?: string | null;
  con_country_id?: string | null;
  // Contact information
  phone?: string;
  fax?: string;
  email?: string;
  email2?: string;
  url?: string;
  url2?: string;
  url3?: string;
  url4?: string;
  url5?: string;
  // URL titles
  title1?: string;
  title2?: string;
  title3?: string;
  title4?: string;
  title5?: string;
  // Logos
  logo?: string;
  logo1?: string;
  logo2?: string;
  logo3?: string;
  // Contact person 1
  cp1_name?: string;
  cp1_title?: string;
  cp1_phone?: string;
  cp1_fax?: string;
  cp1_email?: string;
  // Contact person 2
  cp2_name?: string;
  cp2_title?: string;
  cp2_phone?: string;
  cp2_fax?: string;
  cp2_email?: string;
  // Other
  project_id: string;
  region_id?: string;
  geoCoordinates?: string;
  zoom?: string;
  portal_display?: string;
}

export interface LegacyMuseumName {
  museum_id: string;
  country: string;
  lang: string;
  name: string;
  ex_name?: string;
  city?: string;
  description?: string;
  ex_description?: string;
  how_to_reach?: string;
  opening_hours?: string;
}

// ============================================================================
// Institution Types
// ============================================================================

export interface LegacyInstitution {
  institution_id: string;
  country: string;
  name: string;
  city?: string;
  address?: string;
  description?: string;
  phone?: string;
  fax?: string;
  email?: string;
  url?: string;
  url2?: string;
  // Contact person 1
  cp1_name?: string;
  cp1_title?: string;
  cp1_phone?: string;
  cp1_fax?: string;
  cp1_email?: string;
  // Contact person 2
  cp2_name?: string;
  cp2_title?: string;
  cp2_phone?: string;
  cp2_fax?: string;
  cp2_email?: string;
  // Other
  region_id?: string;
  // Logos
  logo?: string;
  logo1?: string;
  logo2?: string;
}

export interface LegacyInstitutionName {
  institution_id: string;
  country: string;
  lang: string;
  name: string;
  description?: string;
}

// ============================================================================
// School Types
// ============================================================================

export interface LegacySchool {
  school_id: string;
  country: string;
  name: string;
  city?: string;
  address?: string;
  postal_address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  url?: string;
  // Contact person 1
  cp1_name?: string;
  cp1_title?: string;
  cp1_phone?: string;
  cp1_fax?: string;
  cp1_email?: string;
  // Contact person 2
  cp2_name?: string;
  cp2_title?: string;
  cp2_phone?: string;
  cp2_fax?: string;
  cp2_email?: string;
  // Other
  project_id: string;
  region_id?: string;
  // Logo
  logo?: string;
}

export interface LegacySchoolName {
  school_id: string;
  country: string;
  lang: string;
  name: string;
  description?: string;
}

export interface LegacySchoolPicture {
  school_id: string;
  country: string;
  image_number: number;
  path: string;
  caption?: string;
  photographer?: string;
  copyright?: string;
}

// ============================================================================
// Object Types
// ============================================================================

export interface LegacyObject {
  project_id: string;
  country: string;
  museum_id: string;
  number: string;
  lang: string;
  working_number?: string;
  inventory_id?: string;
  name?: string;
  name2?: string;
  typeof?: string;
  holding_museum?: string;
  location?: string;
  province?: string;
  date_description?: string;
  start_date?: string | null;
  end_date?: string | null;
  dynasty?: string;
  current_owner?: string;
  original_owner?: string;
  provenance?: string;
  dimensions?: string;
  materials?: string;
  artist?: string;
  birthdate?: string;
  birthplace?: string;
  deathdate?: string;
  deathplace?: string;
  period_activity?: string;
  production_place?: string;
  workshop?: string;
  description?: string;
  description2?: string;
  datationmethod?: string;
  provenancemethod?: string;
  obtentionmethod?: string;
  bibliography?: string;
  keywords?: string;
  preparedby?: string;
  copyeditedby?: string;
  translationby?: string;
  translationcopyeditedby?: string;
  copyright?: string;
  // The rights statement legacy actually renders. `copyright` is declared on
  // both tables but has never been filled; `notice_b` carries "Copyright image:
  // <institution>" and is per-language, so it belongs on the translation.
  notice_b?: string | null;
  binding_desc?: string;
  linkcatalogs?: string | null;
  catalogue_holding_link?: string | null;
  scriber?: string | null;
}

export interface ObjectGroup {
  project_id: string;
  country: string;
  museum_id: string;
  number: string;
  translations: LegacyObject[];
}

// ============================================================================
// Monument Types
// ============================================================================

export interface LegacyMonument {
  project_id: string;
  country: string;
  institution_id: string;
  number: string;
  lang: string;
  working_number?: string;
  inventory_id?: string;
  name?: string;
  name2?: string;
  typeof?: string;
  location?: string;
  province?: string;
  date_description?: string;
  current_owner?: string;
  original_owner?: string;
  description?: string;
  description2?: string;
  datationmethod?: string;
  bibliography?: string;
  keywords?: string;
  preparedby?: string;
  copyeditedby?: string;
  translationby?: string;
  translationcopyeditedby?: string;
  linkcatalogs?: string | null;
  external_sources?: string | null; // Date fields
  start_date?: string | null;
  end_date?: string | null; // Contact fields
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  institution?: string | null;
  // Extra descriptive fields
  patrons?: string | null;
  architects?: string | null;
  history?: string | null;
  dynasty?: string | null;
  // Rights statement — see the same pair on LegacyObject.
  copyright?: string | null;
  notice_b?: string | null;
}

export interface MonumentGroup {
  project_id: string;
  country: string;
  institution_id: string;
  number: string;
  translations: LegacyMonument[];
}

// ============================================================================
// Monument Detail Types
// ============================================================================

export interface LegacyMonumentDetail {
  project_id: string;
  country_id: string;
  institution_id: string;
  monument_id: string;
  lang_id: string;
  detail_id: string;
  name?: string;
  description?: string;
  location?: string;
  date?: string;
  artist?: string;
}

export interface MonumentDetailGroup {
  project_id: string;
  country_id: string;
  institution_id: string;
  monument_id: string;
  detail_id: string;
  translations: LegacyMonumentDetail[];
}

// ============================================================================
// Picture Types
// ============================================================================

export interface LegacyObjectPicture {
  project_id: string;
  country: string;
  museum_id: string;
  number: number;
  lang: string;
  type: string;
  image_number: number;
  path: string;
  caption?: string;
  photographer?: string;
  copyright?: string;
}

export interface LegacyMonumentPicture {
  project_id: string;
  country: string;
  institution_id: string;
  number: number;
  lang: string;
  type: string;
  image_number: number;
  path: string;
  caption?: string;
  photographer?: string;
  copyright?: string;
}

export interface LegacyMonumentDetailPicture {
  project_id: string;
  country_id: string;
  institution_id: string;
  monument_id: number;
  lang_id: string;
  detail_id: number;
  picture_id: number;
  path: string;
  caption?: string;
  photographer?: string;
  copyright?: string;
}

export interface LegacyMuseumPicture {
  museum_id: string;
  country: string;
  image_number: number;
  path: string;
  caption?: string;
  photographer?: string;
  copyright?: string;
}

export interface LegacyInstitutionPicture {
  institution_id: string;
  country: string;
  image_number: number;
  path: string;
  caption?: string;
  photographer?: string;
  copyright?: string;
}

// ============================================================================
// Dynasty Types
// ============================================================================

export interface LegacyDynasty {
  dynasty_id: number;
  from_ah?: number | null;
  to_ah?: number | null;
  from_ad?: number | null;
  to_ad?: number | null;
}

export interface LegacyDynastyText {
  dynasty_id: number;
  lang_id: string;
  name?: string | null;
  name2?: string | null;
  area?: string | null;
  history?: string | null;
  datedesc_ah?: string | null;
  datedesc_ad?: string | null;
}

export interface LegacyObjectDynasty {
  project_id: string;
  country: string;
  museum_id: string;
  number: string;
  dynasty_id: number;
}

export interface LegacyMonumentDynasty {
  project_id: string;
  country: string;
  institution_id: string;
  number: string;
  dynasty_id: number;
}

// ============================================================================
// Author Types
// ============================================================================

export interface LegacyAuthor {
  author_id: number;
  lastname?: string | null;
  givenname?: string | null;
  firstname?: string | null;
  originalname?: string | null;
}

export interface LegacyAuthorCv {
  author_id: number;
  project_id: string;
  lang_id: string;
  curriculum?: string | null;
}

export interface LegacyShAuthorCv {
  author_id: number;
  project_id: string;
  lang: string;
  curriculum?: string | null;
}

export interface LegacyAllAuthorMapping {
  author_id: number;
  all_author_id: number;
}

// mwnf3 junction tables use *_id column names (country_id, museum_id, object_id,
// lang_id) and key objects by a numeric object_id. This differs from mwnf3.objects
// itself, which uses country/number/lang — and from the SH tables below, which use
// the unsuffixed names. Keep these declarations aligned with the legacy DDL in
// .legacy-database/ddl/creation/: a mismatch silently yields undefined lookup keys.
export interface LegacyAuthorObject {
  project_id: string;
  country_id: string;
  museum_id: string;
  object_id: number;
  author_id: number;
  type: string;
  lang_id: string;
  priority?: number | null;
}

export interface LegacyAuthorMonument {
  project_id: string;
  country_id: string;
  institution_id: string;
  monument_id: number;
  author_id: number;
  type: string;
  lang_id: string;
  priority?: number | null;
}

// Unlike mwnf3's authors_objects/authors_monuments, the SH junction tables
// carry no museum/institution column — items are keyed project:country:number.
export interface LegacyShAuthorObject {
  project_id: string;
  country: string;
  number: string;
  author_id: number;
  type: string;
  lang: string;
  priority?: number | null;
}

export interface LegacyShAuthorMonument {
  project_id: string;
  country: string;
  number: string;
  author_id: number;
  type: string;
  lang: string;
  priority?: number | null;
}

// No priority column: authors_dynasties is keyed (dynasty_id, lang_id,
// author_id, type) only. Do not add one — ordering by it is a SQL error.
export interface LegacyAuthorDynasty {
  dynasty_id: number;
  author_id: number;
  type: string;
  lang_id: string;
}

// ============================================================================
// HCR (Heritage Conservation Resources) Types — mwnf3
// ============================================================================

export interface LegacyHcr {
  hcr_id: number;
  country_id: string; // 2-char legacy country code
  name: string;
  from_ad: number;
  to_ad: number;
  from_ah: number | null;
  to_ah: number | null;
}

export interface LegacyHcrEvent {
  hcr_id: number;
  lang_id: string; // 2-char legacy language code
  name: string;
  description: string | null;
  datedesc_ah: string | null;
  datedesc_ad: string | null;
}

// ============================================================================
// Audio/Video Types — mwnf3
// ============================================================================

/**
 * mwnf3.objects_video (21 rows) / mwnf3.monuments_video (1 row)
 * PK: (lang, number, museum_id, country, project_id, video_id)
 */
export interface LegacyObjectVideo {
  video_id: number;
  project_id: string;
  country: string; // 2-char
  museum_id: string;
  number: number;
  lang: string; // 2-char
  video_title: string;
  video_description: string | null;
  video_url: string;
}

/**
 * mwnf3_sharing_history.sh_objects_video_audio (2 rows)
 * PK: id (auto-increment)
 */
export interface ShLegacyObjectVideoAudio {
  id: number;
  project_id: string;
  country: string; // 2-char
  number: number;
  type: 'video' | 'audio';
  path: string; // YouTube video ID or full URL
  title: string;
}

// ============================================================================
// Document Types — Sharing History
// ============================================================================

/**
 * mwnf3_sharing_history.sh_objects_document (23 rows)
 * UNIQUE: (project_id, country, number, lang, img_count)
 */
export interface ShLegacyObjectDocument {
  project_id: string;
  country: string; // 2-char
  number: number;
  lang: string; // 2-char
  path: string; // server-relative path to PDF
  type: 'pdf';
  img_count: number; // page/sequence counter
}

// ============================================================================
// THG Audio/Video Types — mwnf3_thematic_gallery
// ============================================================================

/**
 * exhibition_audio (5 rows) / exhibition_video (12 rows)
 * PK: (audio_id/video_id, gallery_id, lang)
 */
export interface ThgLegacyExhibitionMedia {
  media_id: number; // audio_id or video_id in the raw table
  gallery_id: number;
  lang: string; // 2-char
  title: string;
  description: string;
  url: string;
}

/**
 * theme_audio (2 rows) / theme_video (16 rows)
 * Junction: assigns exhibition-level media to themes
 */
export interface ThgLegacyThemeMedia {
  media_id: number; // audio_id or video_id
  gallery_id: number;
  theme_id: number;
  overview_page: 'Y' | 'N';
  sort_order: number;
}

// ============================================================================
// THG Contributor Types — mwnf3_thematic_gallery
// ============================================================================

/**
 * contributor (9 rows) — per-gallery/theme contributor records
 * PK: contributor_id
 */
export interface ThgLegacyContributor {
  contributor_id: number;
  gallery_id: number;
  theme_id: number;
  category_id: string;
  context: string; // display name
  src: string; // logo image path
  href: string; // link URL
  alt: string; // alt text
  display_order: number;
}

/**
 * contributor_category (4 rows) — category labels
 * PK: category_id
 */
export interface ThgLegacyContributorCategory {
  category_id: string;
  label: string; // e.g. 'In cooperation with', 'On the occasion of', 'Main contributors', 'With the support of'
}

/**
 * contributor_i18n (8 rows) — translations of contributor display name
 * PK: (contributor_id, language_id)
 */
export interface ThgLegacyContributorI18n {
  contributor_id: number;
  language_id: string; // 2-char
  context: string; // translated display name
}

/**
 * exhibition_partner (4 rows) — per-gallery partner acknowledgements
 * PK: partner_id
 */
export interface ThgLegacyExhibitionPartner {
  partner_id: number;
  gallery_id: number;
  category_id: number;
  entity_name: string;
  entity_location: string;
  entity_country: string; // 2-char
  contact_title?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_fax?: string;
  logo: string; // logo image path
  display_order: number;
  visible: string; // enum 'Y'/'N'
}

/**
 * exhibition_partner_i18n (4 rows) — translations
 * PK: (partner_id, language_id)
 */
export interface ThgLegacyExhibitionPartnerI18n {
  partner_id: number;
  language_id: string; // 2-char
  description: string;
  further_reading: string;
}

// ============================================================================
// THG Gallery Lang Types — mwnf3_thematic_gallery
// ============================================================================

/**
 * thg_gallery_lang — base gallery/exhibition translations
 * PK: (gallery_id, lang)
 * Covers ALL galleries and exhibitions.
 */
export interface ThgLegacyGalleryLang {
  gallery_id: number;
  lang: string; // 2-char language code
  title: string | null;
  subtitle: string | null;
  description: string | null;
}

// ============================================================================
// THG Exhibition Content Types — mwnf3_thematic_gallery
// ============================================================================

/**
 * exhibition_logo — logos for exhibitions
 * PK: (logo_id)
 */
export interface ThgLegacyExhibitionLogo {
  logo_id: number;
  gallery_id: number;
  path: string; // server-relative image path
  display_order: number | null;
}

/**
 * exhibition_related_content — related media/document links for exhibitions
 * PK: (content_id)
 */
export interface ThgLegacyExhibitionRelatedContent {
  content_id: number;
  gallery_id: number;
  type: string; // e.g. 'pdf', 'audio', 'video', or media type hint
  url: string;
  display_order: number | null;
}

/**
 * exhibition_related_content_i18n — translations for related content
 * PK: (content_id, lang)
 */
export interface ThgLegacyExhibitionRelatedContentI18n {
  content_id: number;
  lang: string; // 2-char
  title: string | null;
  description: string | null;
}

// ============================================================================
// THG Tag Types — mwnf3_thematic_gallery
// ============================================================================

/**
 * thg_tag_types (category labels) — PK: type_id (varchar 20)
 * Values: material, artist, dynasty, subject, type
 */
export interface ThgLegacyTagType {
  type_id: string;
  description: string | null;
}

/**
 * thg_tags (2,629 rows) — curated gallery tags
 * PK: tag_id (varchar 20 — the tag name itself)
 * FK: type_id → thg_tag_types
 */
export interface ThgLegacyTag {
  tag_id: string;
  type_id: string;
  description: string | null;
}

/**
 * thg_objects_mwnf3_tags (20,406 rows) — links THG tags to mwnf3 objects
 * PK: (tag_id, objects_project_id, objects_country, objects_museum_id, objects_number)
 */
export interface ThgLegacyObjectMwnf3Tag {
  tag_id: string;
  objects_project_id: string;
  objects_country: string;
  objects_museum_id: string;
  objects_number: number;
}

/**
 * thg_objects_sh_tags (7,137 rows) — links THG tags to SH objects
 * PK: (tag_id, sh_objects_project_id, sh_objects_country, sh_objects_number)
 */
export interface ThgLegacyObjectShTag {
  tag_id: string;
  sh_objects_project_id: string;
  sh_objects_country: string;
  sh_objects_number: number;
}

// ============================================================================
// mwnf3 Exhibition Types (Legacy Exhibition / Artintro System)
// ============================================================================

/**
 * exhibitions (27 rows) — Root exhibition records
 */
export interface Mwnf3LegacyExhibition {
  exhibition_id: number;
  project_id: string;
  name: string;
  n: number | null;
  show: 'y' | 'n';
  new_status: string | null;
  portal_image: string | null;
  exh_link: string | null;
}

/**
 * exhibition_themes (~171 rows) — Themes within exhibitions
 */
export interface Mwnf3LegacyExhibitionTheme {
  theme_id: number;
  exhibition_id: number;
  name: string;
  n: number | null;
}

/**
 * exhibition_pages (200+ rows) — Pages within themes
 */
export interface Mwnf3LegacyExhibitionPage {
  page_id: number;
  theme_id: number;
  n: number | null;
  remark: string | null;
}

/**
 * EAV field row — shared pattern for exhibition_fields, exhibition_theme_fields,
 * exhibition_page_fields, exhibition_page_images_fields, exhibition_page_image_details_fields,
 * artintro_fields, artintro_theme_fields, artintro_page_fields
 */
export interface Mwnf3LegacyEavField {
  entity_id: number;
  lang_id: string; // 2-char
  field: string;
  value: string;
}

/**
 * exhibition_page_images (2,394 rows) — Images on pages, may reference items
 */
export interface Mwnf3LegacyExhibitionPageImage {
  image_id: number;
  page_id: number;
  n: number;
  n2: number;
  ref_item: string; // 'O;ISL;jo;1;8' or empty for custom images
  picture: string;
}

/**
 * exhibition_page_image_details (281 rows) — Detail annotations on page images
 */
export interface Mwnf3LegacyExhibitionPageImageDetail {
  detail_id: number;
  image_id: number;
  n: number;
  n2: number;
  /** 'BAR;it;11;9;3': project;country;institution;monument;detail, a monument_details row. */
  ref_detail_item: string;
  picture_details: string;
}

/**
 * exhibition_images (94 rows) — Exhibition-level images (banners)
 */
export interface Mwnf3LegacyExhibitionLevelImage {
  image_id: number;
  exhibition_id: number;
  n: number;
  n2: number;
  ref_item: string;
  picture: string;
}

/**
 * artintros (1 row) — Art introduction root
 */
export interface Mwnf3LegacyArtintro {
  artintro_id: number;
  project_id: string;
  name: string;
}

/**
 * artintro_themes (10 rows) — Artintro themes
 */
export interface Mwnf3LegacyArtintroTheme {
  theme_id: number;
  artintro_id: number;
  name: string;
  n: number | null;
}

/**
 * artintro_pages (19 rows) — Artintro pages
 */
export interface Mwnf3LegacyArtintroPage {
  page_id: number;
  theme_id: number;
  n: number | null;
  remark: string | null;
}

/**
 * artintro_page_images (158 rows) — all item references (no custom)
 */
export interface Mwnf3LegacyArtintroPageImage {
  image_id: number;
  page_id: number;
  n: number;
  n2: number;
  ref_item: string;
  picture: string;
}
