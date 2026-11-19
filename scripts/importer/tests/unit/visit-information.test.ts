import { describe, expect, it } from 'vitest';
import {
  VISIT_INFORMATION_KEYS,
  splitVisitInformation,
  visitInformationUuidName,
} from '../../src/utils/visit-information.js';

describe('splitVisitInformation (M16 D1)', () => {
  it("moves a monument's texts and contact block as written", () => {
    expect(
      splitVisitInformation(
        {
          how_to_reach: 'Bus 12.',
          info: 'Open daily. Entrance fee: 5 EUR.',
          contact: 'Information: Visitor Centre, Tel: 123',
          monument_contact: {
            address: 'Via Roma 1',
            institution: 'Soprintendenza',
            phone: '+39 06 1',
            fax: '+39 06 2',
            email: 'a@b.it',
            website: 'https://b.it',
          },
          copyright: 'MWNF',
        },
        'item'
      )
    ).toEqual({
      extra: { copyright: 'MWNF' },
      fields: {
        how_to_reach: 'Bus 12.',
        practical_information: 'Open daily. Entrance fee: 5 EUR.',
        contact: 'Information: Visitor Centre, Tel: 123',
        address: 'Via Roma 1',
        institution: 'Soprintendenza',
        phone: '+39 06 1',
        fax: '+39 06 2',
        email: 'a@b.it',
        website: 'https://b.it',
      },
      kept: [],
    });
  });

  it('drops the responsible institution copy only when it equals the row own value', () => {
    expect(
      splitVisitInformation(
        {
          responsible_institution_org: 'Ministry of Culture',
          monument_contact: { responsible_institution: 'Ministry of Culture' },
        },
        'item'
      )
    ).toEqual({ extra: { responsible_institution_org: 'Ministry of Culture' }, fields: {}, kept: [] });

    expect(
      splitVisitInformation(
        {
          responsible_institution_org: 'Ministry of Culture',
          monument_contact: { responsible_institution: 'Another body', address: 'Main Square' },
        },
        'item'
      )
    ).toEqual({
      extra: {
        responsible_institution_org: 'Ministry of Culture',
        monument_contact: { responsible_institution: 'Another body' },
      },
      fields: { address: 'Main Square' },
      kept: ['monument_contact.responsible_institution'],
    });
  });

  it("moves a partner's how to reach and opening hours, and nothing else", () => {
    expect(
      splitVisitInformation({ how_to_reach: 'Metro 2.', opening_hours: '10-18', info: 'x' }, 'partner')
    ).toEqual({
      extra: { info: 'x' },
      fields: { how_to_reach: 'Metro 2.', opening_hours: '10-18' },
      kept: [],
    });
  });

  it('keeps a collection contacts list and any value that is not a text', () => {
    expect(
      splitVisitInformation(
        { how_to_reach: 'Ferry.', contact: ['not', 'a', 'text'], contacts: [{ name: 'Office' }] },
        'collection'
      )
    ).toEqual({
      extra: { contact: ['not', 'a', 'text'], contacts: [{ name: 'Office' }] },
      fields: { how_to_reach: 'Ferry.' },
      kept: ['contact (not a text)'],
    });
  });

  it('keeps an empty text as written', () => {
    expect(splitVisitInformation({ how_to_reach: '' }, 'item')).toEqual({
      extra: null,
      fields: { how_to_reach: '' },
      kept: [],
    });
  });

  it('lists each owner keys', () => {
    expect(VISIT_INFORMATION_KEYS).toEqual({
      item: ['how_to_reach', 'info', 'contact', 'monument_contact'],
      collection: ['how_to_reach', 'info', 'contact'],
      partner: ['how_to_reach', 'opening_hours'],
    });
  });

  it('names a visit information by owner, language and context', () => {
    expect(visitInformationUuidName('partner', 'p-1', 'eng', 'c-1')).toBe(
      'visit_information:partner:p-1:eng:c-1'
    );
  });
});
