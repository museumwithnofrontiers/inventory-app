<?php

namespace Tests\Console;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GetImageStoragePathCommandTest extends TestCase
{
    public function test_documents_resolves_the_private_documents_directory(): void
    {
        $disk = Config::string('localstorage.documents.disk');
        $directory = trim(Config::string('localstorage.documents.directory'), '/');
        Storage::fake($disk);

        $expected = rtrim(Storage::disk($disk)->path(''), '/\\').DIRECTORY_SEPARATOR.$directory;

        $this->artisan('storage:image-path', ['type' => 'documents'])
            ->expectsOutput(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $expected))
            ->assertSuccessful();
    }

    public function test_an_unknown_type_is_refused(): void
    {
        $this->artisan('storage:image-path', ['type' => 'nowhere'])
            ->assertFailed();
    }
}
