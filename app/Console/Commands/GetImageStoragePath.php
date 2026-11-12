<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class GetImageStoragePath extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'storage:image-path 
                            {type=pictures : The storage type (uploads, available, pictures, or documents)}
                            {--json : Output as JSON}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Get the absolute path to an image storage directory';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $type = $this->argument('type');

        // Validate type
        if (! in_array($type, ['uploads', 'available', 'pictures', 'documents'])) {
            $this->error("Invalid storage type '{$type}'. Valid types are: uploads, available, pictures, documents");

            return 1;
        }

        // Get config based on type
        [$disk, $directory] = $this->getStorageConfig($type);

        // Get the absolute path to the disk root
        $diskPath = Storage::disk($disk)->path('');

        // Combine with the directory (trim slashes to avoid double slashes)
        $fullPath = rtrim($diskPath, '/\\');
        if ($directory) {
            $fullPath .= DIRECTORY_SEPARATOR.trim($directory, '/\\');
        }

        // Normalize path separators for the current OS
        $fullPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $fullPath);

        if ($this->option('json')) {
            $this->line((string) json_encode([
                'type' => $type,
                'disk' => $disk,
                'directory' => $directory,
                'absolute_path' => $fullPath,
            ], JSON_PRETTY_PRINT));
        } else {
            // Use line() instead of info() to avoid adding </info> tag
            $this->line($fullPath);
        }

        return 0;
    }

    /**
     * Get storage configuration for the specified type.
     *
     * @return array{0: string, 1: string}
     */
    private function getStorageConfig(string $type): array
    {
        return match ($type) {
            'uploads' => [
                Config::string('localstorage.uploads.images.disk'),
                Config::string('localstorage.uploads.images.directory'),
            ],
            'available' => [
                Config::string('localstorage.available.images.disk'),
                Config::string('localstorage.available.images.directory'),
            ],
            'pictures' => [
                Config::string('localstorage.pictures.disk'),
                Config::string('localstorage.pictures.directory'),
            ],
            // The private document-originals disk: where ship pushes the staged PDFs (ADR 004).
            'documents' => [
                Config::string('localstorage.documents.disk'),
                Config::string('localstorage.documents.directory'),
            ],
            default => throw new \InvalidArgumentException("Unsupported image storage type: {$type}"),
        };
    }
}
