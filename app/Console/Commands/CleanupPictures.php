<?php

namespace App\Console\Commands;

use App\Contracts\StreamableImageFile;
use App\Support\FileSize;
use App\Support\Images\AttachedImageRegistry;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class CleanupPictures extends Command
{
    protected $signature = 'images:cleanup-pictures
                            {--delete : Actually delete orphaned files (default is dry-run)}
                            {--force : Skip confirmation prompt when --delete is specified}
                            {--older-than= : Only consider files older than this duration (e.g. 24h, 7d, 30m)}
                            {--limit= : Maximum number of files to delete in one run}
                            {--json : Output results as JSON}';

    protected $description = 'Identify (and optionally delete) orphaned files under localstorage.pictures that are no longer referenced by any registered attached-image model';

    public function handle(): int
    {
        try {
            AttachedImageRegistry::validate();
        } catch (\RuntimeException $e) {
            $this->error('Registry validation failed: '.$e->getMessage());

            return Command::FAILURE;
        }

        $disk = Config::string('localstorage.pictures.disk');
        $directory = trim(Config::string('localstorage.pictures.directory'), '/');
        $doDelete = $this->option('delete') === true;
        $force = $this->option('force') === true;
        $json = $this->option('json') === true;
        $limit = $this->resolveLimit();
        $olderThan = $this->resolveOlderThan();

        if ($limit === false) {
            return Command::FAILURE;
        }

        if ($olderThan === false) {
            return Command::FAILURE;
        }

        // Build keep-set from registry
        $keepSet = $this->buildKeepSet();

        // List files on disk
        /** @var list<string> $allFiles */
        $allFiles = Storage::disk($disk)->allFiles($directory);

        /** @var list<string> $orphans */
        $orphans = [];
        $referenced = 0;
        $skipped = 0;

        foreach ($allFiles as $file) {
            if (isset($keepSet[$file])) {
                $referenced++;

                continue;
            }

            // Apply --older-than filter
            if ($olderThan !== null) {
                $lastModified = Storage::disk($disk)->lastModified($file);
                if ($lastModified > $olderThan->timestamp) {
                    $skipped++;

                    continue;
                }
            }

            $orphans[] = $file;
        }

        $totalScanned = count($allFiles);
        $totalOrphans = count($orphans);

        if ($doDelete) {
            if (! $force) {
                if (! $this->confirm("Delete {$totalOrphans} orphaned file(s) from disk '{$disk}'?")) {
                    $this->info('Aborted. No files were deleted.');

                    return Command::SUCCESS;
                }
            }

            return $this->deleteOrphans($disk, $orphans, $limit, $totalScanned, $referenced, $skipped, $json);
        }

        // Dry-run report
        $this->outputReport(
            dryRun: true,
            disk: $disk,
            totalScanned: $totalScanned,
            referenced: $referenced,
            orphans: $orphans,
            deleted: 0,
            skipped: $skipped,
            reclaimedBytes: 0,
            errors: [],
            json: $json,
        );

        return Command::SUCCESS;
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

    /**
     * Delete orphans up to $limit, then report.
     *
     * @param  list<string>  $orphans
     * @return int Exit code
     */
    private function deleteOrphans(
        string $disk,
        array $orphans,
        ?int $limit,
        int $totalScanned,
        int $referenced,
        int $skipped,
        bool $json,
    ): int {
        $deleted = 0;
        $reclaimedBytes = 0;
        $errors = [];

        foreach ($orphans as $file) {
            if ($limit !== null && $deleted >= $limit) {
                break;
            }

            try {
                $size = Storage::disk($disk)->size($file);
                Storage::disk($disk)->delete($file);
                $reclaimedBytes += $size;
                $deleted++;
            } catch (\Throwable $e) {
                $errors[] = ['file' => $file, 'error' => $e->getMessage()];
            }
        }

        $this->outputReport(
            dryRun: false,
            disk: $disk,
            totalScanned: $totalScanned,
            referenced: $referenced,
            orphans: $orphans,
            deleted: $deleted,
            skipped: $skipped,
            reclaimedBytes: $reclaimedBytes,
            errors: $errors,
            json: $json,
        );

        return empty($errors) ? Command::SUCCESS : Command::FAILURE;
    }

    /**
     * Resolve the --limit option.
     *
     * @return int|null|false null = no limit, false = parse error
     */
    private function resolveLimit(): int|null|false
    {
        $raw = $this->option('limit');

        if ($raw === null) {
            return null;
        }

        if (! ctype_digit((string) $raw) || (int) $raw <= 0) {
            $this->error('--limit must be a positive integer.');

            return false;
        }

        return (int) $raw;
    }

    /**
     * Resolve the --older-than option into a Carbon cutoff (files must be older than this).
     *
     * @return Carbon|null|false null = no filter, false = parse error
     */
    private function resolveOlderThan(): Carbon|null|false
    {
        $raw = $this->option('older-than');

        if ($raw === null) {
            return null;
        }

        if (! preg_match('/^(\d+)(h|d|m)$/', (string) $raw, $matches)) {
            $this->error('--older-than must be a duration like 24h, 7d, or 30m.');

            return false;
        }

        $amount = (int) $matches[1];
        $unit = $matches[2];

        $cutoff = now();

        match ($unit) {
            'h' => $cutoff->subHours($amount),
            'd' => $cutoff->subDays($amount),
            'm' => $cutoff->subMinutes($amount),
        };

        return $cutoff;
    }

    /**
     * Output the final report in text or JSON format.
     *
     * @param  list<string>  $orphans
     * @param  list<array{file: string, error: string}>  $errors
     */
    private function outputReport(
        bool $dryRun,
        string $disk,
        int $totalScanned,
        int $referenced,
        array $orphans,
        int $deleted,
        int $skipped,
        int $reclaimedBytes,
        array $errors,
        bool $json,
    ): void {
        $orphanCount = count($orphans);

        if ($json) {
            $this->line((string) json_encode([
                'dry_run' => $dryRun,
                'disk' => $disk,
                'scanned' => $totalScanned,
                'referenced' => $referenced,
                'orphan_candidates' => $orphanCount,
                'deleted' => $deleted,
                'skipped' => $skipped,
                'reclaimed_bytes' => $reclaimedBytes,
                'errors' => $errors,
                'orphans' => $orphans,
            ], JSON_PRETTY_PRINT));

            return;
        }

        $label = $dryRun ? '[DRY-RUN] ' : '';
        $this->info("{$label}Orphaned Pictures Cleanup — disk: {$disk}");
        $this->info(str_repeat('=', 60));
        $this->line("  Scanned:           {$totalScanned}");
        $this->line("  Referenced:        {$referenced}");
        $this->line("  Orphan candidates: {$orphanCount}");
        $this->line("  Skipped (age):     {$skipped}");

        if (! $dryRun) {
            $this->line("  Deleted:           {$deleted}");
            $this->line('  Reclaimed:         '.FileSize::format($reclaimedBytes));
        }

        if (! empty($orphans)) {
            $this->newLine();
            $this->warn('Orphan candidates:');
            foreach ($orphans as $path) {
                $this->line("  - {$path}");
            }
        }

        if (! empty($errors)) {
            $this->newLine();
            $this->error('Errors:');
            foreach ($errors as $err) {
                $this->line("  - {$err['file']}: {$err['error']}");
            }
        }

        $this->newLine();

        if ($dryRun) {
            $this->info("Dry-run complete. Use --delete to remove {$orphanCount} orphaned file(s).");
        } else {
            $this->info("Cleanup complete. Deleted: {$deleted}, Errors: ".count($errors).'.');
        }
    }
}
