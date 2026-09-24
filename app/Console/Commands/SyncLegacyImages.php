<?php

namespace App\Console\Commands;

use App\Contracts\StreamableImageFile;
use App\Models\CollectionImage;
use App\Models\ItemImage;
use App\Models\PartnerImage;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class SyncLegacyImages extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'images:sync-legacy
                            {source : Absolute path to the legacy images root directory (e.g. P:\images or \\\\server\share\images)}
                            {--symlink : Create symbolic links instead of copying files}
                            {--dry-run : Simulate synchronization without making changes}
                            {--table=* : Limit to specific tables (item_images, partner_images, collection_images). Omit for all.}
                            {--force : Skip confirmation prompt}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize legacy image files to Laravel storage by copying or symlinking from a source directory, then updating database records with correct path and size';

    /**
     * Table name to model class mapping.
     *
     * @var array<string, class-string<Model&StreamableImageFile>>
     */
    private const TABLE_MODEL_MAP = [
        'item_images' => ItemImage::class,
        'partner_images' => PartnerImage::class,
        'collection_images' => CollectionImage::class,
    ];

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $source = rtrim($this->argument('source'), '/\\');
        $useSymlink = $this->option('symlink') === true;
        $dryRun = $this->option('dry-run') === true;
        $force = $this->option('force') === true;
        $tables = $this->resolveTableFilter();

        if ($tables === null) {
            return Command::FAILURE;
        }

        // Validate source directory
        if (! File::isDirectory($source)) {
            $this->error("Source directory does not exist: {$source}");

            return Command::FAILURE;
        }

        $this->info('Legacy Image Synchronization');
        $this->info(str_repeat('=', 60));
        $this->info("Source:  {$source}");
        $this->info('Mode:    '.($useSymlink ? 'SYMLINK' : 'COPY'));
        $this->info('Dry-run: '.($dryRun ? 'YES' : 'NO'));
        $this->info('Tables:  '.implode(', ', $tables));
        $this->newLine();

        if (! $dryRun && ! $force) {
            if (! $this->confirm('This will modify image files and database records. Continue?')) {
                $this->info('Aborted. No changes were made.');

                return Command::SUCCESS;
            }
        }

        $totalSynced = 0;
        $totalSkipped = 0;
        $totalErrors = 0;

        foreach ($tables as $table) {
            $this->newLine();
            $this->info("=== Syncing {$table} ===");

            $result = $this->syncTable(
                $table,
                $source,
                $useSymlink,
                $dryRun,
            );

            $totalSynced += $result['synced'];
            $totalSkipped += $result['skipped'];
            $totalErrors += $result['errors'];
        }

        // Final summary
        $this->newLine();
        $this->info(str_repeat('=', 60));
        $this->info("Total: {$totalSynced} synced, {$totalSkipped} skipped, {$totalErrors} errors");

        return $totalErrors > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    /**
     * Resolve the --table filter option into validated table names.
     *
     * @return list<string>|null Null on validation error.
     */
    private function resolveTableFilter(): ?array
    {
        /** @var list<string> $tables */
        $tables = $this->option('table');

        if (empty($tables)) {
            return array_keys(self::TABLE_MODEL_MAP);
        }

        $validTables = array_keys(self::TABLE_MODEL_MAP);

        foreach ($tables as $table) {
            if (! in_array($table, $validTables, true)) {
                $this->error("Invalid table: {$table}. Valid options: ".implode(', ', $validTables));

                return null;
            }
        }

        return $tables;
    }

    /**
     * Synchronize images for a single table.
     *
     * @return array{synced: int, skipped: int, errors: int}
     */
    private function syncTable(
        string $table,
        string $source,
        bool $useSymlink,
        bool $dryRun,
    ): array {
        $modelClass = self::TABLE_MODEL_MAP[$table];

        /** @var Builder<Model&StreamableImageFile> $query */
        $query = $modelClass::where('size', 1)->orderBy('id');
        $count = $query->count();

        $this->info("Found {$count} records with size=1");

        if ($count === 0) {
            return ['synced' => 0, 'skipped' => 0, 'errors' => 0];
        }

        $synced = 0;
        $skipped = 0;
        $errors = 0;

        $bar = $this->output->createProgressBar($count);
        $bar->start();

        $query->chunkById(100, function ($images) use (
            $source,
            $useSymlink,
            $dryRun,
            &$synced,
            &$skipped,
            &$errors,
            $bar,
        ) {
            foreach ($images as $image) {
                try {
                    $result = $this->syncImage(
                        $image,
                        $source,
                        $useSymlink,
                        $dryRun,
                    );

                    if ($result) {
                        $synced++;
                    } else {
                        $skipped++;
                    }
                } catch (\Throwable $e) {
                    $errors++;
                    $this->newLine();
                    $keyRaw = $image->getKey();
                    $this->error('  '.(is_scalar($keyRaw) ? (string) $keyRaw : '?').': '.$e->getMessage());
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("Result: {$synced} synced, {$skipped} skipped, {$errors} errors");

        return ['synced' => $synced, 'skipped' => $skipped, 'errors' => $errors];
    }

    /**
     * Synchronize a single image record.
     *
     * @param  Model&StreamableImageFile  $image
     * @return bool True if synced, false if skipped.
     */
    private function syncImage(
        Model $image,
        string $source,
        bool $useSymlink,
        bool $dryRun,
    ): bool {
        /** @var string $legacyRelativePath */
        $legacyRelativePath = $image->getAttribute('path');

        // Normalize: remove leading slashes/backslashes
        $normalized = ltrim(str_replace('\\', '/', $legacyRelativePath), '/');

        // Build full legacy path
        $legacyFullPath = $source.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $normalized);

        if (! File::exists($legacyFullPath)) {
            throw new \RuntimeException("Legacy image not found: {$legacyFullPath}");
        }

        // Determine extension from legacy path
        $extension = strtolower(pathinfo($legacyFullPath, PATHINFO_EXTENSION));
        if ($extension === '') {
            throw new \RuntimeException("Cannot determine file extension: {$legacyFullPath}");
        }

        // New filename is UUID.extension
        $imageIdRaw = $image->getAttribute('id');
        $imageId = is_scalar($imageIdRaw) ? (string) $imageIdRaw : '';
        $newFilename = $imageId.'.'.$extension;

        if ($dryRun) {
            $this->line("  [DRY-RUN] Would sync {$imageId}: {$normalized} → {$newFilename}");

            return true;
        }

        // Resolve disk/path via the model's own StreamableImageFile contract
        // - not a hardcoded config lookup - so this always targets wherever
        // an attached image's private original actually lives (the
        // image-originals disk, since A2.2), never the public pictures
        // cache, even if that resolution ever changes.
        $image->setAttribute('path', $newFilename);
        $targetDisk = $image->imageDisk();
        $storageRelativePath = $image->imageStoragePath();

        Storage::disk($targetDisk)->makeDirectory(dirname($storageRelativePath));
        $targetFullPath = Storage::disk($targetDisk)->path($storageRelativePath);

        if ($useSymlink) {
            $this->createSymlink($legacyFullPath, $targetFullPath);
        } else {
            File::copy($legacyFullPath, $targetFullPath);
        }

        // Get actual file size
        $actualSize = File::size($targetFullPath);

        // Update database record
        $image->update([
            'path' => $newFilename,
            'size' => $actualSize,
            'original_name' => $normalized,
        ]);

        return true;
    }

    /**
     * Create a symbolic link, removing any existing file at the destination.
     */
    private function createSymlink(string $sourcePath, string $targetPath): void
    {
        // Remove existing file or link at target
        if (File::exists($targetPath) || is_link($targetPath)) {
            File::delete($targetPath);
        }

        // Ensure the parent directory exists
        $parentDir = dirname($targetPath);
        if (! File::isDirectory($parentDir)) {
            File::makeDirectory($parentDir, 0755, true);
        }

        symlink($sourcePath, $targetPath);
    }
}
