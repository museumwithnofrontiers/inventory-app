<?php

namespace App\Console\Commands;

use App\Console\Commands\Concerns\CleansOrphanedFiles;
use App\Support\Images\ImageOrphans;
use Illuminate\Console\Command;
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

    public function handle(ImageOrphans $orphans): int
    {
        return $this->sweepOrphans(
            Config::string('localstorage.pictures.disk'),
            trim(Config::string('localstorage.pictures.directory'), '/'),
            $orphans->picturesKeepSet(...),
            'Orphaned Pictures Cleanup',
        );
    }
}
