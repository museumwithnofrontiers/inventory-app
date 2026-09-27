<?php

namespace Tests\Console;

use App\Models\Item;
use App\Models\ItemDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CleanupDocumentOrphansCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $disk;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->disk = config('localstorage.documents.disk');
        $this->directory = trim(config('localstorage.documents.directory'), '/');
        Storage::fake($this->disk);
    }

    public function test_dry_run_reports_orphans_and_deletes_nothing(): void
    {
        $orphanPath = $this->directory.'/orphan.pdf';
        Storage::disk($this->disk)->put($orphanPath, 'orphan-data');

        $this->artisan('documents:cleanup-orphans', ['--older-than' => '0m'])
            ->expectsOutputToContain($orphanPath)
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($orphanPath);
    }

    public function test_files_referenced_by_an_item_document_are_kept(): void
    {
        ItemDocument::factory()->create(['path' => 'attached.pdf']);
        foreach (['attached.pdf', 'orphan.pdf'] as $file) {
            Storage::disk($this->disk)->put($this->directory.'/'.$file, 'data');
        }

        $this->artisan('documents:cleanup-orphans', ['--delete' => true, '--force' => true, '--older-than' => '0m'])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($this->directory.'/attached.pdf');
        Storage::disk($this->disk)->assertMissing($this->directory.'/orphan.pdf');
    }

    public function test_documents_left_behind_by_a_database_cascade_are_found_and_deleted(): void
    {
        $item = Item::factory()->create();
        ItemDocument::factory()->create(['item_id' => $item->id, 'path' => 'cascaded.pdf']);
        Storage::disk($this->disk)->put($this->directory.'/cascaded.pdf', 'data');

        // A bulk delete: the item_documents row goes by the foreign key's
        // cascade, with no Eloquent event to remove its file
        Item::query()->whereKey($item->id)->delete();
        $this->assertDatabaseMissing('item_documents', ['path' => 'cascaded.pdf']);
        Storage::disk($this->disk)->assertExists($this->directory.'/cascaded.pdf');

        $this->artisan('documents:cleanup-orphans', ['--older-than' => '0m'])
            ->expectsOutputToContain($this->directory.'/cascaded.pdf')
            ->assertExitCode(0);

        $this->artisan('documents:cleanup-orphans', ['--delete' => true, '--force' => true, '--older-than' => '0m'])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertMissing($this->directory.'/cascaded.pdf');
    }

    public function test_a_file_within_the_default_grace_period_is_not_deleted(): void
    {
        // DocumentUploadListener::promote() writes the file before the
        // ItemDocument row is created.
        $uploadPath = $this->directory.'/just-uploaded.pdf';
        Storage::disk($this->disk)->put($uploadPath, 'data');

        $this->artisan('documents:cleanup-orphans', ['--delete' => true, '--force' => true])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($uploadPath);

        // Past the grace period, it's an orphan like any other
        $this->travel(2)->hours();

        $this->artisan('documents:cleanup-orphans', ['--delete' => true, '--force' => true])
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertMissing($uploadPath);
    }

    public function test_confirmation_is_required_without_force(): void
    {
        Storage::disk($this->disk)->put($this->directory.'/orphan.pdf', 'data');

        $this->artisan('documents:cleanup-orphans', ['--delete' => true, '--older-than' => '0m'])
            ->expectsConfirmation("Delete 1 orphaned file(s) from disk '{$this->disk}'?", 'no')
            ->expectsOutput('Aborted. No files were deleted.')
            ->assertExitCode(0);

        Storage::disk($this->disk)->assertExists($this->directory.'/orphan.pdf');
    }

    public function test_limit_restricts_number_of_deletions(): void
    {
        foreach (['a.pdf', 'b.pdf', 'c.pdf'] as $file) {
            Storage::disk($this->disk)->put($this->directory.'/'.$file, 'data');
        }

        $this->artisan('documents:cleanup-orphans', ['--delete' => true, '--force' => true, '--older-than' => '0m', '--limit' => '1'])
            ->assertExitCode(0);

        $this->assertCount(2, Storage::disk($this->disk)->allFiles($this->directory));
    }

    public function test_json_output_reports_the_orphans(): void
    {
        Storage::disk($this->disk)->put($this->directory.'/orphan.pdf', 'data');

        $this->artisan('documents:cleanup-orphans', ['--json' => true, '--older-than' => '0m'])
            ->expectsOutputToContain('"orphan_candidates": 1')
            ->assertExitCode(0);
    }

    public function test_invalid_options_return_failure(): void
    {
        $this->artisan('documents:cleanup-orphans', ['--limit' => 'abc'])->assertExitCode(1);
        $this->artisan('documents:cleanup-orphans', ['--older-than' => 'invalid'])->assertExitCode(1);
    }
}
