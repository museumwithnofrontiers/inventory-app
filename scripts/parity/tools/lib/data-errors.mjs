// Records whose difference comes from an error in the legacy data (or a bug of its display code),
// tracked for a fix there (museumwithnofrontiers/inventory-app#2339 and its tasks). The tool counts them as known
// (`expected:`), citing the task, so they don't stand for a defect of the new sites. A record
// leaves this list when its data is fixed.
//
// Key: `<package backward_compatibility, lower case>|<lang>` and the comparison's field.
const ITALICS_NEVER_CLOSED = 'legacy data error: an italic opened before a line break and never closed (#2341)';
const NO_NAME = 'legacy data error: a translation with content and no name (#2343)';
const TEST_ROW = 'legacy data error: a test row in Arts in Dialogue (#2342)';
const SAME_TEXT_TWICE = 'legacy data error: the same text in both description columns (#2348)';
const DASH_PLACEHOLDER = 'legacy data error: a dash as the dating method (#2349)';
const MISSING_SLIDESHOW_ITEMS = 'legacy data error: slideshow pictures name objects that do not exist (#2350)';
const KEY_CASE_SPLIT = 'legacy data error: picture rows spell the project key ISL and isl (#2351)';
const BANNER_FROM_OTHER_SITE = "legacy data error: the banner item is another exhibition's (#2352)";
const GLOSSARY_LINKER = 'legacy bug: the glossary linker breaks the HTML it links (#2353)';

const ENTRIES = [
  // #2341: the opening marker has no partner, so the converted text prints a stray "*".
  ...[
    'mwnf3:monuments:isl:jo:mon01:12|ar', 'mwnf3:monuments:isl:jo:mon01:15|ar', 'mwnf3:monuments:isl:jo:mon01:16|es',
    'mwnf3:monuments:isl:jo:mon01:17|ar', 'mwnf3:monuments:isl:jo:mon01:20|ar', 'mwnf3:monuments:isl:pt:mon01:34|ar',
    'mwnf3:monuments:isl:tn:mon01:13|fr', 'mwnf3:monuments:isl:tr:mon01:4|es', 'mwnf3:monuments:isl:tr:mon01:9|es',
    'mwnf3:monuments:isl:tr:mon01:13|es', 'mwnf3:objects:isl:de:mus01:18|fr', 'mwnf3:objects:isl:de:mus01:23|es',
    'mwnf3:objects:isl:de:mus01:28|es', 'mwnf3:objects:isl:dz:mus01:27|ar', 'mwnf3:objects:isl:dz:mus01:28|ar',
    'mwnf3:objects:isl:jo:mus01:26|es', 'mwnf3:objects:isl:tn:mus01:8|ar', 'mwnf3:objects:isl:tr:mus01_c:14|ar',
    'mwnf3:objects:isl:uk:mus02:40|es',
  ].map((where) => [where, 'item.bibliography', ITALICS_NEVER_CLOSED]),
  ['mwnf3:monuments:isl:jo:mon01:32|es', 'item.description', ITALICS_NEVER_CLOSED],
  ['mwnf3:monuments:isl:tr:mon01:13|es', 'item.description', ITALICS_NEVER_CLOSED],
  // #2343: the import requires a name, so the translation is not in the package.
  ...['mwnf3:objects:epm:ua:mus21:10|ar', 'mwnf3:objects:isl:uk:mus03:35|es', 'mwnf3:monuments:isl:tr:mon01:18|ar', 'mwnf3:objects:epm:gr:mus21:1|he', 'mwnf3_sharing_history:sh_partners:es_01_a|es']
    .map((where) => [where, '*', NO_NAME]),
  // The galleries list the Spanish row although it has no name.
  ['mwnf3_sharing_history:sh_partners:es_01_a', 'partner.languages', NO_NAME],
  ['related_content.json|arts_in_dialogue', 'exhibition.related content', TEST_ROW],
  ['mwnf3:objects:epm:us:mus22:48|en', 'item.description', SAME_TEXT_TWICE],
  ...['mwnf3_sharing_history:sh_objects:awe:pt:90|en', 'mwnf3_sharing_history:sh_objects:awe:pt:96|en']
    .map((where) => [where, 'item.method_for_datation', DASH_PLACEHOLDER]),
  ['mwnf3_sharing_history:sh_exhibition_subthemes:4', 'membership.sh_exhibition_subthemes (assigned ∪ slideshow items)', MISSING_SLIDESHOW_ITEMS],
  ...['ar', 'es', 'fr'].map((lang) => [`mwnf3:monuments:isl:dz:mon01:1|${lang}`, 'item.image.photographer', KEY_CASE_SPLIT]),
  ['water-in-islam', 'site.banner item', BANNER_FROM_OTHER_SITE],
  // #2353: a legacy display bug, not a data error; the data is sound and the sites print it as written.
  ...['mwnf3:objects:isl:uk:mus01:14|en', 'mwnf3:objects:isl:sy:mus01:30|en', 'mwnf3:objects:isl:jo:mus01_h:40|ar',
    'mwnf3:monuments:isl:jo:mon01:8|ar', 'mwnf3:monuments:isl:sy:mon01:12|en', 'mwnf3:monuments:isl:sy:mon01:24|en',
    'mwnf3:monuments:isl:sy:mon01:27|en',
  ].map((where) => [where, 'item.description', GLOSSARY_LINKER]),
  ['mwnf3:monuments:isl:sy:mon01:12|en', 'item.short_description', GLOSSARY_LINKER],
];

const byWhere = new Map();
for (const [where, field, why] of ENTRIES) byWhere.set(`${where} ${field}`, why);

/** The known data error behind this comparison, or null. `where` is `<key>|<lang>` (any case). */
export function dataError(where, field) {
  const w = String(where).toLowerCase();
  return byWhere.get(`${w} ${field}`) ?? byWhere.get(`${w} *`) ?? null;
}
