// node tools/compare-publications.mjs — Publications: legacy MWNF Books' API
// (https://books.museumwnf.org/api) vs @museumwnf/publications-data. The works and their
// categories, each work's country, project, trail, languages, subjects, theme and target reader,
// and each shown version (language × type × edition × publisher) with its texts, numbers, cover
// and sample/credits PDFs.
import { readFileSync } from 'node:fs';
import { allowedUrl, getJson, mapAll, stats } from './lib/http.mjs';
import { loadPackage } from './lib/pkg.mjs';
import { Report } from './lib/report.mjs';
import { compare } from './lib/text.mjs';
import { checkImageUrls } from './lib/images.mjs';
import { OUT } from './lib/paths.mjs';

const API = 'https://books.museumwnf.org/api';
const site = JSON.parse(readFileSync(`${OUT}/sitemap.json`, 'utf8')).sites.find((s) => s.slug === 'publications');
const P = loadPackage(site.package, site.packageVersion);
const R = new Report('publications', { legacy: API, package: `${site.package}@${site.packageVersion} (published ${site.packagePublished?.slice(0, 10)})`, 'compared at': new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z' });
const J = async (path) => (await getJson(`${API}/${path}`))?.json;

// ---------- legacy: the paged lists, then each work
async function pages(path) {
  const ids = [];
  for (let page = 1; page < 50; page++) {
    const body = await J(`${path}${path.includes('?') ? '&' : '?'}page=${page}`);
    const block = Array.isArray(body?.data) ? body.data[0] : body?.data;
    ids.push(...(block?.items ?? []).map((b) => b.id));
    if (!block?.meta || page >= block.meta.last_page) break;
  }
  return ids;
}
const categories = (await J('category'))?.data ?? [];
const allIds = await pages('books');
const byCategory = await mapAll(categories, (c) => pages(`books?ca=${c.category_id}`));
const works = (await mapAll(allIds, (id) => J(`books/${id}`))).map((b) => b?.data).filter(Boolean);

// ---------- package
const pubs = P.read('publications.json');
const editions = P.read('editions.json');
const tags = new Map(P.read('tags.json').map((t) => [t.id, t]));
const trails = new Map(P.read('trails.json').map((t) => [t.id, t]));
const countries = new Map(P.read('countries.json').map((c) => [c.id, c]));
const projects = P.read('manifest.json').projects ?? {};
const keyOf = (id) => `mwnf3:bookbase:${id}`;
const pubByKey = new Map(pubs.map((p) => [p.backward_compatibility, p]));
const editionsOf = new Map();
for (const e of editions) (editionsOf.get(e.publication_id) ?? editionsOf.set(e.publication_id, []).get(e.publication_id)).push(e);

R.set('works', allIds.map(keyOf), pubs.map((p) => p.backward_compatibility));
// Legacy's four category lists, by the package's category the site files them under.
const CATEGORY = { 'VIRTUAL MUSEUM BOOKS': 'virtual-museum', 'TRAVEL BOOKS': 'exhibition-trail', 'EDUCATIONAL BOOKS': 'educational', 'OTHER BOOKS': 'other' };
// Legacy files two works under two categories; Pascal gave each one (D-P3, #2517): 48 the
// Educational Guide, 53 the Architectural Guide Tunis. Their other list is not compared.
const DECIDED = { 48: 'educational', 53: 'other' };
categories.forEach((c, i) => {
  const mapped = CATEGORY[c.name];
  if (!mapped) return R.note(`Legacy category "${c.name}" (${c.category_id}) has no package category: not compared.`);
  const listed = (byCategory[i] ?? []).filter((id) => !DECIDED[id] || DECIDED[id] === mapped);
  R.set(`category ${c.name}`, listed.map(keyOf), pubs.filter((p) => p.category === mapped).map((p) => p.backward_compatibility));
});
R.note('Works 48 and 53 are in two legacy categories; each is filed under the one Pascal decided (D-P3), and only that list is compared.');

const LEGACY_COLUMN = { description2: 'description', description1: 'introduction', author: 'author_credit', photographer: 'photography_credit', local_coordinator: 'coordination_credit' };
const same = (a, b) => (a === b ? { verdict: a === '' ? 'both-empty' : 'same' } : !a ? { verdict: 'extra-in-package', pkg: b } : !b ? { verdict: 'missing-in-package', legacy: a } : { verdict: 'different', legacy: a, pkg: b });
const list = (xs) => [...new Set((xs ?? []).filter((x) => x !== null && x !== undefined).map((x) => String(x).trim()).filter(Boolean))].sort().join('; ');
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

// A PDF legacy names may not exist on its image host (legacy answers 400 or 404): the package then
// leaves it out on purpose (publications-data-package.md). Asked only for a missing one, once.
const existence = new Map();
async function exists(url) {
  const u = allowedUrl(url.replace('/portal//', '/portal/'));
  if (!u) return true;
  if (!existence.has(u.href)) existence.set(u.href, fetch(u.href, { method: 'HEAD', headers: { 'user-agent': 'mwnf-parity-check/0.1 (read-only)' } }).then((r) => r.ok, () => true));
  return existence.get(u.href);
}

for (const w of works) {
  const key = keyOf(w.id);
  const p = pubByKey.get(key);
  if (!p) continue;
  const tagsOf = (category) => p.tag_ids.map((id) => tags.get(id)).filter((t) => t?.category === category).map((t) => t.description);
  R.field('work', 'country', same(str(w.country_id), str(countries.get(p.country_id)?.code)), key);
  R.field('work', 'project', same(str(w.project), str(projects[p.project_id]?.name?.en)), key);
  R.field('work', 'trail', same(str(w.ref_trail).replace(/;/g, ':'), p.trail_ids.map((id) => trails.get(id)?.backward_compatibility.replace('mwnf3_travels:trail:', '')).join('; ')), key);
  R.field('work', 'languages', same(list(w.available_languages), list(p.languages)), key);
  R.field('work', 'subjects', same(list(w.subjects), list(tagsOf('subject'))), key);
  R.field('work', 'theme', same(list([w.theme]), list(tagsOf('theme'))), key);
  R.field('work', 'target reader', same(list([w.target]), list(tagsOf('audience'))), key);
  const [d, m, y] = str(w.date).split('/');
  R.field('work', 'date', same(y ? `${y}-${m}-${d}` : '', str(p.extra?.date)), key);
  R.field('work', 'region', same(str(w.region), str(p.extra?.region)), key);
  if (w.new) R.unmapped('work', 'new', key);

  // ---------- versions ↔ editions, by language, legacy type, edition and publisher
  const mine = editionsOf.get(p.id) ?? [];
  const edKey = (lang, type, edition, publisher) => `${lang}|${type}|${edition}|${str(publisher)}`;
  const pkgEd = new Map(mine.map((e) => {
    const [, , , lang, , type, edition] = e.backward_compatibility.split(':');
    return [edKey(lang, type, edition, e.publisher), e];
  }));
  // The versions legacy marks display = n ship nowhere (D-P2, #2517); its API still lists them.
  const legacyVersions = Object.entries(w.versions ?? {}).flatMap(([lang, vs]) => vs.filter((v) => v.display !== false).map((v) => ({ lang, v, k: edKey(lang, v.type, v.edition, v.publisher) })));
  R.set(`versions of ${key}`, legacyVersions.map((x) => x.k), [...pkgEd.keys()]);

  for (const { lang, v, k } of legacyVersions) {
    const e = pkgEd.get(k);
    if (!e) continue;
    const where = `${key}|${k}`;
    // An edition's own texts (D-P9) are keyed by legacy column, as legacy_texts keeps them.
    const own = Object.fromEntries(Object.entries(e.texts ?? {}).map(([column, value]) => [LEGACY_COLUMN[column] ?? column, value]));
    const t = { ...(P.tr('publications', lang, p.id) ?? {}), ...own };
    for (const [lf, pf] of [['title', 'title'], ['subtitle', 'subtitle'], ['about_this_book', 'description'], ['more_about_this_book', 'introduction'], ['author', 'author_credit'], ['photographer', 'photography_credit'], ['editors', 'coordination_credit']]) {
      if (v[lf] || t[pf]) R.field('version', pf, compare(v[lf], t[pf]), where);
    }
    for (const [lf, pf] of [['isbn', 'isbn'], ['publish_year', 'publish_year'], ['count_pages', 'page_count'], ['count_images', 'image_count'], ['count_plans', 'plan_count'], ['size', 'dimensions'], ['format', 'binding']]) {
      // A count legacy wrote as more than a number is kept whole in texts, which the site prints.
      const pkgValue = str(e.texts?.[lf] ?? e[pf]);
      R.field('version', pf, same(str(v[lf]) === '0' ? '' : str(v[lf]), pkgValue === '0' ? '' : pkgValue), where);
    }
    // Legacy's images: { cover_: one picture, page_: [the sample pages] }.
    const images = Object.values(v.images ?? {}).flat();
    R.field('version', 'cover', same(images.some((i) => i?.type === 'cover') ? 'cover' : '', e.cover ? 'cover' : ''), where);
    const legacyPages = images.filter((i) => i?.type === 'page').length;
    const pkgPages = (p.pages ?? []).filter((x) => x.edition_id === e.id).length;
    R.field('version', 'sample pages', same(legacyPages ? String(legacyPages) : '', pkgPages ? String(pkgPages) : ''), where);
    for (const [lf, kind] of [['path_catalogue', 'sample'], ['path_credits', 'credits']]) {
      const url = str(v[lf]);
      const has = (e.documents ?? []).some((x) => x.kind === kind);
      let r = same(url ? kind : '', has ? kind : '');
      if (r.verdict === 'missing-in-package' && !(await exists(url))) r = { verdict: 'expected:legacy names a PDF its image host does not have', legacy: url };
      R.field('version', `${kind} PDF`, r, where);
    }
    for (const lf of ['price', 'discount', 'note', 'get_it_from', 'related_explore_itinerary_link', 'related_travel_tour_link']) {
      const val = v[lf];
      if (val && (typeof val !== 'object' || Object.keys(val).length)) R.unmapped('version', lf, where);
    }
  }
}

R.note('Shop links (get_it_from) and prices are never exported (D-P8); the hidden versions ship nowhere (D-P2).');
R.note('A version is matched by language, legacy type (digp, ebook, …), edition and publisher: the package keeps the type in its backward_compatibility, the publisher as text.');
await checkImageUrls(P.root, R);
R.write(`${OUT}/publications`);
console.log(JSON.stringify({ works: works.length, ...stats }));
