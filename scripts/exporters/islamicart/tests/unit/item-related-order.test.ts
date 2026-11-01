import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  compareLegacyLinkOrder,
  ItemExporter,
} from "../../src/exporters/item-exporter.js";
import type { Database } from "../../src/core/database.js";
import type { ExportContext } from "../../src/core/types.js";
import type { Logger } from "../../src/core/logger.js";

/**
 * Legacy's item sheet listed the related records in its link table's index
 * order, which is the related record's key: type, project, country and
 * museum as a case-insensitive collation sorts them, then number as a
 * number. The links carry no order of their own, so the package orders them
 * by those keys.
 */
describe("ItemExporter — related records in legacy order", () => {
  let outputDir: string;

  const item = (id: string, key: string | null) => ({
    id,
    type: "object",
    internal_name: id,
    backward_compatibility: key,
    parent_id: null,
    partner_id: null,
    country_id: null,
    collection_id: null,
    project_id: "isl-project-uuid",
    owner_reference: null,
    mwnf_reference: null,
    start_date: null,
    end_date: null,
    display_order: null,
    latitude: null,
    longitude: null,
  });

  const items = [
    item("a-source", "mwnf3:objects:ISL:eg:Mus01:50"),
    item("b-uk-mus02-30", "mwnf3:objects:ISL:uk:Mus02:30"),
    item("c-no-key", null),
    item("d-tn-mus01b-50", "mwnf3:objects:ISL:tn:Mus01_B:50"),
    item("e-uk-mus02-5", "mwnf3:objects:ISL:uk:Mus02:5"),
    item("f-tr-mus01-25", "mwnf3:objects:ISL:tr:Mus01:25"),
    item("g-tn-mus01b-49", "mwnf3:objects:ISL:tn:Mus01_B:49"),
  ];

  const stubDb = (): Database =>
    ({
      query: async (sql: string) => {
        if (sql.includes("FROM languages"))
          return [{ id: "eng", backward_compatibility: "en" }];
        if (sql.includes("ORDER BY type, display_order, internal_name"))
          return items;
        if (sql.includes("FROM item_item_links")) {
          return items
            .filter((target) => target.id !== "a-source")
            .map((target) => ({
              source_id: "a-source",
              target_id: target.id,
              language_id: null,
              justification: null,
            }));
        }
        return [];
      },
    }) as unknown as Database;

  const context = (db: Database): ExportContext => ({
    db,
    outputDir,
    projectIds: ["isl-project-uuid"],
    contextIds: ["isl-context-uuid"],
    projectKeys: ["ISL"],
    baseUrl: "https://example.test",
    logger: {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    } as unknown as Logger,
  });

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), "islamicart-item-related-order-"));
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("lists an item’s related records by their legacy keys, numbers as numbers", async () => {
    await new ItemExporter(context(stubDb())).export();

    const written = JSON.parse(
      readFileSync(join(outputDir, "items.json"), "utf-8"),
    ) as Array<{
      id: string;
      related_items: Array<{ id: string }>;
    }>;
    const source = written.find((row) => row.id === "a-source")!;
    expect(source.related_items.map((row) => row.id)).toEqual([
      "g-tn-mus01b-49",
      "d-tn-mus01b-50",
      "f-tr-mus01-25",
      "e-uk-mus02-5",
      "b-uk-mus02-30",
      "c-no-key",
    ]);
  });

  it("compares museums as the case-insensitive collation did", () => {
    expect(
      compareLegacyLinkOrder(
        "mwnf3:objects:ISL:tn:mus01:1",
        "mwnf3:objects:ISL:tn:Mus01_B:1",
      ),
    ).toBeLessThan(0);
    expect(
      compareLegacyLinkOrder(
        "mwnf3:objects:ISL:tn:MUS01:2",
        "mwnf3:objects:ISL:tn:mus01:10",
      ),
    ).toBeLessThan(0);
    expect(
      compareLegacyLinkOrder(
        "mwnf3:monuments:ISL:dz:Mon01:7",
        "mwnf3:objects:ISL:dz:Mus01:7",
      ),
    ).toBeLessThan(0);
  });
});
