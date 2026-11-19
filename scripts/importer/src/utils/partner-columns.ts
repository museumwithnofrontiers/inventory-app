/**
 * The partner fields that leave `partner_translations.extra` (M16 D2, #2646;
 * decision 7; the ruling on #2646). The importer duplicated the partner-level
 * ones on every translation of a partner, so they move per partner, and only
 * when every translation agrees; a disagreement stays in `extra`, reported.
 *
 * - `contact_person_1`, `contact_person_2` → `partner_contacts` (display
 *   order 1, 2), with `name`, `title`, `email`, `phone`, `fax` as written;
 * - `partner_category` → `partners.category`, one of six values (the one
 *   `Museums` joins `museums`, decision 7);
 * - `portal_display` → `partners.featured` (`y` true, `n` false);
 * - `city` → `partners.city`, as written;
 * - `ex_name` (per translation) → `partner_translations.also_known_as`.
 *
 * The exporters give the keys back (`scripts/exporters/shared/partner-columns.mjs`).
 */

export const PARTNER_COLUMN_KEYS: readonly string[] = [
  'contact_person_1',
  'contact_person_2',
  'partner_category',
  'portal_display',
  'city',
  'ex_name',
];

export const PARTNER_CATEGORIES: readonly string[] = [
  'museums',
  'archives',
  'culturalheritageauthorities',
  'libraries',
  'universities',
  'others',
];

const CONTACT_FIELDS = ['name', 'title', 'email', 'phone', 'fax'] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

export interface PartnerTranslationSource {
  id: string;
  extra: Record<string, unknown>;
}

export interface SplitPartnerColumns {
  partner: { category?: string; featured?: boolean; city?: string };
  contacts: Array<{ display_order: number; fields: Partial<Record<ContactField, string>> }>;
  translations: Array<{ id: string; extra: Record<string, unknown> | null; also_known_as?: string }>;
  kept: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The one value every translation that has `key` holds, or undefined when they differ. */
function agreed(rows: readonly PartnerTranslationSource[], key: string): unknown {
  const values = rows
    .filter((row) => Object.prototype.hasOwnProperty.call(row.extra, key))
    .map((row) => JSON.stringify(row.extra[key]));
  if (values.length === 0 || new Set(values).size !== 1) return undefined;
  return JSON.parse(values[0]!) as unknown;
}

/** Splits one partner's translations into its columns, contacts and what stays. */
export function splitPartnerColumns(rows: readonly PartnerTranslationSource[]): SplitPartnerColumns {
  const partner: SplitPartnerColumns['partner'] = {};
  const contacts: SplitPartnerColumns['contacts'] = [];
  const kept: string[] = [];
  const moved = new Set<string>();
  const has = (key: string): boolean =>
    rows.some((row) => Object.prototype.hasOwnProperty.call(row.extra, key));

  for (const n of [1, 2]) {
    const key = `contact_person_${n}`;
    if (!has(key)) continue;
    const value = agreed(rows, key);
    if (!isObject(value)) {
      kept.push(`${key} (${value === undefined ? 'differs between translations' : 'not an object'})`);
      continue;
    }
    const unknown = Object.keys(value).filter(
      (field) => !(CONTACT_FIELDS as readonly string[]).includes(field) || typeof value[field] !== 'string'
    );
    if (unknown.length > 0) {
      kept.push(`${key} (fields ${unknown.join(', ')})`);
      continue;
    }
    contacts.push({ display_order: n, fields: value as Partial<Record<ContactField, string>> });
    moved.add(key);
  }

  if (has('partner_category')) {
    const value = agreed(rows, 'partner_category');
    const category = typeof value === 'string' ? value.toLowerCase() : undefined;
    if (category !== undefined && PARTNER_CATEGORIES.includes(category)) {
      partner.category = category;
      moved.add('partner_category');
    } else {
      kept.push(`partner_category (${value === undefined ? 'differs between translations' : JSON.stringify(value)})`);
    }
  }

  if (has('portal_display')) {
    const value = agreed(rows, 'portal_display');
    const flag = typeof value === 'string' ? value.toLowerCase() : undefined;
    if (flag === 'y' || flag === 'n') {
      partner.featured = flag === 'y';
      moved.add('portal_display');
    } else {
      kept.push(`portal_display (${value === undefined ? 'differs between translations' : JSON.stringify(value)})`);
    }
  }

  if (has('city')) {
    const value = agreed(rows, 'city');
    if (typeof value === 'string') {
      partner.city = value;
      moved.add('city');
    } else {
      kept.push(`city (${value === undefined ? 'differs between translations' : 'not a text'})`);
    }
  }

  const translations = rows.map((row) => {
    const rest: Record<string, unknown> = { ...row.extra };
    for (const key of moved) Reflect.deleteProperty(rest, key);
    let alsoKnownAs: string | undefined;
    if (typeof row.extra.ex_name === 'string') {
      alsoKnownAs = row.extra.ex_name;
      Reflect.deleteProperty(rest, 'ex_name');
    } else if (Object.prototype.hasOwnProperty.call(row.extra, 'ex_name')) {
      kept.push(`ex_name of ${row.id} (not a text)`);
    }
    return {
      id: row.id,
      extra: Object.keys(rest).length > 0 ? rest : null,
      ...(alsoKnownAs !== undefined ? { also_known_as: alsoKnownAs } : {}),
    };
  });

  return { partner, contacts, translations, kept };
}

/** The deterministic-uuid name of a partner's contact at a position. */
export function partnerContactUuidName(partnerId: string, displayOrder: number): string {
  return `partner_contact:${partnerId}:${displayOrder}`;
}
