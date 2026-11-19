import { describe, expect, it } from 'vitest';
import {
  PARTNER_COLUMN_KEYS,
  partnerContactUuidName,
  splitPartnerColumns,
} from '../../src/utils/partner-columns.js';

const person = { name: 'Ana Ruiz', title: 'Curator', email: 'a@b.es' };

describe('splitPartnerColumns (M16 D2)', () => {
  it("moves a partner's duplicated fields once, and each translation's other name", () => {
    expect(
      splitPartnerColumns([
        {
          id: 't-eng',
          extra: { contact_person_1: person, portal_display: 'y', partner_category: 'Museums', city: 'Roma', ex_name: 'Old name', region: 'X' },
        },
        { id: 't-ita', extra: { contact_person_1: person, portal_display: 'y', partner_category: 'Museums', city: 'Roma' } },
      ])
    ).toEqual({
      partner: { category: 'museums', featured: true, city: 'Roma' },
      contacts: [{ display_order: 1, fields: person }],
      translations: [
        { id: 't-eng', extra: { region: 'X' }, also_known_as: 'Old name' },
        { id: 't-ita', extra: null },
      ],
      kept: [],
    });
  });

  it('keeps a partner field the translations disagree on', () => {
    const split = splitPartnerColumns([
      { id: 'a', extra: { city: 'Roma' } },
      { id: 'b', extra: { city: 'Rome' } },
    ]);
    expect(split.partner).toEqual({});
    expect(split.translations).toEqual([
      { id: 'a', extra: { city: 'Roma' } },
      { id: 'b', extra: { city: 'Rome' } },
    ]);
    expect(split.kept).toEqual(['city (differs between translations)']);
  });

  it('keeps contact person 2 at its own position when there is no 1, and n is not featured', () => {
    const split = splitPartnerColumns([{ id: 'a', extra: { contact_person_2: { fax: '+1 2' }, portal_display: 'n' } }]);
    expect(split.contacts).toEqual([{ display_order: 2, fields: { fax: '+1 2' } }]);
    expect(split.partner).toEqual({ featured: false });
  });

  it('keeps an unknown category and a contact with an unknown field', () => {
    const split = splitPartnerColumns([
      { id: 'a', extra: { partner_category: 'shops', contact_person_1: { name: 'X', mobile: '1' } } },
    ]);
    expect(split.partner).toEqual({});
    expect(split.contacts).toEqual([]);
    expect(split.kept).toEqual(['contact_person_1 (fields mobile)', 'partner_category ("shops")']);
  });

  it('lists the keys and names a contact by partner and position', () => {
    expect(PARTNER_COLUMN_KEYS).toEqual([
      'contact_person_1',
      'contact_person_2',
      'partner_category',
      'portal_display',
      'city',
      'ex_name',
    ]);
    expect(partnerContactUuidName('p-1', 2)).toBe('partner_contact:p-1:2');
  });
});
