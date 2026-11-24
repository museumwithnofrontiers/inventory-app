<?php

namespace App\Support\Census;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Measures what is left in the `extra` JSON columns: for every table that has one,
 * the rows whose `extra` holds something and how many of them carry each top-level key.
 *
 * Read-only. The tables come from the schema, so a table that gains an `extra` column
 * is measured without a change here.
 *
 * @phpstan-type KeyCounts array<string, int>
 * @phpstan-type TableCensus array{rows: int, keys: KeyCounts, by_item_type?: array<string, array{rows: int, keys: KeyCounts}>}
 * @phpstan-type Census array{total_rows: int, tables: array<string, TableCensus>}
 */
class ExtraCensus
{
    /** Item translations are also counted per item type: one table serves objects, monuments, details and pictures. */
    private const PER_ITEM_TYPE_TABLE = 'item_translations';

    private const CHUNK = 1000;

    /** Key under which an `extra` that is a JSON list, not an object, is counted. */
    public const LIST_KEY = '(list)';

    /** Key under which an `extra` that is a bare scalar is counted. */
    public const SCALAR_KEY = '(scalar)';

    /**
     * @return list<string>
     */
    public function tables(): array
    {
        $tables = [];
        foreach (Schema::getTables(Schema::getCurrentSchemaName()) as $table) {
            if (Schema::hasColumn($table['name'], 'extra')) {
                $tables[] = $table['name'];
            }
        }
        sort($tables);

        return $tables;
    }

    /**
     * @return Census
     */
    public function run(): array
    {
        $tables = [];
        $total = 0;

        foreach ($this->tables() as $table) {
            $tables[$table] = $this->measure($table);
            $total += $tables[$table]['rows'];
        }

        return ['total_rows' => $total, 'tables' => $tables];
    }

    /**
     * Compares a census with an expectation of the same shape. Every key the expectation
     * lists is a ceiling: the census fails it when the key is on more rows than that
     * (0 means the key must be gone).
     *
     * @param  Census  $census
     * @param  array<mixed>  $expected
     * @return list<string> one line per key above its ceiling
     */
    public function exceeding(array $census, array $expected): array
    {
        $failures = [];
        $tables = is_array($expected['tables'] ?? null) ? $expected['tables'] : [];

        foreach ($tables as $table => $expectation) {
            $keys = is_array($expectation) && is_array($expectation['keys'] ?? null) ? $expectation['keys'] : [];
            foreach ($keys as $key => $ceiling) {
                if (! is_int($ceiling)) {
                    continue;
                }
                $actual = $census['tables'][(string) $table]['keys'][(string) $key] ?? 0;
                if ($actual > $ceiling) {
                    $failures[] = "{$table}.extra.{$key}: {$actual} rows, at most {$ceiling} expected";
                }
            }
        }

        return $failures;
    }

    /**
     * The keys a census found that an expectation doesn't list, in any table. A strict
     * check fails on them: a key that appears is reviewed before it is accepted.
     *
     * @param  Census  $census
     * @param  array<mixed>  $expected
     * @return list<string> one line per key the expectation doesn't list
     */
    public function unlisted(array $census, array $expected): array
    {
        $failures = [];
        $tables = is_array($expected['tables'] ?? null) ? $expected['tables'] : [];

        foreach ($census['tables'] as $table => $measured) {
            $expectation = $tables[$table] ?? null;
            $listed = is_array($expectation) && is_array($expectation['keys'] ?? null) ? $expectation['keys'] : [];
            foreach ($measured['keys'] as $key => $count) {
                if (! array_key_exists((string) $key, $listed)) {
                    $failures[] = "{$table}.extra.{$key}: {$count} rows, not listed in the expectation";
                }
            }
        }

        return $failures;
    }

    /**
     * @return TableCensus
     */
    private function measure(string $table): array
    {
        $perType = $table === self::PER_ITEM_TYPE_TABLE;
        $rows = 0;
        /** @var KeyCounts $keys */
        $keys = [];
        /** @var array<string, array{rows: int, keys: KeyCounts}> $byType */
        $byType = [];

        foreach ($this->query($table, $perType)->lazy(self::CHUNK) as $row) {
            /** @var object{extra: string|null, item_type?: string|null} $row */
            $rowKeys = $this->topLevelKeys($row->extra);
            if ($rowKeys === []) {
                continue;
            }

            $rows++;
            $this->tally($keys, $rowKeys);

            if ($perType) {
                $type = $row->item_type ?? '(none)';
                $byType[$type] ??= ['rows' => 0, 'keys' => []];
                $byType[$type]['rows']++;
                $this->tally($byType[$type]['keys'], $rowKeys);
            }
        }

        $result = ['rows' => $rows, 'keys' => $this->sorted($keys)];

        if ($perType) {
            ksort($byType);
            foreach ($byType as $type => $census) {
                $byType[$type]['keys'] = $this->sorted($census['keys']);
            }
            $result['by_item_type'] = $byType;
        }

        return $result;
    }

    private function query(string $table, bool $perType): Builder
    {
        $query = DB::table($table)->whereNotNull("{$table}.extra");

        if ($perType) {
            $query->leftJoin('items', 'items.id', '=', "{$table}.item_id")
                ->select(["{$table}.extra", 'items.type as item_type']);
        } else {
            $query->select(["{$table}.extra"]);
        }

        // lazy() pages with an order; the primary key gives a stable one, whether it is
        // an id or a composite key like collection_item's.
        foreach ($this->primaryKey($table) as $column) {
            $query->orderBy("{$table}.{$column}");
        }

        return $query;
    }

    /**
     * @return list<string>
     */
    private function primaryKey(string $table): array
    {
        foreach (Schema::getIndexes($table) as $index) {
            if ($index['primary']) {
                return $index['columns'];
            }
        }

        return Schema::getColumnListing($table);
    }

    /**
     * @return list<string>
     */
    private function topLevelKeys(?string $extra): array
    {
        if ($extra === null || $extra === '') {
            return [];
        }

        $decoded = json_decode($extra, true);

        if (is_array($decoded)) {
            if ($decoded === []) {
                return [];
            }

            return array_is_list($decoded) ? [self::LIST_KEY] : array_map(strval(...), array_keys($decoded));
        }

        return $decoded === null ? [] : [self::SCALAR_KEY];
    }

    /**
     * @param  KeyCounts  $counts
     * @param  list<string>  $keys
     */
    private function tally(array &$counts, array $keys): void
    {
        foreach ($keys as $key) {
            $counts[$key] = ($counts[$key] ?? 0) + 1;
        }
    }

    /**
     * Most frequent key first; ties by name, so two runs on the same data print the same.
     *
     * @param  KeyCounts  $counts
     * @return KeyCounts
     */
    private function sorted(array $counts): array
    {
        uksort($counts, fn (int|string $a, int|string $b): int => [$counts[$b], (string) $a] <=> [$counts[$a], (string) $b]);

        return $counts;
    }
}
