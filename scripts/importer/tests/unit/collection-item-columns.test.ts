import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ITEM_COLUMN_KEYS,
  placementUuidName,
  splitCollectionItemColumns,
} from '../../src/utils/collection-item-columns.js';

describe('splitCollectionItemColumns (M16 C1)', () => {
  it('moves the variant numbers as written and drops n when it equals display_order', () => {
    expect(splitCollectionItemColumns({ n: 3, n2: 2, parent_n2: 1, detail_n: 1 }, 3, null)).toEqual(
      {
        extra: null,
        columns: { variant_order: 2, parent_variant_order: 1 },
        kept: [],
      }
    );
  });

  it('turns a JSON null variant into NULL', () => {
    expect(splitCollectionItemColumns({ n: 1, n2: null }, 1, null)).toEqual({
      extra: null,
      columns: { variant_order: null },
      kept: [],
    });
  });

  it('keeps n when it differs from display_order, and detail_n when it is not 1', () => {
    expect(splitCollectionItemColumns({ n: 4, detail_n: 2 }, 3, null)).toEqual({
      extra: { n: 4, detail_n: 2 },
      columns: {},
      kept: ['n (4 differs from display_order 3)', 'detail_n (2, not 1)'],
    });
  });

  it('maps curator_status Y and N, and keeps any other value', () => {
    expect(splitCollectionItemColumns({ curator_status: 'Y' }, null, null).columns).toEqual({
      curator_selected: true,
    });
    expect(splitCollectionItemColumns({ curator_status: 'N' }, null, null).columns).toEqual({
      curator_selected: false,
    });
    expect(splitCollectionItemColumns({ curator_status: 'X' }, null, null)).toEqual({
      extra: { curator_status: 'X' },
      columns: {},
      kept: ['curator_status ("X", not Y or N)'],
    });
  });

  it('moves the picture only once it resolves', () => {
    const extra = { picture: 'sharing_history/sh_objects/awe/rm/46/1.jpg' };
    expect(splitCollectionItemColumns(extra, null, 'pic-1')).toEqual({
      extra: null,
      columns: { picture_item_id: 'pic-1' },
      kept: [],
    });
    expect(splitCollectionItemColumns(extra, null, null)).toEqual({
      extra,
      columns: {},
      kept: [
        'picture ("sharing_history/sh_objects/awe/rm/46/1.jpg" resolves to no picture of the item)',
      ],
    });
  });

  it('leaves the other keys in extra', () => {
    expect(
      splitCollectionItemColumns({ n: 1, n2: 1, justifications: { en: 'Why' } }, 1, null)
    ).toEqual({
      extra: { justifications: { en: 'Why' } },
      columns: { variant_order: 1 },
      kept: [],
    });
  });

  it('covers the C1 keys', () => {
    expect(COLLECTION_ITEM_COLUMN_KEYS).toEqual([
      'n',
      'n2',
      'parent_n2',
      'detail_n',
      'curator_status',
      'picture',
    ]);
  });

  it('names a placement by its collection and item', () => {
    expect(placementUuidName('c-1', 'i-1')).toBe('collection_item:c-1:i-1');
  });
});
