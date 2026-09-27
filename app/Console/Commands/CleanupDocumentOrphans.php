<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\CleansOrphanedFiles;
use App\Models\ItemDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;

/**
 * Finds the private document originals nothing references any more.
 *
 * The item_documents row is deleted by a database cascade when its owning
 * Item is (several levels deep, and from bulk queries too). A cascade skips
 * Eloquent events, so DeletesDocumentFileOnDelete never runs and the file
 * stays on the disk. This sweep catches all of them, whatever deleted the
 * row - the documents-pipeline analogue of images:cleanup-originals.
 */
class CleanupDocumentOrphans extends Command
{
    use CleansOrphanedFiles;

    /**
     * DocumentUploadListener::promote() writes the final file before it
     * creates the ItemDocument row: a file younger than this may be one of
     * those. Matches CleanupOriginals::GRACE_PERIOD for the same reason.
     */
    private const string GRACE_PERIOD = '1h';

    protected $signature = 'documents:cleanup-orphans
                            {--delete : Actually delete orphaned files (default is dry-run)}
                            {--force : Skip confirmation prompt when --delete is specified}
                            {--older-than= : Only consider files older than this duration (e.g. 24h, 7d, 30m); default 1h}
                            {--limit= : Maximum number of files to delete in one run}
                            {--json : Output results as JSON}';

    protected $description = 'Identify (and optionally delete) document files under localstorage.documents that no ItemDocument references';

    public function handle(): int
    {
        return $this->sweepOrphans(
            Config::string('localstorage.documents.disk'),
            trim(Config::string('localstorage.documents.directory'), '/'),
            $this->buildKeepSet(...),
            'Orphaned Documents Cleanup',
            self::GRACE_PERIOD,
        );
    }

    /**
     * Build the keep-set: the storage path of every ItemDocument's file.
     *
     * @return array<string, true>
     */
    private function buildKeepSet(): array
    {
        $keepSet = [];
        $directory = trim(Config::string('localstorage.documents.directory'), '/');

        ItemDocument::query()->chunkById(500, function ($records) use (&$keepSet, $directory): void {
            foreach ($records as $record) {
                $path = $record->getAttribute('path');
                if (! is_string($path) || $path === '') {
                    continue;
                }

                $keepSet[$directory.'/'.$path] = true;
            }
        });

        return $keepSet;
    }
}
