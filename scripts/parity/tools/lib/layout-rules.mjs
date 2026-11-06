// The layout sanity rules of the `layout` pass (#2379, part A). `layoutFindings` runs inside the
// page (Playwright's page.evaluate), so it must not use anything from this module's scope.
//
//   narrow-text   a block holding more than 20 words is drawn narrower than 200px: the theme
//                 page that once set its text one word per line
//   low-contrast  visible text below 3:1 against its effective background: the colour of the
//                 first opaque ancestor, with every translucent layer on the way laid over it.
//                 Text over a picture (an ancestor with a background image) is not judged.
//   h-scroll      the page scrolls sideways
export const LAYOUT_RULES = { minWords: 21, minWidth: 200, minContrast: 3 };

export function layoutFindings(rules) {
  const { minWords, minWidth, minContrast } = rules;
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const ratio = (x, y) => {
    const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };
  const hex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const pictured = (cs) => /url\(|gradient\(/.test(cs.backgroundImage);
  const PICTURES = new Set(['IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'IFRAME', 'svg', 'OBJECT', 'EMBED']);
  // The effective background: what is painted under the middle of the text's box, from the top
  // down (so a box laid over another by its position counts, not only the text's ancestors).
  // Null where a picture lies under the text before an opaque colour does.
  const background = (el, box) => {
    const x = Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1);
    const y = Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1);
    const all = document.elementsFromPoint(x, y);
    // What lies above the text (a sticky header scrolled over it) is not under it.
    const at = all.findIndex((e) => e === el || e.contains(el));
    if (at < 0) return null;
    const stack = all.slice(at);
    const layers = [];
    const opaque = (c) => layers.reduceRight((under, top) => over(top, under), c);
    for (const e of stack) {
      if (e !== el && el.contains(e)) continue;
      if (PICTURES.has(e.tagName)) return null;
      const cs = getComputedStyle(e);
      if (pictured(cs)) return null;
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(e, pseudo);
        if (ps.content !== 'none' && ps.content !== 'normal' && pictured(ps)) return null;
      }
      const c = parse(cs.backgroundColor);
      const alpha = c ? c.a * Number(cs.opacity) : 0;
      if (c && alpha >= 0.99) return opaque(c);
      if (c && alpha > 0.01) layers.push({ ...c, a: alpha });
    }
    return opaque({ r: 255, g: 255, b: 255, a: 1 });
  };
  const shown = (el) => (el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true);
  const block = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (!getComputedStyle(e).display.startsWith('inline')) return e;
    }
    return document.body;
  };
  const where = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) {
      const cls = [...e.classList].find((c) => c.startsWith('mwnf-')) ?? e.classList[0];
      parts.unshift(cls ? `${e.tagName.toLowerCase()}.${cls}` : e.tagName.toLowerCase());
    }
    return parts.join(' > ');
  };
  const snippet = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 60);

  const findings = [];
  const words = new Map();
  const judged = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    // Nothing drawn, or the 1px box of a text kept for screen readers only.
    if (r.width <= 2 || r.height <= 2 || !shown(el)) continue;
    const b = block(el);
    const entry = words.get(b) ?? { count: 0, text: '' };
    entry.count += text.split(/\s+/).length;
    if (entry.text.length < 60) entry.text += ` ${text}`;
    words.set(b, entry);
    if (judged.has(el) || text.replace(/[\s\p{P}\p{S}]/gu, '').length < 2) continue;
    // Only text inside the window can be looked under: the runner scrolls the page through and
    // asks again at each step.
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    judged.add(el);
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bg = background(el, r);
    if (!fg || !bg) continue;
    const contrast = ratio(fg.a < 0.99 ? over(fg, bg) : fg, bg);
    if (contrast < minContrast) {
      findings.push({ rule: 'low-contrast', where: where(el), text: snippet(text), color: hex(fg), background: hex(bg), ratio: Math.round(contrast * 100) / 100 });
    }
  }
  for (const [b, { count, text }] of words) {
    const width = b.getBoundingClientRect().width;
    if (count >= minWords && width < minWidth) findings.push({ rule: 'narrow-text', where: where(b), text: snippet(text), words: count, width: Math.round(width) });
  }
  // The window's own overflow is html's, or body's when html leaves it visible (CSS overflow
  // propagation). Hidden or clipped, a visitor cannot scroll sideways whatever sticks out.
  const html = getComputedStyle(document.documentElement).overflowX;
  const viewportOverflow = html === 'visible' ? getComputedStyle(document.body).overflowX : html;
  const scrollWidth = document.documentElement.scrollWidth;
  const clientWidth = document.documentElement.clientWidth;
  if (!['hidden', 'clip'].includes(viewportOverflow) && scrollWidth > clientWidth + 1) {
    findings.push({ rule: 'h-scroll', where: 'html', text: '', scrollWidth, clientWidth });
  }
  return findings;
}

// A finding is accepted when an entry of the allow list (tools/layout-allow.json) matches it:
// its rule, and each field the entry gives — site, page, width, a class its place holds
// (`where`), the start of its text, its colours (`pair`, "#fg on #bg"). `rule` and `reason` are
// required: an entry says why legacy draws the page the same way.
export function allowed(finding, job, allowList) {
  const pair = finding.color ? `${finding.color} on ${finding.background}` : null;
  return allowList.find((a) => a.rule === finding.rule
    && (!a.slug || a.slug === job.slug)
    && (!a.page || a.page === job.page)
    && (!a.width || a.width === job.width)
    && (!a.where || finding.where.includes(a.where))
    && (!a.text || finding.text.startsWith(a.text))
    && (!a.pair || a.pair === pair)) ?? null;
}
