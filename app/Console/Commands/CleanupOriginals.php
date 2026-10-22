<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\CleansOrphanedFiles;
use App\Support\Images\ImageOrphans;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;

/**
 * Finds the private originals nothing references any more.
 *
 * Every registry table is deleted by a database cascade when its owner is
 * (item, collection, partner, partner translation, timeline event,
 * contributor - several levels deep, and from bulk queries too). A cascade
 * skips Eloquent events, so DeletesImageFilesOnDelete never runs and the
 * original stays on the disk. This sweep catches all of them, whatever
 * deleted the row.
 */
class CleanupOriginals extends Command
{
    use CleansOrphanedFiles;

    /**
     * ImageUploadListener writes an original before it creates its
     * AvailableImage row: a file younger than this may be one of those.
     */
    private const string GRACE_PERIOD = '1h';

    protected $signature = 'images:cleanup-originals
                            {--delete : Actually delete orphaned files (default is dry-run)}
                            {--force : Skip confirmation prompt when --delete is specified}
                            {--older-than= : Only consider files older than this duration (e.g. 24h, 7d, 30m); default 1h}
                            {--limit= : Maximum number of files to delete in one run}
                            {--json : Output results as JSON}';

    protected $description = 'Identify (and optionally delete) original image files under localstorage.available.images that no attached image and no available image references';

    public function handle(ImageOrphans $orphans): int
    {
        return $this->sweepOrphans(
            Config::string('localstorage.available.images.disk'),
            trim(Config::string('localstorage.available.images.directory'), '/'),
            $orphans->originalsKeepSet(...),
            'Orphaned Originals Cleanup',
            self::GRACE_PERIOD,
        );
    }
}
