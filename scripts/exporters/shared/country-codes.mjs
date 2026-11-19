// @ts-check
/**
 * Legacy country codes (M16 E3, inventory-app#2649): the reverse of the
 * importer's COUNTRY_CODE_MAP (`scripts/importer/src/utils/code-mappings.ts`),
 * for the packages that still ship legacy codes (an Explore collection's
 * `country_ids`). A test keeps the copy below and the aliases equal to the
 * importer's.
 *
 * Types are in `country-codes.d.mts`.
 */

/** Legacy 2-letter code → ISO3 id, as the importer maps it. */
export const COUNTRY_CODE_MAP = Object.freeze({
  ab: 'alb',
  ag: 'arg',
  al: 'aus',
  at: 'aut',
  az: 'aze',
  be: 'bel',
  bg: 'bgd',
  bh: 'bhr',
  bl: 'blr',
  br: 'bra',
  bs: 'bih',
  bu: 'bgr',
  ca: 'can',
  ch: 'chn',
  co: 'com',
  cy: 'cyp',
  cz: 'cze',
  de: 'deu',
  dj: 'dji',
  dn: 'dnk',
  dz: 'dza',
  eg: 'egy',
  es: 'esp',
  et: 'est',
  fn: 'fin',
  fr: 'fra',
  ge: 'geo',
  gr: 'grc',
  hr: 'hrv',
  hu: 'hun',
  ia: 'irn',
  in: 'ind',
  iq: 'irq',
  ir: 'irl',
  is: 'isr',
  it: 'ita',
  ix: 'ita',
  jo: 'jor',
  jp: 'jpn',
  kw: 'kwt',
  lb: 'lbn',
  ln: 'ltu',
  lt: 'lva',
  lx: 'lux',
  ly: 'lby',
  ma: 'mar',
  mc: 'mkd',
  md: 'mda',
  ml: 'mlt',
  mn: 'mne',
  mt: 'mrt',
  my: 'mys',
  nt: 'nld',
  nw: 'nor',
  on: 'omn',
  pa: 'pse',
  pd: 'xxx',
  pl: 'pol',
  pt: 'prt',
  px: 'pse',
  qt: 'qat',
  rm: 'rou',
  rs: 'rus',
  sa: 'sau',
  sb: 'srb',
  sd: 'sdn',
  se: 'swe',
  sf: 'zaf',
  si: 'svn',
  sl: 'svk',
  so: 'som',
  sw: 'che',
  sy: 'syr',
  tn: 'tun',
  tr: 'tur',
  ua: 'are',
  uc: 'ukr',
  uk: 'gbr',
  us: 'usa',
  va: 'vat',
  ww: 'zzz',
  ym: 'yem',
})

/** The codes the importer's map names as aliases of another ("maps to same as"). */
export const COUNTRY_CODE_ALIASES = Object.freeze(['ix', 'px'])

/**
 * The legacy code of an ISO3 id: its one code that is no alias. Throws when
 * it has none or more than one, as the importer never moves such a list.
 *
 * @param {string} iso3
 * @param {Readonly<Record<string, string>>} [map] the legacy code map (tests)
 * @param {readonly string[]} [aliases] its alias codes (tests)
 * @returns {string}
 */
export function legacyCountryCode(iso3, map = COUNTRY_CODE_MAP, aliases = COUNTRY_CODE_ALIASES) {
  const codes = Object.entries(map)
    .filter(([code, id]) => id === iso3 && !aliases.includes(code))
    .map(([code]) => code)
  if (codes.length !== 1) {
    throw new Error(`No single legacy country code for '${iso3}' (${codes.join(', ') || 'none'})`)
  }
  return /** @type {string} */ (codes[0])
}
