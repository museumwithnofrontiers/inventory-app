// The legacy addresses the inventory itself links to (config/legacy.php,
// `links.thematic_galleries`): gallery id → its live legacy site, in English.
// An exhibition can live elsewhere than the dump's `thg_gallery_url` says: the
// Hijaz Railway's link in the dump answers 403, and its live legacy is on
// upgrade-exhibitions (#2379). The PHP file is read as text: a flat map of
// `'<id>' => ['base_url' => '…', 'path' => '…']` entries.
import { readFileSync } from 'node:fs';
import { REPO } from './paths.mjs';

export function parseThematicGalleryLinks(php) {
  const start = php.indexOf("'thematic_galleries'");
  if (start < 0) return new Map();
  const block = php.slice(start);
  const links = new Map();
  for (const m of block.matchAll(/'(\d+)'\s*=>\s*\[\s*'base_url'\s*=>\s*'([^']*)',\s*'path'\s*=>\s*'([^']*)'/g)) {
    const [, id, base, path] = m;
    const tail = path ? `/${path.replace('{lang}', 'en')}` : '';
    links.set(Number(id), `${base.replace(/\/$/, '')}${tail}/`);
  }
  return links;
}

export function thematicGalleryLinks(file = `${REPO}/config/legacy.php`) {
  return parseThematicGalleryLinks(readFileSync(file, 'utf8'));
}
