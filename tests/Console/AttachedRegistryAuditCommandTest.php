<?php

namespace Tests\Console;

use App\Models\ItemImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The audit checks each attached image's original on its private disk. The
 * pictures disk is only a cache of renditions, burned on first use, so a
 * rendition missing there is not an issue.
 */
class AttachedRegistryAuditCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $disk;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        // The base TestCase fakes the originals disk
        $this->disk = config('localstorage.available.images.disk');
        $this->directory = trim(config('localstorage.available.images.directory'), '/');
        Storage::fake(config('localstorage.pictures.disk'));
    }

    public function test_command_succeeds_with_clean_inventory(): void
    {
        ItemImage::factory()->create(['path' => 'clean.jpg']);
        Storage::disk($this->disk)->put($this->directory.'/clean.jpg', 'data');

        $this->artisan('images:attached-registry-audit', ['--fail-on-issues' => true])
            ->assertExitCode(0);
    }

    public function test_a_rendition_missing_from_the_pictures_cache_is_not_an_issue(): void
    {
        ItemImage::factory()->create(['path' => 'not-burned-yet.jpg']);
        Storage::disk($this->disk)->put($this->directory.'/not-burned-yet.jpg', 'data');

        $this->assertFalse(Storage::disk(config('localstorage.pictures.disk'))->exists('pictures/not-burned-yet.jpg'));
        $this->artisan('images:attached-registry-audit', ['--fail-on-issues' => true])
            ->assertExitCode(0);
    }

    public function test_command_reports_missing_original(): void
    {
        ItemImage::factory()->create(['path' => 'missing.jpg']);

        $this->artisan('images:attached-registry-audit')
            ->expectsOutputToContain('Missing originals (1)')
            ->assertExitCode(0); // Reported, but not a failure by default
    }

    public function test_command_fails_on_missing_original_when_fail_on_issues(): void
    {
        ItemImage::factory()->create(['path' => 'missing.jpg']);

        $this->artisan('images:attached-registry-audit', ['--fail-on-issues' => true])
            ->assertExitCode(1);
    }

    public function test_an_original_present_only_in_the_pictures_cache_is_still_missing(): void
    {
        ItemImage::factory()->create(['path' => 'cache-only.jpg']);
        Storage::disk(config('localstorage.pictures.disk'))->put('pictures/cache-only.jpg', 'burned');

        $this->artisan('images:attached-registry-audit', ['--fail-on-issues' => true])
            ->assertExitCode(1);
    }

    public function test_command_reports_duplicate_paths(): void
    {
        ItemImage::factory()->create(['path' => 'dupe.jpg']);
        ItemImage::factory()->create(['path' => 'dupe.jpg']);
        Storage::disk($this->disk)->put($this->directory.'/dupe.jpg', 'data');

        $this->artisan('images:attached-registry-audit', ['--fail-on-issues' => true])
            ->assertExitCode(1);
    }

    public function test_command_reports_empty_path(): void
    {
        ItemImage::factory()->create(['path' => '']);

        $this->artisan('images:attached-registry-audit', ['--fail-on-issues' => true])
            ->assertExitCode(1);
    }

    public function test_command_outputs_json(): void
    {
        ItemImage::factory()->create(['path' => 'json-test.jpg']);
        Storage::disk($this->disk)->put($this->directory.'/json-test.jpg', 'data');

        $this->artisan('images:attached-registry-audit', ['--json' => true])
            ->expectsOutputToContain('"missing_originals": []')
            ->assertExitCode(0);
    }

    public function test_command_succeeds_without_records(): void
    {
        $this->artisan('images:attached-registry-audit')
            ->assertExitCode(0);
    }

    public function test_command_does_not_fail_by_default_even_with_issues(): void
    {
        ItemImage::factory()->create(['path' => 'ghost.jpg']);

        $this->artisan('images:attached-registry-audit')
            ->assertExitCode(0);
    }
}
