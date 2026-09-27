<?php

namespace Tests\Console;

use App\Models\DocumentUpload;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CleanupPendingDocumentsCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $disk;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->disk = config('localstorage.uploads.documents.disk');
        $this->directory = trim(config('localstorage.uploads.documents.directory'), '/');
        Storage::fake($this->disk);
    }

    private function putPendingFile(DocumentUpload $documentUpload, string $contents = 'pending-bytes'): string
    {
        $path = $this->directory.'/'.$documentUpload->path;
        Storage::disk($this->disk)->put($path, $contents);

        return $path;
    }

    public function test_dry_run_reports_stale_rows_and_deletes_nothing(): void
    {
        $stale = DocumentUpload::factory()->create(['path' => 'stale.pdf', 'created_at' => now()->subHours(2)]);
        $path = $this->putPendingFile($stale);

        $this->artisan('documents:cleanup-pending', ['--older-than' => '0m'])
            ->expectsOutputToContain($path)
            ->assertExitCode(0);

        $this->assertDatabaseHas('document_uploads', ['id' => $stale->id]);
        Storage::disk($this->disk)->assertExists($path);
    }

    public function test_a_row_within_the_default_grace_period_is_kept(): void
    {
        $fresh = DocumentUpload::factory()->create(['path' => 'fresh.pdf']);
        $path = $this->putPendingFile($fresh);

        $this->artisan('documents:cleanup-pending', ['--delete' => true, '--force' => true])
            ->assertExitCode(0);

        $this->assertDatabaseHas('document_uploads', ['id' => $fresh->id]);
        Storage::disk($this->disk)->assertExists($path);

        // Past the grace period, it's stale like any other
        $this->travel(2)->hours();

        $this->artisan('documents:cleanup-pending', ['--delete' => true, '--force' => true])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('document_uploads', ['id' => $fresh->id]);
        Storage::disk($this->disk)->assertMissing($path);
    }

    public function test_delete_removes_the_row_and_its_pending_file(): void
    {
        $stale = DocumentUpload::factory()->create(['path' => 'stale.pdf', 'created_at' => now()->subHours(2)]);
        $path = $this->putPendingFile($stale);

        $this->artisan('documents:cleanup-pending', ['--delete' => true, '--force' => true, '--older-than' => '0m'])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('document_uploads', ['id' => $stale->id]);
        Storage::disk($this->disk)->assertMissing($path);
    }

    public function test_confirmation_is_required_without_force(): void
    {
        $stale = DocumentUpload::factory()->create(['path' => 'stale.pdf', 'created_at' => now()->subHours(2)]);
        $this->putPendingFile($stale);

        $this->artisan('documents:cleanup-pending', ['--delete' => true, '--older-than' => '0m'])
            ->expectsConfirmation("Delete 1 stale document upload(s) from disk '{$this->disk}'?", 'no')
            ->expectsOutput('Aborted. No files were deleted.')
            ->assertExitCode(0);

        $this->assertDatabaseHas('document_uploads', ['id' => $stale->id]);
    }

    public function test_limit_restricts_number_of_deletions(): void
    {
        foreach (['a.pdf', 'b.pdf', 'c.pdf'] as $file) {
            $row = DocumentUpload::factory()->create(['path' => $file, 'created_at' => now()->subHours(2)]);
            $this->putPendingFile($row);
        }

        $this->artisan('documents:cleanup-pending', ['--delete' => true, '--force' => true, '--older-than' => '0m', '--limit' => '1'])
            ->assertExitCode(0);

        $this->assertSame(2, DocumentUpload::query()->count());
    }

    public function test_json_output_reports_the_stale_rows(): void
    {
        $stale = DocumentUpload::factory()->create(['path' => 'stale.pdf', 'created_at' => now()->subHours(2)]);
        $this->putPendingFile($stale);

        $this->artisan('documents:cleanup-pending', ['--json' => true, '--older-than' => '0m'])
            ->expectsOutputToContain('"orphan_candidates": 1')
            ->assertExitCode(0);
    }

    public function test_invalid_options_return_failure(): void
    {
        $this->artisan('documents:cleanup-pending', ['--limit' => 'abc'])->assertExitCode(1);
        $this->artisan('documents:cleanup-pending', ['--older-than' => 'invalid'])->assertExitCode(1);
    }
}
