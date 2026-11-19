import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LinksImporter } from '../../src/importers/phase-11/links-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { planCatalogueLinks, planPartnerUrlLinks, planShopLinks } from '../../src/utils/links.js';

describe('planCatalogueLinks', () => {
  it("makes the object's catalogue page a link of the item, in the translation's language", () => {
    const plan = planCatalogueLinks([
      {
        id: 't1',
        item_id: 'i1',
        language_id: 'eng',
        backward_compatibility: 'mwnf3:objects:ISL:qa:Mus01:1:en',
        extra: { catalogue_holding_link: 'https://museum.example.org/1', binding_desc: 'x' },
      },
    ]);

    expect(plan.links).toEqual([
      {
        linkable_type: 'item',
        linkable_id: 'i1',
        language_id: 'eng',
        type: 'catalogue',
        title: null,
        url: 'https://museum.example.org/1',
        display_order: 1,
        backward_compatibility: 'mwnf3:objects:ISL:qa:Mus01:1:en:eng:catalogue_holding_link',
      },
    ]);
    expect(plan.updates).toEqual([{ id: 't1', extra: { binding_desc: 'x' } }]);
  });

  it('leaves a value that is not a text', () => {
    const plan = planCatalogueLinks([
      {
        id: 't1',
        item_id: 'i1',
        language_id: 'eng',
        backward_compatibility: null,
        extra: { catalogue_holding_link: 3 },
      },
    ]);
    expect(plan.links).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.kept).toHaveLength(1);
  });

  it("keeps the languages of an object's translations apart: they share its legacy key", () => {
    const row = (id: string, language: string) => ({
      id,
      item_id: 'i1',
      language_id: language,
      backward_compatibility: 'mwnf3:objects:EPM:at:Mus24:15',
      extra: { catalogue_holding_link: 'https://data.onb.ac.at/rec/AC14005879' },
    });
    const plan = planCatalogueLinks([row('t1', 'ara'), row('t2', 'eng')]);

    expect(plan.links.map((link) => [link.language_id, link.backward_compatibility])).toEqual([
      ['ara', 'mwnf3:objects:EPM:at:Mus24:15:ara:catalogue_holding_link'],
      ['eng', 'mwnf3:objects:EPM:at:Mus24:15:eng:catalogue_holding_link'],
    ]);
  });
});

describe('planPartnerUrlLinks', () => {
  const urls = [{ url: 'https://a.example.org/', title: 'A' }, { url: 'https://b.example.org/' }];

  it("makes a partner's list its website links, once, in list order, keeping a missing title missing", () => {
    const plan = planPartnerUrlLinks([
      {
        id: 'pt1',
        partner_id: 'p1',
        partner_key: 'mwnf3:museums:Mus01:pt',
        extra: { urls, source: 'mwnf3' },
      },
      { id: 'pt2', partner_id: 'p1', partner_key: 'mwnf3:museums:Mus01:pt', extra: { urls } },
    ]);

    expect(
      plan.links.map((link) => [link.title, link.url, link.display_order, link.language_id])
    ).toEqual([
      ['A', 'https://a.example.org/', 1, null],
      [null, 'https://b.example.org/', 2, null],
    ]);
    expect(plan.links[1]?.backward_compatibility).toBe('mwnf3:museums:Mus01:pt:url:2');
    expect(plan.updates).toEqual([
      { id: 'pt1', extra: { source: 'mwnf3' } },
      { id: 'pt2', extra: null },
    ]);
  });

  it('keeps the lists of a partner whose translations differ', () => {
    const plan = planPartnerUrlLinks([
      { id: 'pt1', partner_id: 'p1', partner_key: null, extra: { urls } },
      { id: 'pt2', partner_id: 'p1', partner_key: null, extra: { urls: [urls[0]] } },
    ]);
    expect(plan.links).toEqual([]);
    expect(plan.kept.map((kept) => kept.id)).toEqual(['pt1', 'pt2']);
  });

  it('keeps a list with an unknown key', () => {
    const plan = planPartnerUrlLinks([
      {
        id: 'pt1',
        partner_id: 'p1',
        partner_key: null,
        extra: { urls: [{ url: 'x', label: 'y' }] },
      },
    ]);
    expect(plan.links).toEqual([]);
    expect(plan.kept).toHaveLength(1);
  });
});

describe('planShopLinks', () => {
  it("makes an edition's shops its shop links, the name as the title", () => {
    const plan = planShopLinks([
      {
        id: 'e1',
        backward_compatibility: 'mwnf3:books:48:en:1:book:1',
        extra: {
          shop_links: [
            { url: 'https://www.amazon.com/x', name: 'Amazon' },
            { url: 'https://shop.example.org/x', name: 'Shop' },
          ],
          legacy_texts: { title: 'T' },
        },
      },
    ]);
    expect(
      plan.links.map((link) => [link.linkable_type, link.type, link.title, link.display_order])
    ).toEqual([
      ['publication_edition', 'shop', 'Amazon', 1],
      ['publication_edition', 'shop', 'Shop', 2],
    ]);
    expect(plan.updates).toEqual([{ id: 'e1', extra: { legacy_texts: { title: 'T' } } }]);
  });
});

describe('LinksImporter', () => {
  let context: ImportContext;
  let strategy: Record<string, ReturnType<typeof vi.fn>>;

  const logger: ILogger = {
    info: vi.fn(),
    warning: vi.fn(),
    skip: vi.fn(),
    error: vi.fn(),
    exception: vi.fn(),
    showProgress: vi.fn(),
    showSkipped: vi.fn(),
    showError: vi.fn(),
    showSummary: vi.fn(),
  };

  const legacyDb: ILegacyDatabase = {
    query: vi.fn().mockResolvedValue([]) as ILegacyDatabase['query'],
    execute: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = {
      findCatalogueLinkRows: vi.fn().mockResolvedValue([]),
      findPartnerUrlRows: vi.fn().mockResolvedValue([]),
      findShopLinkRows: vi.fn().mockResolvedValue([]),
      writeLink: vi.fn().mockResolvedValue('id'),
      setItemTranslationColumnsAsStoredById: vi.fn().mockResolvedValue(undefined),
      setExtraAsStoredById: vi.fn().mockResolvedValue(undefined),
    };
    context = {
      legacyDb,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('writes the links, then clears the keys', async () => {
    strategy.findCatalogueLinkRows!.mockResolvedValue([
      {
        id: 't1',
        item_id: 'i1',
        language_id: 'eng',
        backward_compatibility: 'k',
        extra: { catalogue_holding_link: 'https://x' },
      },
    ]);
    strategy.findShopLinkRows!.mockResolvedValue([
      {
        id: 'e1',
        backward_compatibility: 'e',
        extra: { shop_links: [{ url: 'https://s', name: 'S' }] },
      },
    ]);

    const result = await new LinksImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(strategy.writeLink).toHaveBeenCalledTimes(2);
    expect(strategy.setItemTranslationColumnsAsStoredById).toHaveBeenCalledWith('t1', {}, null);
    expect(strategy.setExtraAsStoredById).toHaveBeenCalledWith('publication_editions', 'e1', null);
  });

  it('keeps every key when a link fails', async () => {
    strategy.findCatalogueLinkRows!.mockResolvedValue([
      {
        id: 't1',
        item_id: 'i1',
        language_id: 'eng',
        backward_compatibility: 'k',
        extra: { catalogue_holding_link: 'https://x' },
      },
    ]);
    strategy.writeLink!.mockRejectedValueOnce(new Error('lock wait timeout'));

    const result = await new LinksImporter(context).import();

    expect(result.success).toBe(false);
    expect(strategy.setItemTranslationColumnsAsStoredById).not.toHaveBeenCalled();
  });

  it('refuses a plan whose link keys repeat, rather than overwrite a link', async () => {
    strategy.findShopLinkRows!.mockResolvedValue([
      {
        id: 'e1',
        backward_compatibility: 'same',
        extra: { shop_links: [{ url: 'https://s', name: 'S' }] },
      },
      {
        id: 'e2',
        backward_compatibility: 'same',
        extra: { shop_links: [{ url: 'https://t', name: 'T' }] },
      },
    ]);

    const result = await new LinksImporter(context).import();

    expect(result.success).toBe(false);
    expect(strategy.writeLink).not.toHaveBeenCalled();
    expect(strategy.setExtraAsStoredById).not.toHaveBeenCalled();
  });

  it('writes nothing on a dry run', async () => {
    strategy.findPartnerUrlRows!.mockResolvedValue([
      { id: 'pt1', partner_id: 'p1', partner_key: null, extra: { urls: [{ url: 'https://a' }] } },
    ]);
    context.dryRun = true;

    const result = await new LinksImporter(context).import();

    expect(result.imported).toBe(1);
    expect(strategy.writeLink).not.toHaveBeenCalled();
    expect(strategy.setExtraAsStoredById).not.toHaveBeenCalled();
  });
});
