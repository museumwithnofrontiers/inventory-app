/**
 * Visit information (M16 D1, #2645; ADR 006): the `extra` keys of item,
 * collection and partner translations that move to the shared
 * `visit_information` model, as written. The ruling on #2645 sets the mapping:
 *
 * - `how_to_reach` → `how_to_reach`;
 * - `info` → `practical_information`, whole: it mixes opening hours, fees,
 *   access and designations, and splitting it would derive text from text;
 * - `contact` → `contact`;
 * - `opening_hours` (partners) → `opening_hours`;
 * - `monument_contact.{address, institution, phone, fax, email, website}` →
 *   the field of the same name. `monument_contact.responsible_institution`
 *   is dropped when it equals the row's own `responsible_institution_org`
 *   (38 of 38 rows): the exporters restore it from there.
 *
 * Anything else stays in `extra` and is reported: a value that is not a
 * text, a `monument_contact` sub-key with no field, a responsible institution
 * that differs. The exporters give the keys back
 * (`scripts/exporters/shared/visit-information.mjs`), so keep the two in step.
 */

export type VisitOwner = 'item' | 'collection' | 'partner';

export const VISIT_INFORMATION_FIELDS = [
  'how_to_reach',
  'opening_hours',
  'contact',
  'address',
  'institution',
  'practical_information',
  'phone',
  'fax',
  'email',
  'website',
] as const;

export type VisitInformationField = (typeof VISIT_INFORMATION_FIELDS)[number];
export type VisitInformationFields = Partial<Record<VisitInformationField, string>>;

/** The top-level keys each owner's translations hold. */
export const VISIT_INFORMATION_KEYS: Readonly<Record<VisitOwner, readonly string[]>> = {
  item: ['how_to_reach', 'info', 'contact', 'monument_contact'],
  collection: ['how_to_reach', 'info', 'contact'],
  partner: ['how_to_reach', 'opening_hours'],
};

const TOP_LEVEL: Readonly<Record<string, VisitInformationField>> = {
  how_to_reach: 'how_to_reach',
  info: 'practical_information',
  contact: 'contact',
  opening_hours: 'opening_hours',
};

const CONTACT_PARTS: Readonly<Record<string, VisitInformationField>> = {
  address: 'address',
  institution: 'institution',
  phone: 'phone',
  fax: 'fax',
  email: 'email',
  website: 'website',
};

export interface SplitVisitInformation {
  /** The extra without the moved keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** Field → text, for the keys moved. */
  fields: VisitInformationFields;
  /** Keys (or `monument_contact.<part>`) left in `extra`, each with the reason. */
  kept: string[];
}

/** Splits an owner's translation extra into visit information fields and the rest. */
export function splitVisitInformation(
  extra: Record<string, unknown>,
  owner: VisitOwner
): SplitVisitInformation {
  const fields: VisitInformationFields = {};
  const kept: string[] = [];
  const rest: Record<string, unknown> = { ...extra };
  const moved = new Set<string>();

  for (const key of VISIT_INFORMATION_KEYS[owner]) {
    if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
    const value = extra[key];

    if (key === 'monument_contact') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        kept.push('monument_contact (not an object)');
        continue;
      }
      const left: Record<string, unknown> = {};
      for (const [part, text] of Object.entries(value as Record<string, unknown>)) {
        const field = CONTACT_PARTS[part];
        if (field !== undefined && typeof text === 'string') {
          fields[field] = text;
        } else if (
          part === 'responsible_institution' &&
          typeof text === 'string' &&
          text === extra.responsible_institution_org
        ) {
          // The row's own responsible_institution_org holds it.
        } else {
          left[part] = text;
          kept.push(`monument_contact.${part}`);
        }
      }
      if (Object.keys(left).length > 0) rest.monument_contact = left;
      else delete rest.monument_contact;
      continue;
    }

    const field = TOP_LEVEL[key];
    if (field === undefined || typeof value !== 'string') {
      kept.push(`${key} (not a text)`);
      continue;
    }
    fields[field] = value;
    moved.add(key);
  }
  for (const key of moved) Reflect.deleteProperty(rest, key);

  return { extra: Object.keys(rest).length > 0 ? rest : null, fields, kept };
}

/** The deterministic-uuid name of an owner's visit information in one language and context. */
export function visitInformationUuidName(
  owner: VisitOwner,
  ownerId: string,
  languageId: string,
  contextId: string
): string {
  return `visit_information:${owner}:${ownerId}:${languageId}:${contextId}`;
}
