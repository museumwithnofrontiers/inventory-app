<?php

namespace App\Console\Commands;

use App\Support\Census\ExtraCensus;
use Illuminate\Console\Command;

/**
 * Measures the `extra` JSON columns (M16). Read-only.
 */
class ExtraCensusCommand extends Command
{
    protected $signature = 'inventory:extra-census
                            {--json : Print the census as JSON, for comparisons and baselines}
                            {--expect= : A JSON file of key ceilings (same shape as --json); fail when a key is on more rows}';

    protected $description = 'Count the rows that carry extra JSON, per table and per top-level key (item translations also per item type)';

    public function handle(ExtraCensus $census): int
    {
        $expected = null;
        $expectFile = $this->option('expect');
        if (is_string($expectFile) && $expectFile !== '') {
            $expected = $this->readExpectation($expectFile);
            if ($expected === null) {
                return Command::FAILURE;
            }
        }

        $report = $census->run();

        if ($this->option('json')) {
            $this->line((string) json_encode($report, JSON_PRETTY_PRINT | JSON_FORCE_OBJECT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        } else {
            $this->printTables($report);
        }

        if ($expected === null) {
            return Command::SUCCESS;
        }

        $failures = $census->exceeding($report, $expected);
        if ($failures === []) {
            if (! $this->option('json')) {
                $this->info('Every key is within its expected ceiling.');
            }

            return Command::SUCCESS;
        }

        foreach ($failures as $failure) {
            $this->error($failure);
        }

        return Command::FAILURE;
    }

    /**
     * @return array<mixed>|null
     */
    private function readExpectation(string $file): ?array
    {
        if (! is_file($file)) {
            $this->error("Expectation file not found: {$file}");

            return null;
        }

        $decoded = json_decode((string) file_get_contents($file), true);
        if (! is_array($decoded) || ! is_array($decoded['tables'] ?? null)) {
            $this->error("Expectation file is not a census-shaped JSON object with \"tables\": {$file}");

            return null;
        }

        return $decoded;
    }

    /**
     * @param  array{total_rows: int, tables: array<string, array{rows: int, keys: array<string, int>, by_item_type?: array<string, array{rows: int, keys: array<string, int>}>}>}  $report
     */
    private function printTables(array $report): void
    {
        $tables = $report['tables'];
        uasort($tables, fn (array $a, array $b): int => $b['rows'] <=> $a['rows']);

        $this->table(['Table', 'Rows with extra', 'Keys'], array_map(
            null,
            array_keys($tables),
            array_column($tables, 'rows'),
            array_map(fn (array $t): int => count($t['keys']), array_values($tables)),
        ));
        $this->line('Total rows with extra: '.number_format($report['total_rows']));

        foreach ($tables as $name => $table) {
            if ($table['keys'] === []) {
                continue;
            }

            $this->newLine();
            $this->line("<fg=cyan>{$name}</> ({$table['rows']} rows)");
            $types = $table['by_item_type'] ?? [];
            $typeNames = array_keys($types);

            $this->table(
                ['Key', 'Rows', ...$typeNames],
                array_map(
                    fn (string|int $key, int $count): array => [
                        (string) $key,
                        $count,
                        ...array_map(fn (array $type): int => $type['keys'][(string) $key] ?? 0, array_values($types)),
                    ],
                    array_keys($table['keys']),
                    array_values($table['keys']),
                ),
            );
        }
    }
}
