<?php

namespace App\Console\Commands;

use App\Models\Collection;
use App\Support\Importer\CollectionLookupService;
use Illuminate\Console\Command;

/**
 * List every acceptable `importer:find-collection` selector for a kind
 * (project|gallery|exhibition), for browsing when the exact selector isn't
 * known ahead of time.
 */
class ListCollections extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'importer:list-collections
        {kind : project|gallery|exhibition}
        {--json : Output as JSON instead of a table}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'List legacy id, slug, English title, UUID and internal_name for every collection of a kind';

    public function handle(): int
    {
        $kind = (string) $this->argument('kind');

        if (! CollectionLookupService::isValidKind($kind)) {
            $this->error("Invalid kind '{$kind}'. Expected one of: ".implode('|', CollectionLookupService::KINDS).'.');

            return Command::FAILURE;
        }

        $collections = CollectionLookupService::baseQuery($kind)
            ->orderBy('internal_name')
            ->get();

        if ($collections->isEmpty()) {
            $this->info("No {$kind} collections found.");

            return Command::SUCCESS;
        }

        $rows = $collections->map(function (Collection $collection) use ($kind): array {
            $titles = CollectionLookupService::titles($collection);

            return [
                'legacy_selector' => CollectionLookupService::legacySelectorFromBackwardCompatibility(
                    $kind,
                    $collection->backward_compatibility
                ),
                'slug' => CollectionLookupService::slug($collection),
                'english_title' => $titles[CollectionLookupService::ENGLISH_LANGUAGE_ID] ?? null,
                'id' => $collection->id,
                'internal_name' => $collection->internal_name,
            ];
        });

        if ($this->option('json')) {
            $this->line((string) json_encode($rows->values()->all(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

            return Command::SUCCESS;
        }

        $this->table(
            ['Legacy selector', 'Slug', 'English title', 'UUID', 'internal_name'],
            $rows->map(fn (array $row): array => [
                $row['legacy_selector'] ?? '—',
                $row['slug'] ?? '—',
                $row['english_title'] ?? '—',
                $row['id'],
                $row['internal_name'],
            ])->all()
        );

        return Command::SUCCESS;
    }
}
