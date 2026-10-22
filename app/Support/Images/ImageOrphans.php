<?php

namespace App\Support\Images;

use App\Contracts\StreamableImageFile;
use App\Models\AvailableImage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * Finds the image files no row references, on the private originals disk
 * and on the pictures cache. Read-only: deleting is the cleanup commands'
 * business (images:cleanup-originals, images:cleanup-pictures), which use
 * this to decide what is an orphan. The MCP server's find_orphans tool uses
 * it to report them.
 */
final class ImageOrphans
{
    /**
     * Orphaned originals: files on the originals disk that neither an
     * attached image nor an AvailableImage points at.
     *
     * @return array{disk: string, scanned: int, referenced: int, skipped: int, orphans: list<string>}
     */
    public function originals(?Carbon $olderThan = null): array
    {
        $disk = Config::string('localstorage.available.images.disk');

        return ['disk' => $disk, ...$this->find(
            $disk,
            trim(Config::string('localstorage.available.images.directory'), '/'),
            $this->originalsKeepSet(),
            $olderThan,
        )];
    }

    /**
     * Orphaned renditions: files in the pictures cache that no attached
     * image's path names.
     *
     * @return array{disk: string, scanned: int, referenced: int, skipped: int, orphans: list<string>}
     */
    public function pictures(?Carbon $olderThan = null): array
    {
        $disk = Config::string('localstorage.pictures.disk');

        return ['disk' => $disk, ...$this->find(
            $disk,
            trim(Config::string('localstorage.pictures.directory'), '/'),
            $this->picturesKeepSet(),
            $olderThan,
        )];
    }

    /**
     * The storage path of every registered attached image and of every
     * AvailableImage: the originals directory holds both, and deleting an
     * AvailableImage's file loses the upload.
     *
     * @return array<string, true>
     */
    public function originalsKeepSet(): array
    {
        $keepSet = [];

        foreach ([...AttachedImageRegistry::modelClasses(), AvailableImage::class] as $class) {
            $class::query()->chunkById(500, function ($records) use (&$keepSet): void {
                foreach ($records as $record) {
                    /** @var Model&StreamableImageFile $record */
                    $keepSet[$record->imageStoragePath()] = true;
                }
            });
        }

        return $keepSet;
    }

    /**
     * Pictures-disk path => true for every attached image. Built from `path`
     * rather than imageStoragePath(), which names the private original: the
     * rendition is cached under the same filename in the pictures directory.
     *
     * @return array<string, true>
     */
    public function picturesKeepSet(): array
    {
        $keepSet = [];
        $directory = trim(Config::string('localstorage.pictures.directory'), '/');

        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $class::query()->chunkById(500, function ($records) use (&$keepSet, $directory): void {
                foreach ($records as $record) {
                    $path = $record->getAttribute('path');

                    if (is_string($path) && $path !== '') {
                        $keepSet[$directory.'/'.$path] = true;
                    }
                }
            });
        }

        return $keepSet;
    }

    /**
     * Files under $directory on $disk missing from $keepSet. With
     * $olderThan, files modified after it are skipped, not reported.
     *
     * @param  array<string, true>  $keepSet
     * @return array{scanned: int, referenced: int, skipped: int, orphans: list<string>}
     */
    public function find(string $disk, string $directory, array $keepSet, ?Carbon $olderThan = null): array
    {
        /** @var list<string> $files */
        $files = Storage::disk($disk)->allFiles($directory);
        $orphans = [];
        $referenced = 0;
        $skipped = 0;

        foreach ($files as $file) {
            if (isset($keepSet[$file])) {
                $referenced++;

                continue;
            }

            if ($olderThan !== null && Storage::disk($disk)->lastModified($file) > $olderThan->timestamp) {
                $skipped++;

                continue;
            }

            $orphans[] = $file;
        }

        return ['scanned' => count($files), 'referenced' => $referenced, 'skipped' => $skipped, 'orphans' => $orphans];
    }
}
