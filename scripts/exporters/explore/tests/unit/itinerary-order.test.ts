import { describe, expect, it } from 'vitest'

import { mysqlJsonOrder, withItineraryOrder } from '../../src/exporters/collection-exporter.js'

/**
 * M16 I2 (#2658): the importer no longer keeps legacy's `mn_order` on an
 * itinerary membership, since it only copied `display_order`. The package
 * still carries it, where the Explore site sorts an itinerary by it.
 */
describe('withItineraryOrder', () => {
  it('writes mn_order back from display_order, where MySQL would have stored it', () => {
    const stored = { desc_types: 'ET#1', tr_mn_desc: 'IAM;jo;II;3;a;en;1#1', location_id: 24, explore_monument_id: 798 }

    const rebuilt = withItineraryOrder(stored, 1)

    expect(JSON.stringify(rebuilt)).toBe(
      JSON.stringify({ mn_order: 1, desc_types: 'ET#1', tr_mn_desc: 'IAM;jo;II;3;a;en;1#1', location_id: 24, explore_monument_id: 798 })
    )
  })

  it('leaves a membership that is not an itinerary\'s as it is', () => {
    const location = { explore_monument_ids: [1, 2] }
    expect(withItineraryOrder(location, 3)).toBe(location)
    expect(withItineraryOrder(null, 3)).toBeNull()
  })

  it('adds nothing without a display order, and keeps an mn_order already there', () => {
    const noOrder = { explore_monument_id: 5 }
    expect(withItineraryOrder(noOrder, null)).toBe(noOrder)
    const old = { mn_order: 7, explore_monument_id: 5 }
    expect(withItineraryOrder(old, 7)).toBe(old)
  })
})

describe('mysqlJsonOrder', () => {
  it('orders keys by byte length, then by bytes', () => {
    expect(Object.keys(mysqlJsonOrder({ bb: 1, a: 1, ab: 1, é: 1, z: 1 }))).toEqual(['a', 'z', 'ab', 'bb', 'é'])
  })
})
