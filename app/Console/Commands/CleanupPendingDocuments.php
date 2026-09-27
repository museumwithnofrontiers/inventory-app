<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\CleansOrphanedFiles;
use App\Models\DocumentUpload;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Finds DocumentUpload rows whose queued validation never completed.
 *
 * DocumentUploadListener deletes the row at the end of every processing
 * cycle - whether it promotes the upload to an ItemDocument or rejects it
 * (docs/frontend-filament/document-upload.md "Security"). A row still
 * present past the grace period means the job never ran to completion: a
 * worker crash, an infrastructure failure, or a row deleted out from under
 * a queued job (which Laravel then discards silently, per SerializesModels).
 * This sweep reports (and, with --delete, removes) those stale rows and
 * their pending files.
 *
 * Unlike CleanupOriginals/CleanupPictures/CleanupDocumentOrphans, the object
 * being swept here is a database row, not a file discovered by scanning a
 * disk directory - Storage::allFiles() plus a keep-set (what
 * CleansOrphanedFiles::sweepOrphans() implements) doesn't fit "list every
 * DocumentUpload older than a grace period". This command reuses the same
 * trait's option parsing (--limit, --older-than) and its report/JSON output
 * shape directly, rather than inventing a new CLI convention, but drives its
 * own query and delete loop.
 */
class CleanupPendingDocuments extends Command
{
    use CleansOrphanedFiles;

    /** Matches CleanupOriginals::GRACE_PERIOD. */
    private const string GRACE_PERIOD = '1h';

    protected $signature = 'documents:cleanup-pending
                            {--delete : Actually delete stale rows and their pending files (default is dry-run)}
                            {--force : Skip confirmation prompt when --delete is specified}
                            {--older-than= : Only consider rows older than this duration (e.g. 24h, 7d, 30m); default 1h}
                            {--limit= : Maximum number of rows to delete in one run}
                            {--json : Output results as JSON}';

    protected $description = 'Identify (and optionally delete) DocumentUpload rows whose queued validation never completed, and their pending files';

    public function handle(): int
    {
        $doDelete = $this->option('delete') === true;
        $force = $this->option('force') === true;
        $json = $this->option('json') === true;
        $limit = $this->resolveLimit();
        $olderThan = $this->resolveOlderThan(self::GRACE_PERIOD);

        if ($limit === false || $olderThan === false) {
            return Command::FAILURE;
        }

        $disk = Config::string('localstorage.uploads.documents.disk');
        $directory = trim(Config::string('localstorage.uploads.documents.directory'), '/');

        $totalScanned = DocumentUpload::query()->count();

        $staleQuery = DocumentUpload::query()->orderBy('created_at');
        if ($olderThan !== null) {
            $staleQuery->where('created_at', '<', $olderThan);
        }

        /** @var Collection<int, DocumentUpload> $stale */
        $stale = $staleQuery->get();
        $referenced = $totalScanned - $stale->count();

        /** @var list<string> $orphans */
        $orphans = $stale->map(fn (DocumentUpload $row): string => $directory === '' ? $row->path : $directory.'/'.$row->path)->all();

        if ($doDelete) {
            if (! $force && ! $this->confirm("Delete {$stale->count()} stale document upload(s) from disk '{$disk}'?")) {
                $this->info('Aborted. No files were deleted.');

                return Command::SUCCESS;
            }

            return $this->deleteStale($disk, $directory, $stale, $orphans, $limit, $totalScanned, $referenced, $json);
        }

        $this->outputReport(
            title: 'Stale Document Uploads Cleanup',
            dryRun: true,
            disk: $disk,
            totalScanned: $totalScanned,
            referenced: $referenced,
            orphans: $orphans,
            deleted: 0,
            skipped: 0,
            reclaimedBytes: 0,
            errors: [],
            json: $json,
        );

        return Command::SUCCESS;
    }

    /**
     * @param  Collection<int, DocumentUpload>  $stale
     * @param  list<string>  $orphans
     */
    private function deleteStale(
        string $disk,
        string $directory,
        Collection $stale,
        array $orphans,
        ?int $limit,
        int $totalScanned,
        int $referenced,
        bool $json,
    ): int {
        $deleted = 0;
        $reclaimedBytes = 0;
        $errors = [];

        foreach ($stale as $row) {
            if ($limit !== null && $deleted >= $limit) {
                break;
            }

            $path = $directory === '' ? $row->path : $directory.'/'.$row->path;

            try {
                if (Storage::disk($disk)->exists($path)) {
                    $reclaimedBytes += Storage::disk($disk)->size($path);
                    Storage::disk($disk)->delete($path);
                }

                $row->delete();
                $deleted++;
            } catch (Throwable $e) {
                $errors[] = ['file' => $path, 'error' => $e->getMessage()];
            }
        }

        $this->outputReport(
            title: 'Stale Document Uploads Cleanup',
            dryRun: false,
            disk: $disk,
            totalScanned: $totalScanned,
            referenced: $referenced,
            orphans: $orphans,
            deleted: $deleted,
            skipped: 0,
            reclaimedBytes: $reclaimedBytes,
            errors: $errors,
            json: $json,
        );

        return empty($errors) ? Command::SUCCESS : Command::FAILURE;
    }
}
