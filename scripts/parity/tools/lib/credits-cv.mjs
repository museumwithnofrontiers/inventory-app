// dxa-api's credit queries (ObjectsAuthors, MonumentsAuthors, mwnf3 and sh) left-join the author's
// CVs on author and project, then keep `cv.lang is null or cv.lang = credit.lang`. An author with
// CVs in other languages but none in the page's language drops out of that page's credits, although
// authors_objects credits them in that language. That is a legacy query defect, not a display choice.
import { readTable } from './sqldump.mjs';

let index;

function load() {
  if (index) return index;
  const cvLangs = new Map();
  const credits = new Map();
  const lc = (v) => String(v ?? '').toLowerCase();
  const addCv = (db, rows, langCol) => {
    for (const r of rows) {
      const k = `${db}|${r.author_id}|${lc(r.project_id)}`;
      if (!cvLangs.has(k)) cvLangs.set(k, new Set());
      cvLangs.get(k).add(lc(r[langCol]));
    }
  };
  const addCredits = (db, rows, keyOf, langCol) => {
    for (const r of rows) {
      const k = `${keyOf(r)}|${lc(r[langCol])}|${r.type}`;
      if (!credits.has(k)) credits.set(k, []);
      credits.get(k).push(`${db}|${r.author_id}|${lc(r.project_id)}`);
    }
  };
  addCv('mwnf3', readTable('mwnf3', 'authors_cv'), 'lang_id');
  addCv('sh', readTable('mwnf3_sharing_history', 'sh_authors_cv'), 'lang');
  addCredits('mwnf3', readTable('mwnf3', 'authors_objects'), (r) => lc(`mwnf3:objects:${r.project_id}:${r.country_id}:${r.museum_id}:${r.object_id}`), 'lang_id');
  addCredits('mwnf3', readTable('mwnf3', 'authors_monuments'), (r) => lc(`mwnf3:monuments:${r.project_id}:${r.country_id}:${r.institution_id}:${r.monument_id}`), 'lang_id');
  addCredits('sh', readTable('mwnf3_sharing_history', 'sh_authors_objects'), (r) => lc(`mwnf3_sharing_history:sh_objects:${r.project_id}:${r.country}:${r.number}`), 'lang');
  addCredits('sh', readTable('mwnf3_sharing_history', 'sh_authors_monuments'), (r) => lc(`mwnf3_sharing_history:sh_monuments:${r.project_id}:${r.country}:${r.number}`), 'lang');
  index = { cvLangs, credits };
  return index;
}

// True when every author credited for this record, language and role is one the CV join drops.
export function droppedByCvJoin(key, lang, type) {
  const { cvLangs, credits } = load();
  const authors = credits.get(`${key.toLowerCase()}|${lang}|${type}`) ?? [];
  return authors.length > 0 && authors.every((a) => cvLangs.has(a) && !cvLangs.get(a).has(lang));
}
