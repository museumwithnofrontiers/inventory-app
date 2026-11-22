<?php

namespace Tests\Console;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * docs:openapi exports against a throwaway SQLite database of its own, never the configured one,
 * and pins the URLs the document embeds.
 */
class ExportOpenApiDocumentCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_writes_the_document_from_its_own_database(): void
    {
        $path = sys_get_temp_dir().'/openapi-test-'.uniqid().'.json';
        Config::set('app.url', 'https://inventory.example.test');
        $default = Config::string('database.default');

        try {
            $this->artisan('docs:openapi', ['--path' => $path])->assertSuccessful();

            $document = json_decode((string) File::get($path), true);
            $this->assertIsArray($document);
            $this->assertSame('Inventory', $document['info']['title']);
            $this->assertSame([['url' => 'http://localhost/api']], $document['servers']);
            // Typed from the migrated table, not the string fallback of a missing one
            $this->assertSame('boolean', $document['components']['schemas']['CollectionResource']['properties']['draft']['type']);
        } finally {
            File::delete($path);
        }

        $this->assertSame($default, Config::string('database.default'));
    }
}
