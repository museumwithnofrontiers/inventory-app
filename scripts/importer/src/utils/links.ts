/**
 * The links that leave `extra` for the Link model (M16 F3, #2653):
 *
 * - `item_translations.extra.catalogue_holding_link`: the object's page in its
 *   holder's online catalogue, one per item and language → a `catalogue` link
 *   of the item, in that language;
 * - `partner_translations.extra.urls[]` ({url, title?}): every translation of
 *   a partner carries the same list, so they are the partner's → `website`
 *   links of the partner, in list order, with no language;
 * - `publication_editions.extra.shop_links[]` ({name, url}) → `shop` links of
 *   the edition, in list order, the name as the title.
 *
 * Values are copied as stored. A key that isn't the expected shape stays in
 * `extra` (and is reported). The exporters give each key back from the links
 * (`scripts/exporters/shared/links.mjs`).
 */

export type LinkOwnerType = 'item' | 'collection' | 'partner' | 'publication_edition';

export interface LinkData {
  linkable_type: LinkOwnerType;
  linkable_id: string;
  language_id: string | null;
  type:
    | 'video'
    | 'audio'
    | 'document'
    | 'website'
    | 'shop'
    | 'catalogue'
    | 'further_reading'
    | 'virtual_visit';
  title: string | null;
  url: string;
  display_order: number;
  backward_compatibility: string;
}

export interface ExtraUpdate {
  id: string;
  extra: Record<string, unknown> | null;
}

export interface LinkPlan {
  links: LinkData[];
  updates: ExtraUpdate[];
  /** Rows left as they are, with the reason. */
  kept: Array<{ id: string; reason: string }>;
}

export interface CatalogueRow {
  id: string;
  item_id: string;
  language_id: string;
  backward_compatibility: string | null;
  extra: Record<string, unknown>;
}

export interface PartnerUrlRow {
  id: string;
  partner_id: string;
  partner_key: string | null;
  extra: Record<string, unknown>;
}

export interface ShopLinkRow {
  id: string;
  backward_compatibility: string | null;
  extra: Record<string, unknown>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function without(extra: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const rest = Object.fromEntries(Object.entries(extra).filter(([name]) => name !== key));
  return Object.keys(rest).length > 0 ? rest : null;
}

/** Each object translation's catalogue page → a catalogue link of the item. */
export function planCatalogueLinks(rows: readonly CatalogueRow[]): LinkPlan {
  const plan: LinkPlan = { links: [], updates: [], kept: [] };
  for (const row of rows) {
    const url = row.extra['catalogue_holding_link'];
    if (typeof url !== 'string' || url.trim() === '') {
      plan.kept.push({ id: row.id, reason: 'catalogue_holding_link is not a text' });
      continue;
    }
    plan.links.push({
      linkable_type: 'item',
      linkable_id: row.item_id,
      language_id: row.language_id,
      type: 'catalogue',
      title: null,
      url,
      display_order: 1,
      // An object's translations share its legacy key: the language tells them apart.
      backward_compatibility: `${row.backward_compatibility ?? `item_translation:${row.id}`}:${row.language_id}:catalogue_holding_link`,
    });
    plan.updates.push({ id: row.id, extra: without(row.extra, 'catalogue_holding_link') });
  }
  return plan;
}

/** Entries of a `[{url, …}]` list, or null when one isn't that shape. */
function entries(
  value: unknown,
  titleKey: 'title' | 'name'
): Array<{ url: string; title: string | null }> | null {
  if (!Array.isArray(value)) return null;
  const out: Array<{ url: string; title: string | null }> = [];
  for (const entry of value) {
    if (!isObject(entry) || typeof entry['url'] !== 'string') return null;
    const extraKeys = Object.keys(entry).filter((key) => key !== 'url' && key !== titleKey);
    if (extraKeys.length > 0) return null;
    const title = entry[titleKey];
    if (title !== undefined && typeof title !== 'string') return null;
    out.push({ url: entry['url'], title: title ?? null });
  }
  return out;
}

/** A partner's website list (the same on each of its translations) → its website links. */
export function planPartnerUrlLinks(rows: readonly PartnerUrlRow[]): LinkPlan {
  const plan: LinkPlan = { links: [], updates: [], kept: [] };
  const byPartner = new Map<string, PartnerUrlRow[]>();
  for (const row of rows)
    byPartner.set(row.partner_id, [...(byPartner.get(row.partner_id) ?? []), row]);

  for (const [partnerId, group] of byPartner) {
    const lists = new Set(group.map((row) => JSON.stringify(row.extra['urls'])));
    const list = entries(group[0]!.extra['urls'], 'title');
    if (lists.size !== 1 || list === null) {
      for (const row of group) {
        plan.kept.push({
          id: row.id,
          reason:
            lists.size !== 1
              ? "the partner's translations list other urls"
              : 'urls is not a {url, title} list',
        });
      }
      continue;
    }
    const key = group[0]!.partner_key ?? `partner:${partnerId}`;
    list.forEach((entry, index) => {
      plan.links.push({
        linkable_type: 'partner',
        linkable_id: partnerId,
        language_id: null,
        type: 'website',
        title: entry.title,
        url: entry.url,
        display_order: index + 1,
        backward_compatibility: `${key}:url:${index + 1}`,
      });
    });
    for (const row of group) plan.updates.push({ id: row.id, extra: without(row.extra, 'urls') });
  }
  return plan;
}

/** An edition's shop list → its shop links. */
export function planShopLinks(rows: readonly ShopLinkRow[]): LinkPlan {
  const plan: LinkPlan = { links: [], updates: [], kept: [] };
  for (const row of rows) {
    const list = entries(row.extra['shop_links'], 'name');
    if (list === null) {
      plan.kept.push({ id: row.id, reason: 'shop_links is not a {name, url} list' });
      continue;
    }
    const key = row.backward_compatibility ?? `publication_edition:${row.id}`;
    list.forEach((entry, index) => {
      plan.links.push({
        linkable_type: 'publication_edition',
        linkable_id: row.id,
        language_id: null,
        type: 'shop',
        title: entry.title,
        url: entry.url,
        display_order: index + 1,
        backward_compatibility: `${key}:shop:${index + 1}`,
      });
    });
    plan.updates.push({ id: row.id, extra: without(row.extra, 'shop_links') });
  }
  return plan;
}
