import { describe, expect, it } from 'vitest'
import { partnerColumnsSelect, restorePartnerColumns, withPartnerColumns } from '../../../shared/partner-columns.mjs'

const row = (fields: Record<string, unknown>) => ({
  partner_columns_contact_1: null,
  partner_columns_contact_2: null,
  partner_columns_featured: 0,
  partner_columns_city: null,
  partner_columns_also_known_as: null,
  ...fields,
})

describe('withPartnerColumns (M16 D2)', () => {
  it('gives the contacts back with only their fields, in MySQL JSON key order', () => {
    const extra = withPartnerColumns(
      null,
      row({
        partner_columns_contact_1: JSON.stringify({ name: 'Ana', title: 'Curator', email: null, phone: '1', fax: null }),
        partner_columns_contact_2: { name: null, title: null, email: null, phone: null, fax: '+1 2' },
      })
    ) as Record<string, Record<string, unknown>>
    expect(extra).toEqual({ contact_person_1: { name: 'Ana', title: 'Curator', phone: '1' }, contact_person_2: { fax: '+1 2' } })
    expect(Object.keys(extra.contact_person_1!)).toEqual(['name', 'phone', 'title'])
  })

  it('gives the flag, city and other name back', () => {
    expect(
      withPartnerColumns('{"region": "X"}', row({ partner_columns_featured: 1, partner_columns_city: 'Roma', partner_columns_also_known_as: 'Old' }))
    ).toEqual({ city: 'Roma', region: 'X', ex_name: 'Old', portal_display: 'y' })
  })

  it('returns extra as it came when there is nothing to give back', () => {
    expect(withPartnerColumns(null, row({}))).toBeNull()
    expect(withPartnerColumns('{"a": 1}', row({}))).toBe('{"a": 1}')
  })

  it('restores in place and drops the columns', () => {
    expect(restorePartnerColumns([{ extra: null, ...row({ partner_columns_city: 'Alger' }) }])).toEqual([
      { extra: { city: 'Alger' } },
    ])
  })

  it("selects the partner's contacts, flag and city next to the translation", () => {
    const sql = partnerColumnsSelect('pt')
    expect(sql).toContain('FROM partner_contacts pc WHERE pc.partner_id = pt.partner_id AND pc.display_order = 1')
    expect(sql).toContain('own_partner.featured FROM partners own_partner WHERE own_partner.id = pt.partner_id')
    expect(sql).toContain('pt.also_known_as AS partner_columns_also_known_as')
  })
})
