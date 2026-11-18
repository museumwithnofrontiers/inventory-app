---
layout: default
title: Extra census
parent: Database Models
nav_order: 90
---

# Extra census

Several tables keep content the model has no column for in an `extra` JSON column. Milestone M16 ("Model: retire extra") gives that content a proper home. The census measures how much is left.

```bash
php artisan inventory:extra-census            # a table per table, keys by count
php artisan inventory:extra-census --json     # the same as JSON
php artisan inventory:extra-census --expect docs/models/extra-census-expected.json
```

- The tables come from the schema: every table with an `extra` column is measured.
- A row counts when its `extra` holds something. `null`, `{}` and `[]` don't count.
- Keys are the top-level keys of the JSON object. An `extra` that is a JSON list counts under `(list)`, and a bare value under `(scalar)`.
- `item_translations` is also counted per item type (object, monument, detail, picture), under `by_item_type`.
- The command only reads.

## Baseline

[`extra-census-2026-11-18.json`](extra-census-2026-11-18.json) is the census on staging after reimport 16: **72,145 rows** with `extra`. Compare a later run with it to see what a story absorbed.

## Expectations

`--expect <file>` takes a JSON file of the same shape as `--json` and treats every key it lists as a ceiling. The command fails when a key is on more rows than that, and `0` means the key must be gone:

```json
{
  "tables": {
    "collection_item": { "keys": { "mn_order": 0 } }
  }
}
```

Keys the file doesn't list are not checked.
