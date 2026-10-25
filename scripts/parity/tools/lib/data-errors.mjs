// Records whose difference comes from an error in the legacy data, tracked for a fix in the data
// itself (museumwithnofrontiers/inventory-app#2339 and its tasks). The tool counts them as known
// (`expected:`), citing the task, so they don't stand for a defect of the new sites. A record
// leaves this list when its data is fixed.
//
// Key: `<package backward_compatibility, lower case>|<lang>` and the comparison's field.
const ITALICS_NEVER_CLOSED = 'legacy data error: an italic opened before a line break and never closed (#2341)';
const NO_NAME = 'legacy data error: a translation with content and no name (#2343)';

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
  ...['mwnf3:objects:epm:ua:mus21:10|ar', 'mwnf3:objects:isl:uk:mus03:35|es', 'mwnf3:monuments:isl:tr:mon01:18|ar']
    .map((where) => [where, '*', NO_NAME]),
];

const byWhere = new Map();
for (const [where, field, why] of ENTRIES) byWhere.set(`${where} ${field}`, why);

/** The known data error behind this comparison, or null. `where` is `<key>|<lang>` (any case). */
export function dataError(where, field) {
  const w = String(where).toLowerCase();
  return byWhere.get(`${w} ${field}`) ?? byWhere.get(`${w} *`) ?? null;
}
