// The legacy PHP museums: Discover Islamic Art and Discover Baroque Art (one codebase on mwnf3)
// and Sharing History (its sibling on mwnf3_sharing_history). The record list comes from the
// dump, each record's page from the live site (raw HTML, database_item.php), parsed back into fields.
//
// The page prints one <h3>label</h3> per non-empty field, with the label from mwnf3.translation
// in the page language, so labels are mapped back to their term key (db_name_object,
// sh_db_name_object, …) through the same table.
import { readTable } from './lib/sqldump.mjs';
import { decodeEntities, htmlToText, untilStable } from './lib/text.mjs';

export const PHP_SITES = {
  islamicart: { host: 'https://islamicart.museumwnf.org', projects: ['ISL', 'EPM'] },
  baroqueart: { host: 'https://baroqueart.museumwnf.org', projects: ['BAR'] },
  // Sharing History records have no museum in their key, and their pictures sit under sharing_history/.
  sharinghistory: { host: 'https://sharinghistory.museumwnf.org', projects: ['AWE'], sh: true, termPrefix: 'sh_db_' },
};

export function legacyRecords(cfg) {
  const records = new Map();
  const add = (type, r, key, id) => {
    const rec = records.get(key) ?? { key, type, id, langs: [] };
    rec.langs.push(r.lang);
    records.set(key, rec);
  };
  if (cfg.sh) {
    // display_status N: kept for the historical background / timeline, not the database.
    for (const type of ['object', 'monument']) {
      const status = new Map(readTable('mwnf3_sharing_history', `sh_${type}s`).map((r) => [`${r.project_id}:${r.country}:${r.number}`, r.display_status]));
      for (const r of readTable('mwnf3_sharing_history', `sh_${type}s_texts`)) {
        if (!cfg.projects.includes(r.project_id.toUpperCase())) continue;
        const k = `${r.project_id}:${r.country}:${r.number}`;
        add(type, r, `mwnf3_sharing_history:sh_${type}s:${r.project_id.toLowerCase()}:${r.country}:${r.number}`, [type, r.project_id, r.country, r.number]);
        records.get(`mwnf3_sharing_history:sh_${type}s:${r.project_id.toLowerCase()}:${r.country}:${r.number}`).status = status.get(k) ?? null;
      }
    }
    return records;
  }
  for (const [type, table, inst] of [['object', 'objects', 'museum_id'], ['monument', 'monuments', 'institution_id']]) {
    for (const r of readTable('mwnf3', table)) {
      if (!cfg.projects.includes(r.project_id)) continue;
      add(type, r, `mwnf3:${table}:${r.project_id}:${r.country}:${r[inst]}:${r.number}`, [type, r.project_id, r.country, r[inst], r.number]);
    }
  }
  return records;
}

// label text (any language) → term key. The museums read group 4; Sharing History reads every
// sh_db_ word.
export function labelIndex(cfg = {}) {
  const idx = new Map();
  const prefix = cfg.termPrefix ?? 'db_';
  for (const r of readTable('mwnf3', 'translation')) {
    if (!r.value || !String(r.word_id).startsWith(prefix)) continue;
    if (prefix === 'db_' && Number(r.group_id) !== 4) continue;
    idx.set(`${r.lang_id}|${norm(r.value)}`, r.word_id);
  }
  return idx;
}
const norm = (s) => decodeEntities(String(s)).replace(/\s+/g, ' ').replace(/[:：]\s*$/, '').trim().toLowerCase();

// Package key → page id: mwnf3:objects:ISL:it:Mus01:9 → object;ISL;it;Mus01;9,
// mwnf3_sharing_history:sh_objects:awe:pt:102 → object;AWE;pt;102.
export function idFromKey(key) {
  const p = key.split(':');
  const type = p[1].replace(/^sh_/, '').replace(/s$/, '');
  return p[0] === 'mwnf3_sharing_history' ? [type, p[2].toUpperCase(), ...p.slice(3)] : [type, ...p.slice(2)];
}

export const pageUrl =(host, id, lang) => `${host}/database_item.php?id=${[...id, lang].join(';')}`;

// → { sections: [{label, term, html}], short, credits: {role: name}, empty }
export function parsePage(html, lang, labels) {
  // The record starts at the first <h3> after the site title (an <h3> inside the home link).
  const title = html.search(/<h3>[^<]*<\/h3>(?:<p>[^<]*<\/p>)?<\/a>/);
  const start = title < 0 ? -1 : html.indexOf('<h3>', title + 10);
  if (start < 0) return { sections: [], empty: true };
  const body = html.slice(start, html.indexOf('</section>', start) > 0 ? html.indexOf('</section>', start) : start + 200000);
  const parts = body.split(/<h3>/).slice(1);
  const sections = [];
  let short = null;
  let shortBroken = false;
  let credits = {};
  for (const part of parts) {
    const close = part.indexOf('</h3>');
    if (close < 0) continue;
    const label = decodeEntities(part.slice(0, close)).trim();
    // Glossary terms are links. Legacy's glossary pass sometimes nests one link inside another's
    // href (it then prints residue such as ,'ar');" on the page); remove the links and the residue,
    // and remember that the page text was damaged.
    let content = part.slice(close + 5);
    const brokenGlossary = /showGlossary\('[^']*'<a /.test(content);
    content = content
      .replace(/<a href="javascript:showGlossary\('[^']*'(?=<a )/g, '')
      .replace(/<a href="javascript:showGlossary\('[^']*','[a-z]{2}'\);" style="text-decoration: underline;">/g, '')
      .replace(/,'[a-z]{2}'\);"/g, '')
      .replace(/ style="text-decoration: underline;">/g, '');
    // A label missing from the dictionary prints as its raw key, e.g. "[db_artist]".
    // Sharing History terms are the same keys with an sh_ prefix (sh_db_name_object).
    // "Type of Object" is hard-coded in the Sharing History template, not in the dictionary.
    const term = (labels.get(`${lang}|${norm(label)}`) ?? labels.get(`en|${norm(label)}`) ?? label.match(/^\[((?:sh_)?db_\w+)\]$/)?.[1] ?? (norm(label) === 'type of object' ? 'db_typeof_object' : null))?.replace(/^sh_/, '') ?? null;
    if (term === 'db_citation') {
      credits = parseCredits(content, lang, labels);
      continue;
    }
    // The short description sits behind a "View Short Description" toggle in the same section.
    const tc = content.match(/<p class="tag_close">([\s\S]*?)<\/p>/);
    if (tc) {
      short = tc[1];
      content = content.replace(tc[0], '').replace(/<i><a class="tag arrow"[\s\S]*?<\/a><\/i>/, '');
    }
    // Drop "About <museum>" links, the contact-details tooltip, the Special-features wrapper, the
    // picture strip and anything after the record (side columns, scripts).
    content = content.replace(/<p>(?:<img[^>]*>(?:&nbsp;|\s)*)?<a [^>]*(class="arrow"|pm_partner\.php)[\s\S]*?<\/a><\/p>/g, '');
    content = untilStable(content, (c) => c.replace(/<!--[\s\S]*?-->/g, ''));
    content = content.split(/<div class="(?:specials|su_tooltip|page)/)[0].split(/<\/div>/)[0];
    sections.push({ label, term, html: content, brokenGlossary });
    if (tc) shortBroken = brokenGlossary;
  }
  return { sections, short, shortBroken, credits, empty: sections.length === 0 };
}

// "<p>Prepared by: Name<br/>Copyedited by: <a class="su_tooltip_1">Name<span …>bio</span></a>, …</p>"
// and "MWNF Working Number: IT 09". Keyed by term (db_writer, db_workingnumber, …) when known.
function parseCredits(html, lang, labels) {
  const out = {};
  const clean = html.replace(/<span class="su_tooltip_1-content">[\s\S]*?<\/span><\/span><\/span><\/span>/g, '');
  for (const p of clean.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    for (const line of p[1].split(/<br\s*\/?>/)) {
      const m = line.match(/^\s*([^<:]{2,60}):\s*([\s\S]*)$/);
      if (!m) continue;
      const label = decodeEntities(m[1]).trim();
      const term = (labels.get(`${lang}|${norm(label)}`) ?? labels.get(`en|${norm(label)}`) ?? label).replace(/^sh_/, '');
      const text = htmlToText(m[2]).trim();
      if (text) out[term] = text.split(/\s*[,،]\s*/).filter(Boolean);
    }
  }
  return out;
}

// The record's own pictures: images.museumwnf.org/<size>/<objects|monuments>/<project>/<country>/<museum no.>/<number>/<n>.jpg
// (Mus01_B → 1_b), as legacy builds the path.
export function imageNumbers(html, id) {
  if (id.length === 4) {
    // Sharing History: sharing_history/sh_<type>s/<project>/<country>/<number>/<n>.jpg
    const [type, project, country, number] = id;
    const dir = `sharing_history/sh_${type}s/${project.toLowerCase()}/${country}/${number}`;
    return [...new Set([...html.matchAll(new RegExp(`images\\.museumwnf\\.org/[a-z_]+/${dir}/(\\d+)\\.jpg`, 'gi'))].map((x) => x[1]))].sort();
  }
  const [type, project, country, museum, number] = id;
  const m = String(museum).toLowerCase().replace(/^(mus|mon|ins|inst)/, '').replace(/^0+(?=\d)/, '');
  // Mus01 → 1, but Mus01_A → 01_a: accept the leading zeros either way.
  const dir = `${type}s/${project.toLowerCase()}/${country}/0*${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${number}`;
  // Monument plans live in a plans/ subfolder and are pictures of the record too.
  return [...new Set([...html.matchAll(new RegExp(`images\\.museumwnf\\.org/[a-z_]+/${dir}/((?:plans/)?\\d+)\\.jpg`, 'gi'))].map((x) => x[1]))].sort();
}

export const sectionText = (s) => htmlToText(s.html);
