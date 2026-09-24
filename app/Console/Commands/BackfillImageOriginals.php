<?php

namespace App\Console\Commands;

use App\Contracts\StreamableImageFile;
use App\Support\Images\AttachedImageRegistry;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * One-time backfill for images imported before M9's two-disk split: every
 * registry model's current public file (today, by construction, still
 * pristine - nothing has ever burned into it) is copied verbatim onto the
 * new private image-originals disk, then removed from the public disk.
 *
 * After this runs, every backfilled image is an ordinary cache miss for
 * epic A3's on-demand pipeline to handle on its first real request - no
 * eager burn pass. Idempotent: safe to re-run, and it also cleans up a
 * stray public file left behind by a previous partial run.
 */
class BackfillImageOriginals extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'images:backfill-originals
                            {--dry-run : Report what would happen without making changes}
                            {--force : Skip confirmation prompt}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Backfill the private image-originals disk from already-imported images\' public files, then empty the public disk behind them';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run') === true;
        $force = $this->option('force') === true;

        $picturesDisk = Config::string('localstorage.pictures.disk');
        $picturesDirectory = trim(Config::string('localstorage.pictures.directory'), '/');

        $total = 0;
        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $total += $class::query()->count();
        }

        $this->info('Image Originals Backfill');
        $this->info(str_repeat('=', 60));
        $this->info("Records: {$total}");
        $this->info('Dry-run: '.($dryRun ? 'YES' : 'NO'));
        $this->newLine();

        if ($total === 0) {
            $this->info('Nothing to do.');

            return Command::SUCCESS;
        }

        if (! $dryRun && ! $force) {
            if (! $this->confirm('This will copy files to the private disk and remove them from the public disk. Continue?')) {
                $this->info('Aborted. No changes were made.');

                return Command::SUCCESS;
            }
        }

        $backfilled = 0;
        $cleaned = 0;
        $skipped = 0;
        $errors = 0;

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach (AttachedImageRegistry::eachImage() as $record) {
            /** @var Model&StreamableImageFile $record */
            try {
                $status = $this->backfillOne($record, $picturesDisk, $picturesDirectory, $dryRun);

                match ($status) {
                    'backfilled' => $backfilled++,
                    'cleaned' => $cleaned++,
                    'skipped' => $skipped++,
                };
            } catch (\Throwable $e) {
                $errors++;
                $this->newLine();
                $keyRaw = $record->getKey();
                $this->error('  '.(is_scalar($keyRaw) ? (string) $keyRaw : '?').': '.$e->getMessage());
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info(str_repeat('=', 60));
        $this->info("Total: {$backfilled} backfilled, {$cleaned} cleaned, {$skipped} already done, {$errors} errors");

        return $errors > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    /**
     * Backfill a single image record.
     *
     * @param  Model&StreamableImageFile  $record
     * @return 'backfilled'|'cleaned'|'skipped'
     */
    private function backfillOne(Model $record, string $picturesDisk, string $picturesDirectory, bool $dryRun): string
    {
        $privateDisk = $record->imageDisk();
        $privatePath = $record->imageStoragePath();
        $publicPath = $picturesDirectory.'/'.$record->getAttribute('path');

        $privateExists = Storage::disk($privateDisk)->exists($privatePath);
        $publicExists = Storage::disk($picturesDisk)->exists($publicPath);

        if (! $privateExists && ! $publicExists) {
            throw new \RuntimeException("Neither private original nor public file found (private: {$privatePath}, public: {$publicPath})");
        }

        if (! $privateExists) {
            if ($dryRun) {
                $this->line("  [DRY-RUN] Would copy {$publicPath} → {$privateDisk}:{$privatePath}, then remove {$publicPath}");

                return 'backfilled';
            }

            $contents = Storage::disk($picturesDisk)->get($publicPath);
            Storage::disk($privateDisk)->put($privatePath, $contents ?? '');
            Storage::disk($picturesDisk)->delete($publicPath);

            return 'backfilled';
        }

        if ($publicExists) {
            if ($dryRun) {
                $this->line("  [DRY-RUN] Would remove stray public file {$publicPath} (private original already present)");

                return 'cleaned';
            }

            Storage::disk($picturesDisk)->delete($publicPath);

            return 'cleaned';
        }

        return 'skipped';
    }
}
