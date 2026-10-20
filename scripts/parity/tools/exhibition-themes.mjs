// The exhibition layer on top of the gallery comparison: the exhibition's own texts per
// language, the theme tree, each theme's texts and curated pictures, and related content.
// Legacy serves each language under its own base path: …/<link>/<lang>/api/v2.
import { getJson, mapAll } from './lib/http.mjs';
import { compare } from './lib/text.mjs';
import { asList, paged } from './legacy-dxa.mjs';

export async function compareExhibition({ apiBase, self, P, R }) {
  const E = P.read('exhibition.json') ?? {};
  const galleryId = self?.galleryId;
  const langs = (self?.i18nLinks ?? []).map((l) => l.rel);
  if (!langs.length) langs.push('en');
  const baseFor = (lang) => apiBase.replace(/\/[a-z]{2}\/api\/v2$/, `/${lang}/api/v2`);
  const themes = P.read('themes.json') ?? [];
  const flat = themes.flatMap((t) => [t, ...(t.sub_themes ?? [])]);
  const byKey = new Map(flat.map((t) => [t.backward_compatibility, t]));
  const ttr = (lang, id) => P.translations.themes?.[lang]?.[id] ?? {};

  for (const lang of langs) {
    const base = baseFor(lang);
    const s = lang === 'en' ? self : (await getJson(`${base}/thg/galleries/self`)).json ?? {};
    for (const [lf, pf] of [['exhibitionTitle', 'titles'], ['exhibitionSubtitle', 'subtitles'], ['exhibitionHeadline', 'headlines'], ['exhibitionAbout', 'abouts']]) {
      if (s[lf] !== undefined || E[pf]?.[lang] !== undefined) R.field('exhibition', pf.replace(/s$/, ''), compare(s[lf], E[pf]?.[lang]), lang);
    }
    // The theme tree, top level then sub-themes.
    const top = (await paged(base, `thg/galleries/${galleryId}/${lang}/themes?bt=1`)).rows;
    const sub = (await paged(base, `thg/galleries/${galleryId}/${lang}/themes?bs=1`)).rows;
    const all = [...top, ...sub];
    if (lang === 'en' || lang === langs[0]) {
      R.set('themes (top level)', top.map((t) => `mwnf3_thematic_gallery:theme:${galleryId}:${t.themeId}`), themes.map((t) => t.backward_compatibility));
      R.set('sub-themes', sub.map((t) => `mwnf3_thematic_gallery:theme:${galleryId}:${t.themeId}`), themes.flatMap((t) => (t.sub_themes ?? []).map((x) => x.backward_compatibility)));
      const order = (a) => a.join(' ');
      R.field('theme', 'order', order(top.map((t) => t.themeId)) === order(themes.map((t) => t.backward_compatibility.split(':').pop())) ? { verdict: 'same' } : { verdict: 'different', legacy: order(top.map((t) => t.themeId)), pkg: order(themes.map((t) => t.backward_compatibility.split(':').pop())) }, 'top level');
    }
    await mapAll(all, async (t) => {
      const key = `mwnf3_thematic_gallery:theme:${galleryId}:${t.themeId}`;
      const p = byKey.get(key);
      if (!p) return;
      const tr = ttr(lang, p.id);
      const where = `${key}|${lang}`;
      R.field('theme', 'title', compare(t.themeTitle, tr.title), where);
      R.field('theme', 'quote', compare(t.themeQuote, tr.quote), where);
      R.field('theme', 'presentation', compare(t.themePresentation, tr.presentation), where);
      // Curated pictures: the theme's item list, in order, with their contextual texts.
      const d = (await getJson(`${base}/thg/galleries/${galleryId}/${lang}/themes/${t.themeId}`)).json;
      const pics = asList(d?.items);
      R.field('theme', 'picture count', pics.length === (p.pictures ?? []).length ? { verdict: pics.length ? 'same' : 'both-empty' } : { verdict: pics.length > (p.pictures ?? []).length ? 'missing-in-package' : 'extra-in-package', legacy: String(pics.length), pkg: String((p.pictures ?? []).length) }, where);
      pics.forEach((pic, i) => {
        const pp = (p.pictures ?? [])[i];
        if (!pp) return;
        const ptr = ttr(lang, `${p.id}/${pp.picture_item_id}`);
        if (pic.contextualDescription || ptr.contextual_description) R.field('theme', 'picture contextual description', compare(pic.contextualDescription, ptr.contextual_description), `${where}#${i + 1}`);
        if (pic.contextualImageCaption || ptr.image_caption) R.field('theme', 'picture caption', compare(pic.contextualImageCaption, ptr.image_caption), `${where}#${i + 1}`);
      });
    });
  }
  const rc = Object.values(self?.exhibitionRelatedContents ?? {}).flat();
  const prc = P.read('related_content.json') ?? [];
  R.field('exhibition', 'related content', rc.length === prc.length ? { verdict: rc.length ? 'same' : 'both-empty' } : { verdict: rc.length > prc.length ? 'missing-in-package' : 'extra-in-package', legacy: String(rc.length), pkg: String(prc.length) }, 'related_content.json');
  const lp = Object.values(self?.exhibitionPartners ?? {}).flat();
  R.field('exhibition', 'exhibition partners (sponsors) count', { verdict: 'same', legacy: String(lp.length) }, 'self');
}
