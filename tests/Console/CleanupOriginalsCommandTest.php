<?php

namespace Tests\Console;

use App\Models\AvailableImage;
use App\Models\Item;
use App\Models\ItemImage;
use App\Models\PartnerLogo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CleanupOriginalsCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $disk;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->disk = config('localstorage.available.images.disk');
        $this->directory = trim(config('localstorage.available.images.directory'), '/');
        Storage::fake($this->disk);
    }

    public function test_dry_run_reports_orphans_and_deletes_nothing(): void
    {
        $orphanPath = $this->directory.'/orphan.jpg';
        Storage::disk($this->disk)->put($orphanPath, 'orphan-data');

        $this->artisan('images:cleanup-originals', ['--older-than' => '0m'])
            ->expectsOutputToContain($orphanPath)
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($orphanPath);
    }

    public function test_files_referenced_by_attached_or_available_images_are_kept(): void
    {
        ItemImage::factory()->create(['path' => 'attached.jpg']);
        PartnerLogo::factory()->create(['path' => 'logo.jpg']);
        AvailableImage::factory()->create(['path' => 'available.jpg']);
        foreach (['attached.jpg', 'logo.jpg', 'available.jpg', 'orphan.jpg'] as $file) {
            Storage::disk($this->disk)->put($this->directory.'/'.$file, 'data');
        }

        $this->artisan('images:cleanup-originals', ['--delete' => true, '--force' => true, '--older-than' => '0m'])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($this->directory.'/attached.jpg');
        Storage::disk($this->disk)->assertExists($this->directory.'/logo.jpg');
        // Deleting an AvailableImage's file would lose the upload
        Storage::disk($this->disk)->assertExists($this->directory.'/available.jpg');
        Storage::disk($this->disk)->assertMissing($this->directory.'/orphan.jpg');
    }

    public function test_originals_left_behind_by_a_database_cascade_are_found_and_deleted(): void
    {
        $item = Item::factory()->create();
        ItemImage::factory()->create(['item_id' => $item->id, 'path' => 'cascaded.jpg']);
        Storage::disk($this->disk)->put($this->directory.'/cascaded.jpg', 'data');

        // A bulk delete: the item_images row goes by the foreign key's
        // cascade, with no Eloquent event to remove its file
        Item::query()->whereKey($item->id)->delete();
        $this->assertDatabaseMissing('item_images', ['path' => 'cascaded.jpg']);
        Storage::disk($this->disk)->assertExists($this->directory.'/cascaded.jpg');

        $this->artisan('images:cleanup-originals', ['--older-than' => '0m'])
            ->expectsOutputToContain($this->directory.'/cascaded.jpg')
            ->assertExitCode(0);

        $this->artisan('images:cleanup-originals', ['--delete' => true, '--force' => true, '--older-than' => '0m'])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertMissing($this->directory.'/cascaded.jpg');
    }

    public function test_a_file_within_the_default_grace_period_is_not_deleted(): void
    {
        // ImageUploadListener writes the file before the AvailableImage row
        $uploadPath = $this->directory.'/just-uploaded.jpg';
        Storage::disk($this->disk)->put($uploadPath, 'data');

        $this->artisan('images:cleanup-originals', ['--delete' => true, '--force' => true])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($uploadPath);

        // Past the grace period, it's an orphan like any other
        $this->travel(2)->hours();

        $this->artisan('images:cleanup-originals', ['--delete' => true, '--force' => true])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertMissing($uploadPath);
    }

    public function test_confirmation_is_required_without_force(): void
    {
        Storage::disk($this->disk)->put($this->directory.'/orphan.jpg', 'data');

        $this->artisan('images:cleanup-originals', ['--delete' => true, '--older-than' => '0m'])
            ->expectsConfirmation("Delete 1 orphaned file(s) from disk '{$this->disk}'?", 'no')
            ->expectsOutput('Aborted. No files were deleted.')
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($this->directory.'/orphan.jpg');
    }

    public function test_limit_restricts_number_of_deletions(): void
    {
        foreach (['a.jpg', 'b.jpg', 'c.jpg'] as $file) {
            Storage::disk($this->disk)->put($this->directory.'/'.$file, 'data');
        }

        $this->artisan('images:cleanup-originals', ['--delete' => true, '--force' => true, '--older-than' => '0m', '--limit' => '1'])
            ->assertExitCode(0);

        $this->assertCount(2, Storage::disk($this->disk)->allFiles($this->directory));
    }

    public function test_json_output_reports_the_orphans(): void
    {
        Storage::disk($this->disk)->put($this->directory.'/orphan.jpg', 'data');

        $this->artisan('images:cleanup-originals', ['--json' => true, '--older-than' => '0m'])
            ->expectsOutputToContain('"orphan_candidates": 1')
            ->assertExitCode(0);
    }

    public function test_invalid_options_return_failure(): void
    {
        $this->artisan('images:cleanup-originals', ['--limit' => 'abc'])->assertExitCode(1);
        $this->artisan('images:cleanup-originals', ['--older-than' => 'invalid'])->assertExitCode(1);
    }
}
