/**
 * Code Mappings for Legacy Data Import
 *
 * These mappings convert legacy 2-character codes to ISO standard 3-character codes.
 * SOURCE: Generated from mwnf3.langs and mwnf3.countries tables
 */

/**
 * Map LEGACY 2-character language codes (from mwnf3.langs) to ISO 639-3 codes
 */
export const LANGUAGE_CODE_MAP: Record<string, string> = {
  ar: 'ara', // Arabic - العربية
  ch: 'zho', // Chinese (legacy uses 'ch' instead of ISO 'zh')
  cs: 'ces', // Czech
  de: 'deu', // German - Deutsch
  el: 'ell', // Greek - ελληνικά
  en: 'eng', // English
  es: 'spa', // Spanish - Español
  fa: 'fas', // Farsi/Persian - فارسی
  fr: 'fra', // French - Français
  he: 'heb', // Hebrew
  hr: 'hrv', // Croatian
  hu: 'hun', // Hungarian
  it: 'ita', // Italian - Italiano
  pt: 'por', // Portuguese - Português
  ru: 'rus', // Russian
  se: 'swe', // Swedish (legacy uses 'se' instead of ISO 'sv')
  si: 'slv', // Slovenian (legacy uses 'si' instead of ISO 'sl')
  tr: 'tur', // Turkish - Türkçe
};

/**
 * Map LEGACY 2-character country codes (from mwnf3.countries) to ISO 3166-1 alpha-3 codes
 * SOURCE: Complete mapping from mwnf3.countries table
 */
export const COUNTRY_CODE_MAP: Record<string, string> = {
  ab: 'alb', // Albania
  ag: 'arg', // Argentina
  al: 'aus', // Australia
  at: 'aut', // Austria
  az: 'aze', // Azerbaijan
  be: 'bel', // Belgium
  bg: 'bgd', // Bangladesh
  bh: 'bhr', // Bahrain
  bl: 'blr', // Belarus
  br: 'bra', // Brazil
  bs: 'bih', // Bosnia-Herzegovina
  bu: 'bgr', // Bulgaria
  ca: 'can', // Canada
  ch: 'chn', // China
  co: 'com', // Comoros
  cy: 'cyp', // Cyprus
  cz: 'cze', // Czech Republic
  de: 'deu', // Germany
  dj: 'dji', // Djibouti
  dn: 'dnk', // Denmark
  dz: 'dza', // Algeria
  eg: 'egy', // Egypt
  es: 'esp', // Spain
  et: 'est', // Estonia
  fn: 'fin', // Finland
  fr: 'fra', // France
  ge: 'geo', // Georgia
  gr: 'grc', // Greece
  hr: 'hrv', // Croatia
  hu: 'hun', // Hungary
  ia: 'irn', // Iran
  in: 'ind', // India
  iq: 'irq', // Iraq
  ir: 'irl', // Ireland
  is: 'isr', // Israel
  it: 'ita', // Italy
  ix: 'ita', // Italy (Sicily) - maps to same as 'it'
  jo: 'jor', // Jordan
  jp: 'jpn', // Japan
  kw: 'kwt', // Kuwait
  lb: 'lbn', // Lebanon
  ln: 'ltu', // Lithuania
  lt: 'lva', // Latvia
  lx: 'lux', // Luxembourg
  ly: 'lby', // Libya
  ma: 'mar', // Morocco
  mc: 'mkd', // Macedonia (North Macedonia)
  md: 'mda', // Moldova
  ml: 'mlt', // Malta
  mn: 'mne', // Montenegro
  mt: 'mrt', // Mauritania
  my: 'mys', // Malaysia
  nt: 'nld', // Netherlands
  nw: 'nor', // Norway
  on: 'omn', // Oman
  pa: 'pse', // Palestinian Authority
  pd: 'xxx', // Public domain (no country) - special code
  pl: 'pol', // Poland
  pt: 'prt', // Portugal
  px: 'pse', // Palestine - special code, maps to same as 'pa'
  qt: 'qat', // Qatar
  rm: 'rou', // Romania
  rs: 'rus', // Russia
  sa: 'sau', // Saudi Arabia
  sb: 'srb', // Serbia
  sd: 'sdn', // Sudan
  se: 'swe', // Sweden
  sf: 'zaf', // South Africa
  si: 'svn', // Slovenia
  sl: 'svk', // Slovak Republic
  so: 'som', // Somalia
  sw: 'che', // Switzerland
  sy: 'syr', // Syria
  tn: 'tun', // Tunisia
  tr: 'tur', // Turkey
  ua: 'are', // United Arab Emirates
  uc: 'ukr', // Ukraine
  uk: 'gbr', // United Kingdom
  us: 'usa', // United States of America
  va: 'vat', // Vatican city
  ww: 'zzz', // Other - special code for no specific country
  ym: 'yem', // Yemen
};

/**
 * Map legacy 2-character language code to 3-character ISO 639-3 code
 * @throws Error if code is not found
 */
export function mapLanguageCode(legacyCode: string): string {
  const mapped = LANGUAGE_CODE_MAP[legacyCode];
  if (!mapped) {
    throw new Error(
      `Unknown language code '${legacyCode}'. Add mapping to LANGUAGE_CODE_MAP in code-mappings.ts`
    );
  }
  return mapped;
}

/**
 * A language-keyed map from legacy, keyed by language id (`{ en: … }` →
 * `{ eng: … }`), as every language key inside `extra` is (#2394). A key
 * with no mapping is left out and passed to `onUnknown`, which warns: the
 * importers' convention for a language they don't know.
 */
export function keyByLanguageId<T>(
  map: Record<string, T>,
  onUnknown: (legacyCode: string) => void
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [legacyCode, value] of Object.entries(map)) {
    const languageId = LANGUAGE_CODE_MAP[legacyCode];
    if (!languageId) {
      onUnknown(legacyCode);
      continue;
    }
    out[languageId] = value;
  }
  return out;
}

/**
 * Map legacy 2-character country code to 3-character ISO 3166-1 alpha-3 code
 * @throws Error if code is not found
 */
export function mapCountryCode(legacyCode: string): string {
  const mapped = COUNTRY_CODE_MAP[legacyCode];
  if (!mapped) {
    throw new Error(
      `Unknown country code '${legacyCode}'. Add mapping to COUNTRY_CODE_MAP in code-mappings.ts`
    );
  }
  return mapped;
}
