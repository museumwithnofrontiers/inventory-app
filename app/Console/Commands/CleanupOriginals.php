<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\CleansOrphanedFiles;
use App\Contracts\StreamableImageFile;
use App\Models\AvailableImage;
use App\Support\Images\AttachedImageRegistry;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
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

    public function handle(): int
    {
        return $this->sweepOrphans(
            Config::string('localstorage.available.images.disk'),
            trim(Config::string('localstorage.available.images.directory'), '/'),
            $this->buildKeepSet(...),
            'Orphaned Originals Cleanup',
            self::GRACE_PERIOD,
        );
    }

    /**
     * Build the keep-set: the storage path of every registered attached
     * image and of every AvailableImage. The directory holds both, and
     * deleting an AvailableImage's file loses the upload.
     *
     * @return array<string, true>
     */
    private function buildKeepSet(): array
    {
        $keepSet = [];

        foreach ([...AttachedImageRegistry::modelClasses(), AvailableImage::class] as $class) {
            $class::query()->chunkById(500, function ($records) use (&$keepSet) {
                foreach ($records as $record) {
                    /** @var Model&StreamableImageFile $record */
                    $keepSet[$record->imageStoragePath()] = true;
                }
            });
        }

        return $keepSet;
    }
}
