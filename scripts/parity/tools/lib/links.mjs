// Which links of a new site still go to legacy (inventory-app#2482). A link is judged by its
// address alone:
//   ported   it goes to the legacy address of a site that has a new one: the gate fails on it
//   allowed  the same, but kept on purpose (tools/links-allow.json says why)
//   legacy   it goes to an MWNF legacy page that has no new site (the portal, …): reported
//   null     anything else (the new sites, other hosts, mailto:, …)

// Legacy's standalone sites also answer on their own domains.
const ALIASES = {
  'discoverislamicart.org': 'islamicart',
  'discoverbaroqueart.org': 'baroqueart',
  'sharinghistory.org': 'sharinghistory',
};

// A standalone site that took over only part of its legacy host: the legacy pages it replaced,
// by their path's start. Travels is legacy's Exhibition Trails (`travel_et_*.php`); the rest of
// travels.museumwnf.org (the tours, the booking form) has no new site.
const PORTED_PATHS = { travels: '/travel_et_' };

export const bareHost = (host) => host.toLowerCase().replace(/^www\./, '');

export function isMwnfHost(host) {
  const h = bareHost(host);
  return h === 'museumwnf.org' || h.endsWith('.museumwnf.org') || h in ALIASES;
}

/**
 * The legacy addresses that have a new site, from the sitemap's rows: a gallery or standalone
 * site by its host, an exhibition by its host and first path segment (they share one host).
 */
export function portedTargets(sites) {
  const targets = [];
  const bySlug = new Map(sites.map((s) => [s.slug, s]));
  for (const s of sites) {
    if (!s.legacyUrl || !s.newUrl) continue;
    const url = new URL(s.legacyUrl);
    const first = url.pathname.split('/').filter(Boolean)[0];
    const path = PORTED_PATHS[s.slug] ?? (s.kind === 'exhibition' && first ? `/${first.toLowerCase()}/` : '/');
    targets.push({ host: bareHost(url.host), path, slug: s.slug, newUrl: s.newUrl });
  }
  for (const [host, slug] of Object.entries(ALIASES)) {
    const s = bySlug.get(slug);
    if (s?.newUrl) targets.push({ host, path: '/', slug, newUrl: s.newUrl });
  }
  return targets;
}

/** One link's verdict: { kind, target?, reason? }; kind null for a link that is not legacy's. */
export function judge(href, targets, allow = []) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return { kind: null };
  }
  if (!/^https?:$/.test(url.protocol) || !isMwnfHost(url.host)) return { kind: null };
  const host = bareHost(url.host);
  const path = `${url.pathname.toLowerCase().replace(/\/?$/, '/')}`;
  const target = targets
    .filter((t) => t.host === host && path.startsWith(t.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!target) return { kind: 'legacy' };
  const kept = allow.find((a) => new RegExp(a.href).test(href));
  return kept ? { kind: 'allowed', target, reason: kept.reason } : { kind: 'ported', target };
}
