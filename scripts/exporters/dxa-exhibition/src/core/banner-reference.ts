/**
 * Legacy `thg_gallery.banner_item` / `homepage_item` references.
 *
 * Both columns hold a composite key in the form `{db}#{type}#{a;b;c[;d]}`, e.g.
 * `mwnf#obj#EPM;at;Mus22;51`. dxa-api turns it into an API route
 * (App\MWNF\DAO\v2\THG\Galleries::bannerRefToLink); here it is turned into the
 * item's backward_compatibility, which is the same natural key the importer
 * used and therefore resolves straight to an item UUID.
 */
export function bannerRefToBackwardCompatibility(reference: string | null | undefined): string | null {
  if (!reference) return null

  const parts = reference.split('#')
  if (parts.length !== 3) return null

  const [database, kind, rawKey] = parts as [string, string, string]
  const key = rawKey.split(';').map(segment => segment.trim())

  // mwnf3 keys carry the holding partner; SH keys do not (the SH keyspace is
  // project/country/number). Anything else is malformed legacy data.
  if (database === 'mwnf' && key.length === 4) {
    const table = kind === 'obj' ? 'objects' : kind === 'mon' ? 'monuments' : null
    return table ? `mwnf3:${table}:${key.join(':')}` : null
  }

  if (database === 'sh' && key.length === 3) {
    const table = kind === 'obj' ? 'sh_objects' : kind === 'mon' ? 'sh_monuments' : null
    // The SH keyspace is lowercase throughout (formatShBackwardCompatibility).
    return table ? `mwnf3_sharing_history:${table}:${key.join(':').toLowerCase()}` : null
  }

  return null
}
