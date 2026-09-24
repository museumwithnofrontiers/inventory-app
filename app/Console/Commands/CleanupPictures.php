<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\CleansOrphanedFiles;
use App\Contracts\StreamableImageFile;
use App\Support\Images\AttachedImageRegistry;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Config;

class CleanupPictures extends Command
{
    use CleansOrphanedFiles;

    protected $signature = 'images:cleanup-pictures
                            {--delete : Actually delete orphaned files (default is dry-run)}
                            {--force : Skip confirmation prompt when --delete is specified}
                            {--older-than= : Only consider files older than this duration (e.g. 24h, 7d, 30m)}
                            {--limit= : Maximum number of files to delete in one run}
                            {--json : Output results as JSON}';

    protected $description = 'Identify (and optionally delete) orphaned files under localstorage.pictures that are no longer referenced by any registered attached-image model';

    public function handle(): int
    {
        return $this->sweepOrphans(
            Config::string('localstorage.pictures.disk'),
            trim(Config::string('localstorage.pictures.directory'), '/'),
            $this->buildKeepSet(...),
            'Orphaned Pictures Cleanup',
        );
    }

    /**
     * Build the keep-set: pictures-disk storage path => true for every row in
     * registered models.
     *
     * Built from `path` directly rather than `imageStoragePath()`: since M9,
     * that method reports the private-originals location for attached
     * images, not the pictures disk this command cleans - the public copy is
     * a cache that legitimately exists under the same filename regardless.
     *
     * @return array<string, true>
     */
    private function buildKeepSet(): array
    {
        $keepSet = [];
        $picturesDir = trim(Config::string('localstorage.pictures.directory'), '/');

        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $class::query()->chunkById(500, function ($records) use (&$keepSet, $picturesDir) {
                foreach ($records as $record) {
                    /** @var Model&StreamableImageFile $record */
                    $path = $record->getAttribute('path');
                    if (! is_string($path) || $path === '') {
                        continue;
                    }

                    $keepSet[$picturesDir.'/'.$path] = true;
                }
            });
        }

        return $keepSet;
    }
}
