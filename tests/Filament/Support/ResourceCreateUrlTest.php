<?php

namespace Tests\Filament\Support;

use App\Filament\Resources\CollectionResource;
use App\Filament\Resources\ItemResource;
use App\Filament\Support\ResourceCreateUrl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Tests\TestCase;

/**
 * M7 story A0.3: ResourceCreateUrl is the one place in app/Filament that
 * builds a create-page query string — every relation manager's `Create`
 * header action (A1/A3.1, out of scope here) must call it rather than
 * hand-writing `Resource::getUrl('create', [...])` or a literal query string.
 */
class ResourceCreateUrlTest extends TestCase
{
    use RefreshDatabase;

    public function test_builds_a_create_url_with_the_given_query_string(): void
    {
        $url = ResourceCreateUrl::for(ItemResource::class, ['parent_id' => 'abc-123', 'type' => 'picture']);

        $this->assertStringContainsString('/admin/items/create', $url);
        $this->assertStringContainsString('parent_id=abc-123', $url);
        $this->assertStringContainsString('type=picture', $url);
    }

    public function test_builds_a_plain_create_url_when_no_parameters_are_given(): void
    {
        $url = ResourceCreateUrl::for(CollectionResource::class, []);

        $this->assertStringContainsString('/admin/collections/create', $url);
        $this->assertStringNotContainsString('?', $url);
    }

    public function test_rejects_a_key_outside_the_whitelist(): void
    {
        $this->expectException(InvalidArgumentException::class);

        ResourceCreateUrl::for(ItemResource::class, ['not_a_whitelisted_key' => 'value']);
    }

    public function test_rejects_a_mix_of_whitelisted_and_unknown_keys(): void
    {
        $this->expectException(InvalidArgumentException::class);

        ResourceCreateUrl::for(ItemResource::class, ['parent_id' => 'abc-123', 'internal_name' => 'nope']);
    }

    // ── Convention: the one place a create-page query string is built ───────

    public function test_no_other_file_under_app_filament_builds_a_create_page_query_string(): void
    {
        $root = app_path('Filament');
        $exempt = app_path('Filament/Support/ResourceCreateUrl.php');

        $offenders = [];

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root)) as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }

            $path = $file->getPathname();

            if ($path === $exempt) {
                continue;
            }

            $contents = file_get_contents($path);
            $this->assertIsString($contents);

            if (str_contains($contents, "getUrl('create', [") || str_contains($contents, 'getUrl("create", [')) {
                $offenders[] = $path.' (getUrl(\'create\', [ ... ]))';
            }

            if (str_contains($contents, 'create?')) {
                $offenders[] = $path.' (literal "create?")';
            }
        }

        $this->assertSame([], $offenders, "Only ResourceCreateUrl may build a create-page query string:\n".implode("\n", $offenders));
    }
}
