<?php

namespace App\Console\Commands;

use App\Models\Collection;
use App\Support\Importer\CollectionLookupService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

/**
 * Resolve a legacy numeric id, legacy slug, project KEY, or exact English
 * title to the inventory-app Collection UUID the importer assigned it,
 * without querying the database by hand. See
 * app/Support/Importer/CollectionLookupService.php for the resolution rules.
 */
class FindCollection extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'importer:find-collection
        {kind : project|gallery|exhibition}
        {selector : A legacy numeric id or legacy slug (gallery/exhibition), a project KEY, or the exact, case-sensitive English title}
        {--json : Output as JSON instead of a table}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Resolve a legacy id, slug or exact English title to a collection UUID, internal_name, type, parent and titles';

    public function handle(): int
    {
        $kind = (string) $this->argument('kind');
        $selector = (string) $this->argument('selector');

        if (! CollectionLookupService::isValidKind($kind)) {
            $this->error("Invalid kind '{$kind}'. Expected one of: ".implode('|', CollectionLookupService::KINDS).'.');

            return Command::FAILURE;
        }

        $matches = CollectionLookupService::resolveBySelector($kind, $selector);

        if ($matches->isEmpty()) {
            $this->error("No {$kind} collection found for selector '{$selector}'.");

            return Command::FAILURE;
        }

        if ($matches->count() > 1) {
            $this->reportAmbiguity($kind, $selector, $matches);

            return Command::FAILURE;
        }

        /** @var Collection $collection */
        $collection = $matches->first();

        if ($this->option('json')) {
            $this->line((string) json_encode(
                CollectionLookupService::present($collection),
                JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            ));

            return Command::SUCCESS;
        }

        $this->renderTable($collection);

        return Command::SUCCESS;
    }

    /**
     * @param  EloquentCollection<int, Collection>  $matches
     */
    private function reportAmbiguity(string $kind, string $selector, EloquentCollection $matches): void
    {
        $this->error("Ambiguous selector '{$selector}' matched {$matches->count()} {$kind} collections:");
        foreach ($matches as $match) {
            $this->line("  - {$match->id}  ({$match->internal_name}, backward_compatibility: {$match->backward_compatibility})");
        }
    }

    private function renderTable(Collection $collection): void
    {
        $payload = CollectionLookupService::present($collection);

        $this->table(
            ['Field', 'Value'],
            [
                ['UUID', $payload['id']],
                ['internal_name', $payload['internal_name']],
                ['type', $payload['type']],
                ['parent_id', $payload['parent_id'] ?? '—'],
                ['parent internal_name', $payload['parent_internal_name'] ?? '—'],
                ['backward_compatibility', $payload['backward_compatibility'] ?? '—'],
            ]
        );

        if ($payload['titles'] === []) {
            $this->line('No titles found.');

            return;
        }

        $this->table(
            ['Language', 'Title'],
            collect($payload['titles'])
                ->map(fn (string $title, string $languageId): array => [$languageId, $title])
                ->values()
                ->all()
        );
    }
}
