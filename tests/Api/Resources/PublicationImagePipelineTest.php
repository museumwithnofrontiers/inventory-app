<?php

namespace Tests\Api\Resources;

use App\Events\ImageUploadEvent;
use App\Models\AvailableImage;
use App\Models\ImageUpload;
use App\Models\Project;
use App\Models\Publication;
use App\Models\PublicationImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

/**
 * A publication's cover goes through the canonical pipeline, end to end,
 * with the real events: upload, validated AvailableImage, attach (a row
 * swap), the burned rendition at /pub, detach, and delete.
 */
class PublicationImagePipelineTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    public function test_a_cover_goes_from_upload_to_pub_and_back_to_the_pool(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        // The originals disk is faked by the base TestCase.
        $originals = Storage::disk(config('localstorage.available.images.disk'));
        $originalsDir = trim(config('localstorage.available.images.directory'), '/');
        $pictures = Storage::disk(config('localstorage.pictures.disk'));
        $picturesDir = trim(config('localstorage.pictures.directory'), '/');

        // 1-4. Upload, as the panel's upload does: ImageUpload on the private
        // uploads disk, then the real ImageUploadEvent → ImageUploadListener
        // → AvailableImageEvent → AvailableImageListener
        $stored = UploadedFile::fake()->image('cover.jpg', 400, 600)->store(
            config('localstorage.uploads.images.directory'),
            config('localstorage.uploads.images.disk'),
        );
        $this->assertIsString($stored);
        $upload = ImageUpload::create([
            'path' => $stored,
            'name' => 'cover.jpg',
            'extension' => 'jpg',
            'mime_type' => null,
            'size' => null,
        ]);
        ImageUploadEvent::dispatch($upload);

        $available = AvailableImage::query()->findOrFail($upload->id);
        $this->assertDatabaseMissing('image_uploads', ['id' => $upload->id]);
        $originalPath = $originalsDir.'/'.$available->path;
        $originals->assertExists($originalPath);

        // 5. Attach: a row swap, the original never moves
        $project = Project::factory()->create(['copyright' => '© Islamic Art in the Mediterranean']);
        $publication = Publication::factory()->forProject($project)->create();

        $this->postJson(route('publication.attachImage', $publication), [
            'available_image_id' => $available->id,
            'kind' => 'cover',
        ])->assertCreated()
            ->assertJsonPath('data.id', $available->id);

        $image = PublicationImage::query()->findOrFail($available->id);
        $this->assertSame($available->path, $image->path);
        $this->assertSame('© Islamic Art in the Mediterranean', $image->resolveCopyright());
        $originals->assertExists($originalPath);
        $pictures->assertMissing($picturesDir.'/'.$image->path);

        // Serving: /pub burns the copyright in and caches the rendition
        $this->get(route('pub.picture', ['filename' => $image->path]))->assertOk();
        $pictures->assertExists($picturesDir.'/'.$image->path);

        // Detach: back to the pool, the burned rendition goes, the original stays
        $this->postJson(route('publication-image.detach', $image))->assertOk();
        $this->assertDatabaseHas('available_images', ['id' => $image->id, 'path' => $image->path]);
        $pictures->assertMissing($picturesDir.'/'.$image->path);
        $originals->assertExists($originalPath);
        $this->get(route('pub.picture', ['filename' => $image->path]))->assertNotFound();

        // 6. Delete: an attached image takes its original with it
        $this->postJson(route('publication.attachImage', $publication), ['available_image_id' => $image->id])->assertCreated();
        $this->deleteJson(route('publication-image.destroy', $image->id))->assertNoContent();
        $originals->assertMissing($originalPath);
    }
}
