/**
 * THG Theme Item Resolver
 *
 * Shared resolver that maps a theme_item legacy row to the backward-compatibility
 * key of the selected child picture item.
 *
 * Each supported source family resolves to the picture item that was imported by
 * the corresponding picture importer (phase-02 / phase-03), NOT to the parent
 * object, monument, or detail item.
 *
 * Target key formats:
 * - mwnf3 object   → mwnf3:objects_pictures:{project}:{country}:{partner}:{item}:{image}[:{type}]
 * - mwnf3 monument → mwnf3:monuments_pictures:{project}:{country}:{partner}:{item}:{image}[:{type}]
 * - mwnf3 detail   → mwnf3:monument_detail_pictures:{project}:{country}:{partner}:{item}:{detail}:{image}
 * - SH object      → mwnf3_sharing_history:sh_object_images:{project}:{country}:{item}:{type|_}:{image}
 * - SH monument    → mwnf3_sharing_history:sh_monument_images:{project}:{country}:{item}:{type|_}:{image}
 * - SH detail      → mwnf3_sharing_history:sh_monument_detail_pictures:{project}:{country}:{item}:{detail}:{image}
 * - Explore mon.   → mwnf3_explore:monument_picture:{monument}:{type|_}:{image}
 * - Travels mon.   → mwnf3_travels:monument_picture:{project}:{country}:{trail}:{itinerary}:{location}:{number}:{type|_}:{image}
 * - Explore mon. showing a picture borrowed from the record it points to (MWNF-635, explore_monument_source_*):
 *   the Travels, mwnf3 monument or SH monument picture key above, built from the source key; null for a museum.
 *
 * The trailing `[:{type}]` on the two mwnf3 picture families is appended only when
 * the legacy type is non-empty — see withPictureType() below.
 *
 * Casing (#1534). SH keys are lowercased because formatShBackwardCompatibility
 * normalizes every string part, so an SH key has exactly one spelling. The mwnf3,
 * Explore and Travels families instead carry the legacy value **verbatim**, because
 * their picture importers do the same and the legacy source tables are not
 * internally consistent: as imported on 2026-08-26, mwnf3.monuments_pictures holds
 * both `isl` (2 335 rows) and `ISL` (8), monument_detail_pictures both `BAR` (1 732)
 * and `bar` (51), and mwnf3_travels both `IAM` (1 055) and `iam` (776). No single
 * casing rule here could match all of them byte-for-byte, so do NOT "normalize"
 * these branches — lowercasing them would break every uppercase-stored row.
 *
 * What makes the verbatim spelling safe is that both lookup layers match keys
 * case-insensitively, by construction rather than by luck: UnifiedTracker lowercases
 * the key on register/set/get (core/tracker.ts), and the fallback query in
 * SqlWriteStrategy.findByBackwardCompatibility runs against a utf8mb4_unicode_ci
 * column. Keys that differ only by case therefore denote the same entity — verified
 * on the full import: zero case-variant collisions across items and collections.
 *
 * Missing picture items must be treated as explicit skips with warnings by the
 * calling importer — do not fall back to the parent item key.
 *
 * Every theme_item row in the legacy data belongs to exactly one of these
 * families, so a null return means the row carries no usable reference at all.
 */

/**
 * Legacy theme_item row with both parent-item columns and image-identity columns.
 * Only columns required by the resolver are declared here; callers may extend
 * this type with additional fields (e.g. gallery_id, theme_id).
 */
export interface LegacyThemeItem {
  // mwnf3 object references
  mwnf3_object_project_id: string | null;
  mwnf3_object_country_id: string | null;
  mwnf3_object_partner_id: string | null;
  mwnf3_object_item_id: number | null;
  mwnf3_object_item_type: string | null;
  mwnf3_object_image_id: number | null;
  // mwnf3 monument references
  mwnf3_monument_project_id: string | null;
  mwnf3_monument_country_id: string | null;
  mwnf3_monument_partner_id: string | null;
  mwnf3_monument_item_id: number | null;
  mwnf3_monument_item_type: string | null;
  mwnf3_monument_image_id: number | null;
  // mwnf3 monument detail references
  mwnf3_monument_detail_project_id: string | null;
  mwnf3_monument_detail_country_id: string | null;
  mwnf3_monument_detail_partner_id: string | null;
  mwnf3_monument_detail_item_id: number | null;
  mwnf3_monument_detail_detail_id: number | null;
  mwnf3_monument_detail_image_id: number | null;
  // SH (Sharing History) object references
  sh_object_project_id: string | null;
  sh_object_country_id: string | null;
  sh_object_item_id: number | null;
  sh_object_item_type: string | null;
  sh_object_image_id: number | null;
  // SH monument references
  sh_monument_project_id: string | null;
  sh_monument_country_id: string | null;
  sh_monument_item_id: number | null;
  sh_monument_item_type: string | null;
  sh_monument_image_id: number | null;
  // SH monument detail references
  sh_monument_detail_project_id: string | null;
  sh_monument_detail_country_id: string | null;
  sh_monument_detail_item_id: number | null;
  sh_monument_detail_detail_id: number | null;
  sh_monument_detail_image_id: number | null;
  // THG Explore monument references (item_id is mwnf3_explore.exploremonument.monumentId)
  explore_monument_item_id: number | null;
  explore_monument_item_type: string | null;
  explore_monument_image_id: number | null;
  // MWNF-635: a picture borrowed from the record the Explore monument points to. Present only once the legacy
  // schema has the columns (see themeItemSelectColumns); explore_monument_item_type/_image_id are then null.
  explore_monument_source_type?: string | null;
  explore_monument_source_key?: string | null;
  explore_monument_source_item_type?: string | null;
  explore_monument_source_image_id?: number | null;
  // THG Travels monument references (item_id is the monument number, a string)
  travel_monument_project_id: string | null;
  travel_monument_country_id: string | null;
  travel_monument_trail_id: number | null;
  travel_monument_itinerary_id: string | null;
  travel_monument_location_id: string | null;
  travel_monument_item_id: string | null;
  travel_monument_item_type: string | null;
  travel_monument_image_id: number | null;
}

/**
 * SQL SELECT fragment for all columns required by LegacyThemeItem.
 * Append this to your query's SELECT list when loading theme_item rows.
 */
export const THEME_ITEM_SELECT_COLUMNS = `
  mwnf3_object_project_id, mwnf3_object_country_id, mwnf3_object_partner_id, mwnf3_object_item_id,
  mwnf3_object_item_type, mwnf3_object_image_id,
  mwnf3_monument_project_id, mwnf3_monument_country_id, mwnf3_monument_partner_id, mwnf3_monument_item_id,
  mwnf3_monument_item_type, mwnf3_monument_image_id,
  mwnf3_monument_detail_project_id, mwnf3_monument_detail_country_id, mwnf3_monument_detail_partner_id,
  mwnf3_monument_detail_item_id, mwnf3_monument_detail_detail_id, mwnf3_monument_detail_image_id,
  sh_object_project_id, sh_object_country_id, sh_object_item_id,
  sh_object_item_type, sh_object_image_id,
  sh_monument_project_id, sh_monument_country_id, sh_monument_item_id,
  sh_monument_item_type, sh_monument_image_id,
  sh_monument_detail_project_id, sh_monument_detail_country_id, sh_monument_detail_item_id,
  sh_monument_detail_detail_id, sh_monument_detail_image_id,
  explore_monument_item_id, explore_monument_item_type, explore_monument_image_id,
  travel_monument_project_id, travel_monument_country_id, travel_monument_trail_id,
  travel_monument_itinerary_id, travel_monument_location_id, travel_monument_item_id,
  travel_monument_item_type, travel_monument_image_id`.trim();

/** MWNF-635 borrowed-picture columns of theme_item, added by a legacy schema patch. */
export const THEME_ITEM_SOURCE_COLUMNS =
  'explore_monument_source_type, explore_monument_source_key, explore_monument_source_item_type, explore_monument_source_image_id';

/**
 * The SELECT fragment for theme_item rows: THEME_ITEM_SELECT_COLUMNS, plus the borrowed-picture columns when the
 * legacy schema has them. A mirror or dump taken before the MWNF-635 patch keeps importing unchanged.
 */
export async function themeItemSelectColumns(legacyDb: {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}): Promise<string> {
  const rows = await legacyDb.query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = 'mwnf3_thematic_gallery' AND table_name = 'theme_item'
       AND column_name = 'explore_monument_source_type'`
  );
  return Number(rows[0]?.n ?? 0) > 0
    ? `${THEME_ITEM_SELECT_COLUMNS},\n  ${THEME_ITEM_SOURCE_COLUMNS}`
    : THEME_ITEM_SELECT_COLUMNS;
}

/**
 * Append a non-empty picture `type` segment, mirroring the `pkValues.push(type)`
 * guard in ObjectPictureImporter and MonumentPictureImporter.
 *
 * Those two importers key a typed picture (`type='plan'`, `'detail'`, …) as
 * `…:{image_number}:{type}` and leave the default photo (`type=''`) untouched, so
 * that a typed picture sharing an image_number with the default photo gets its
 * own identity instead of colliding with it. A resolver that always omits the
 * segment does not merely miss those rows — it produces the *default* photo's key
 * and silently attaches the wrong picture.
 */
function withPictureType(key: string, type: string | null): string {
  return type && type.trim() !== '' ? `${key}:${type}` : key;
}

/**
 * Resolve a theme_item row to the backward-compatibility key of the selected
 * child picture item.
 *
 * Every source family present in the legacy data is covered, so null means the
 * row carries no usable picture reference at all — either no source columns or a
 * source whose image-identity columns are missing. The caller should warn and
 * skip; it must never fall back to the parent item key.
 */
export function resolvePictureItemBackwardCompatibility(legacy: LegacyThemeItem): string | null {
  // mwnf3 object picture
  // Matches ObjectPictureImporter: mwnf3:objects_pictures:{project}:{country}:{museum_id}:{number}:{image_number}[:{type}]
  if (
    legacy.mwnf3_object_project_id &&
    legacy.mwnf3_object_country_id &&
    legacy.mwnf3_object_partner_id &&
    legacy.mwnf3_object_item_id !== null &&
    legacy.mwnf3_object_image_id !== null
  ) {
    return withPictureType(
      `mwnf3:objects_pictures:${legacy.mwnf3_object_project_id}:${legacy.mwnf3_object_country_id}:${legacy.mwnf3_object_partner_id}:${legacy.mwnf3_object_item_id}:${legacy.mwnf3_object_image_id}`,
      legacy.mwnf3_object_item_type
    );
  }

  // mwnf3 monument picture
  // Matches MonumentPictureImporter: mwnf3:monuments_pictures:{project}:{country}:{institution_id}:{number}:{image_number}[:{type}]
  if (
    legacy.mwnf3_monument_project_id &&
    legacy.mwnf3_monument_country_id &&
    legacy.mwnf3_monument_partner_id &&
    legacy.mwnf3_monument_item_id !== null &&
    legacy.mwnf3_monument_image_id !== null
  ) {
    return withPictureType(
      `mwnf3:monuments_pictures:${legacy.mwnf3_monument_project_id}:${legacy.mwnf3_monument_country_id}:${legacy.mwnf3_monument_partner_id}:${legacy.mwnf3_monument_item_id}:${legacy.mwnf3_monument_image_id}`,
      legacy.mwnf3_monument_item_type
    );
  }

  // mwnf3 monument detail picture
  // Matches MonumentDetailPictureImporter: mwnf3:monument_detail_pictures:{project}:{country}:{institution}:{monument}:{detail}:{picture_id}
  if (
    legacy.mwnf3_monument_detail_project_id &&
    legacy.mwnf3_monument_detail_country_id &&
    legacy.mwnf3_monument_detail_partner_id &&
    legacy.mwnf3_monument_detail_item_id !== null &&
    legacy.mwnf3_monument_detail_detail_id !== null &&
    legacy.mwnf3_monument_detail_image_id !== null
  ) {
    return `mwnf3:monument_detail_pictures:${legacy.mwnf3_monument_detail_project_id}:${legacy.mwnf3_monument_detail_country_id}:${legacy.mwnf3_monument_detail_partner_id}:${legacy.mwnf3_monument_detail_item_id}:${legacy.mwnf3_monument_detail_detail_id}:${legacy.mwnf3_monument_detail_image_id}`;
  }

  // SH object picture
  // Matches ShObjectPictureImporter: mwnf3_sharing_history:sh_object_images:{project}:{country}:{number}:{type|_}:{image_number}
  // String parts are lowercased to match formatShBackwardCompatibility behaviour.
  if (
    legacy.sh_object_project_id &&
    legacy.sh_object_country_id &&
    legacy.sh_object_item_id !== null &&
    legacy.sh_object_image_id !== null
  ) {
    const project = legacy.sh_object_project_id.toLowerCase();
    const country = legacy.sh_object_country_id.toLowerCase();
    const type = legacy.sh_object_item_type ? legacy.sh_object_item_type.toLowerCase() : '_';
    return `mwnf3_sharing_history:sh_object_images:${project}:${country}:${legacy.sh_object_item_id}:${type}:${legacy.sh_object_image_id}`;
  }

  // SH monument picture
  // Matches ShMonumentPictureImporter: mwnf3_sharing_history:sh_monument_images:{project}:{country}:{number}:{type|_}:{image_number}
  if (
    legacy.sh_monument_project_id &&
    legacy.sh_monument_country_id &&
    legacy.sh_monument_item_id !== null &&
    legacy.sh_monument_image_id !== null
  ) {
    const project = legacy.sh_monument_project_id.toLowerCase();
    const country = legacy.sh_monument_country_id.toLowerCase();
    const type = legacy.sh_monument_item_type ? legacy.sh_monument_item_type.toLowerCase() : '_';
    return `mwnf3_sharing_history:sh_monument_images:${project}:${country}:${legacy.sh_monument_item_id}:${type}:${legacy.sh_monument_image_id}`;
  }

  // SH monument detail picture
  // Matches ShMonumentDetailPictureImporter: mwnf3_sharing_history:sh_monument_detail_pictures:{project}:{country}:{number}:{detail_id}:{picture_id}
  if (
    legacy.sh_monument_detail_project_id &&
    legacy.sh_monument_detail_country_id &&
    legacy.sh_monument_detail_item_id !== null &&
    legacy.sh_monument_detail_detail_id !== null &&
    legacy.sh_monument_detail_image_id !== null
  ) {
    const project = legacy.sh_monument_detail_project_id.toLowerCase();
    const country = legacy.sh_monument_detail_country_id.toLowerCase();
    return `mwnf3_sharing_history:sh_monument_detail_pictures:${project}:${country}:${legacy.sh_monument_detail_item_id}:${legacy.sh_monument_detail_detail_id}:${legacy.sh_monument_detail_image_id}`;
  }

  // MWNF-635 picture borrowed from the record an Explore monument points to. The key parts of
  // explore_monument_source_key are separated by ';' (travel: project;country;trail;itinerary;location;number,
  // monument: project;country;institution;number, sh_monument: project;country;number, museum: country;museum).
  // The placement links that record's picture item, the same item the Explore monument resolves to. Museum
  // pictures are partner images, not picture items, so a borrowed museum picture has no item to link (null).
  if (
    legacy.explore_monument_item_id !== null &&
    legacy.explore_monument_source_type &&
    legacy.explore_monument_source_key &&
    legacy.explore_monument_source_image_id !== null &&
    legacy.explore_monument_source_image_id !== undefined
  ) {
    const parts = legacy.explore_monument_source_key.split(';');
    const image = legacy.explore_monument_source_image_id;
    const pictureType = legacy.explore_monument_source_item_type ?? '';
    switch (legacy.explore_monument_source_type) {
      case 'travel':
        return parts.length === 6
          ? `mwnf3_travels:monument_picture:${parts.join(':')}:${pictureType || '_'}:${image}`
          : null;
      case 'monument':
        return parts.length === 4
          ? withPictureType(`mwnf3:monuments_pictures:${parts.join(':')}:${image}`, pictureType)
          : null;
      case 'sh_monument':
        return parts.length === 3
          ? `mwnf3_sharing_history:sh_monument_images:${parts[0].toLowerCase()}:${parts[1].toLowerCase()}:${parts[2]}:${pictureType ? pictureType.toLowerCase() : '_'}:${image}`
          : null;
      default:
        return null;
    }
  }

  // Explore monument picture
  // Matches ExploreMonumentPictureImporter: mwnf3_explore:monument_picture:{monumentId}:{type|_}:{image_number}
  // The picture item exists under this key whether the Explore monument is
  // native or a reference to a VM/Travels/SH monument — the picture importer
  // creates it as a child of whatever the monument resolves to.
  if (
    legacy.explore_monument_item_id !== null &&
    legacy.explore_monument_item_id !== 0 &&
    legacy.explore_monument_image_id !== null
  ) {
    const type = legacy.explore_monument_item_type || '_';
    return `mwnf3_explore:monument_picture:${legacy.explore_monument_item_id}:${type}:${legacy.explore_monument_image_id}`;
  }

  // Travels monument picture
  // Matches TravelsMonumentPictureImporter: mwnf3_travels:monument_picture:{project}:{country}:{trail}:{itinerary}:{location}:{number}:{type|_}:{image_number}
  if (
    legacy.travel_monument_project_id &&
    legacy.travel_monument_country_id &&
    legacy.travel_monument_trail_id !== null &&
    legacy.travel_monument_itinerary_id &&
    legacy.travel_monument_location_id &&
    legacy.travel_monument_item_id &&
    legacy.travel_monument_image_id !== null
  ) {
    const type = legacy.travel_monument_item_type || '_';
    return `mwnf3_travels:monument_picture:${legacy.travel_monument_project_id}:${legacy.travel_monument_country_id}:${legacy.travel_monument_trail_id}:${legacy.travel_monument_itinerary_id}:${legacy.travel_monument_location_id}:${legacy.travel_monument_item_id}:${type}:${legacy.travel_monument_image_id}`;
  }

  // No usable reference in any source family
  return null;
}
