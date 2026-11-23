<?php

namespace Tests\Api\Resources;

use App\Models\AvailableImage;
use App\Models\ImageUpload;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

/**
 * An image uploaded through the REST API goes through the canonical
 * pipeline with the real events, exactly as a panel upload does: the
 * ImageUpload is processed into an AvailableImage whose original sits on
 * the private originals disk, and nothing is left on the uploads disk.
 */
class ImageUploadPipelineTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    /**
     * The uploads and pictures disks; the base TestCase fakes the originals
     * disk. (A setUp() here would replace AuthenticatesApiRequests' own.)
     */
    private function fakeDisks(): void
    {
        Storage::fake('local');
        Storage::fake('public');
    }

    public function test_an_api_upload_becomes_an_available_image_with_its_original(): void
    {
        $this->fakeDisks();
        $uploads = Storage::disk(config('localstorage.uploads.images.disk'));
        $uploadsDir = trim(config('localstorage.uploads.images.directory'), '/');
        $originals = Storage::disk(config('localstorage.available.images.disk'));
        $originalsDir = trim(config('localstorage.available.images.directory'), '/');

        $id = $this->postJson(route('image-upload.store'), [
            'file' => UploadedFile::fake()->image('photo.jpg', 300, 200),
        ])->assertCreated()->json('data.id');
        $this->assertIsString($id);

        $available = AvailableImage::query()->find($id);
        $this->assertNotNull($available, 'The API upload never became an AvailableImage.');
        $this->assertDatabaseMissing('image_uploads', ['id' => $id]);
        $this->assertSame('photo.jpg', $available->original_name);
        $originals->assertExists($originalsDir.'/'.$available->path);
        $this->assertSame([], $uploads->files($uploadsDir));
        Storage::disk('public')->assertDirectoryEmpty('/');

        $this->getJson(route('image-upload.status', $id))
            ->assertOk()
            ->assertJsonPath('data.status', 'processed');
    }

    public function test_the_pipeline_logs_no_error_for_a_valid_upload(): void
    {
        $this->fakeDisks();
        Log::spy();

        $this->postJson(route('image-upload.store'), [
            'file' => UploadedFile::fake()->image('photo.png', 120, 80),
        ])->assertCreated();

        Log::shouldNotHaveReceived('error');
    }

    public function test_the_api_and_the_panel_path_shapes_resolve_to_the_same_file(): void
    {
        $uploadsDir = trim(config('localstorage.uploads.images.directory'), '/');

        // The API stores the filename, the panel's FileUpload the directory too
        $fromApi = new ImageUpload(['path' => 'abc.jpg']);
        $fromPanel = new ImageUpload(['path' => $uploadsDir.'/abc.jpg']);

        $this->assertSame($uploadsDir.'/abc.jpg', $fromApi->storagePath());
        $this->assertSame($uploadsDir.'/abc.jpg', $fromPanel->storagePath());
        $this->assertNull((new ImageUpload)->storagePath());
    }

    public function test_deleting_a_pending_upload_removes_its_file_from_the_uploads_disk(): void
    {
        $this->fakeDisks();
        $uploads = Storage::disk(config('localstorage.uploads.images.disk'));
        $uploadsDir = trim(config('localstorage.uploads.images.directory'), '/');
        $uploads->put($uploadsDir.'/pending.jpg', 'not processed yet');
        $upload = ImageUpload::query()->create([
            'path' => 'pending.jpg',
            'name' => 'pending.jpg',
            'extension' => 'jpg',
        ]);

        $this->deleteJson(route('image-upload.destroy', $upload))->assertNoContent();

        $this->assertDatabaseMissing('image_uploads', ['id' => $upload->id]);
        $uploads->assertMissing($uploadsDir.'/pending.jpg');
    }
}
