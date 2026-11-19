import { describe, expect, it } from 'vitest'
import {
  VISIT_INFORMATION_COLUMN,
  restoreVisitInformation,
  visitInformationSelect,
  withVisitInformation,
} from '../../../shared/visit-information.mjs'

const visit = (fields: Record<string, string | null>) => ({
  how_to_reach: null,
  practical_information: null,
  contact: null,
  opening_hours: null,
  address: null,
  institution: null,
  phone: null,
  fax: null,
  email: null,
  website: null,
  ...fields,
})

describe('withVisitInformation (M16 D1)', () => {
  it('gives each text back under its legacy key, in MySQL JSON key order', () => {
    const extra = withVisitInformation('{"copyright": "MWNF"}', {
      [VISIT_INFORMATION_COLUMN]: JSON.stringify(
        visit({ how_to_reach: 'Bus 12.', practical_information: 'Open daily.', contact: 'Tel: 1' })
      ),
    })
    expect(extra).toEqual({ copyright: 'MWNF', how_to_reach: 'Bus 12.', info: 'Open daily.', contact: 'Tel: 1' })
    expect(Object.keys(extra as object)).toEqual(['info', 'contact', 'copyright', 'how_to_reach'])
  })

  it('puts the contact parts back inside monument_contact, in key order', () => {
    const extra = withVisitInformation(null, {
      [VISIT_INFORMATION_COLUMN]: visit({ address: 'Via Roma 1', phone: '1', institution: 'Soprintendenza' }),
    }) as Record<string, unknown>
    expect(extra.monument_contact).toEqual({ address: 'Via Roma 1', institution: 'Soprintendenza', phone: '1' })
    expect(Object.keys(extra.monument_contact as object)).toEqual(['phone', 'address', 'institution'])
  })

  it('restores the responsible institution from the row own value', () => {
    expect(
      withVisitInformation({ responsible_institution_org: 'Ministry' }, { [VISIT_INFORMATION_COLUMN]: null })
    ).toEqual({
      monument_contact: { responsible_institution: 'Ministry' },
      responsible_institution_org: 'Ministry',
    })
  })

  it('keeps an empty text, and returns extra as it came when there is nothing', () => {
    expect(withVisitInformation(null, { [VISIT_INFORMATION_COLUMN]: visit({ how_to_reach: '' }) })).toEqual({
      how_to_reach: '',
    })
    expect(withVisitInformation(null, { [VISIT_INFORMATION_COLUMN]: null })).toBeNull()
    expect(withVisitInformation('{"a": 1}', { [VISIT_INFORMATION_COLUMN]: null })).toBe('{"a": 1}')
  })

  it("gives a partner's opening hours back", () => {
    expect(
      withVisitInformation(null, { [VISIT_INFORMATION_COLUMN]: visit({ opening_hours: '10-18' }) })
    ).toEqual({ opening_hours: '10-18' })
  })
})

describe('restoreVisitInformation', () => {
  it('restores in place and drops the column', () => {
    const rows = restoreVisitInformation([{ extra: null, [VISIT_INFORMATION_COLUMN]: visit({ contact: 'x' }) }])
    expect(rows).toEqual([{ extra: { contact: 'x' } }])
  })
})

describe('visitInformationSelect', () => {
  it("selects the owner's row in the translation's language and context", () => {
    const sql = visitInformationSelect('pt', 'partner_id')
    expect(sql).toContain('FROM visit_information vi')
    expect(sql).toContain('vi.partner_id = pt.partner_id AND vi.language_id = pt.language_id')
    expect(sql).toContain('vi.context_id = pt.context_id')
    expect(sql.endsWith(`AS ${VISIT_INFORMATION_COLUMN}`)).toBe(true)
  })
})
