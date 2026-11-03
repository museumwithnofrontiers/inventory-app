import { describe, expect, it } from 'vitest'

import { monumentContact } from '../../src/exporters/item-exporter.js'

// Legacy's monument sheet opens the visitor contact from "Contact Details"
// (database_item.php): the lines the importer keeps in extra.monument_contact.
describe('monumentContact', () => {
  it('keeps each line the record writes', () => {
    const extra = {
      monument_contact: { address: 'Via delle Quattro Fontane 13, Rome', phone: '+39 06 4814591', email: 'info@example.org' },
    }
    expect(monumentContact(extra)).toEqual({
      address: 'Via delle Quattro Fontane 13, Rome',
      phone: '+39 06 4814591',
      email: 'info@example.org',
    })
  })

  it('drops blank lines and anything else in extra', () => {
    expect(monumentContact({ monument_contact: { phone: ' ', fax: '+39 1', other: 'x' }, history: 'h' })).toEqual({
      fax: '+39 1',
    })
  })

  it('is null without a contact', () => {
    expect(monumentContact(null)).toBeNull()
    expect(monumentContact({ history: 'h' })).toBeNull()
    expect(monumentContact({ monument_contact: { phone: '' } })).toBeNull()
  })
})
