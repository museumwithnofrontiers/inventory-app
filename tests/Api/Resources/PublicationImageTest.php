<?php

namespace Tests\Api\Resources;

use App\Models\AvailableImage;
use App\Models\Publication;
use App\Models\PublicationEdition;
use App\Models\PublicationImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiImageResource;
use Tests\Api\Traits\TestsApiImageViewing;
use Tests\TestCase;

class PublicationImageTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiImageResource;
    use TestsApiImageViewing {
        TestsApiImageResource::getFactoryData insteadof TestsApiImageViewing;
        TestsApiImageResource::hasColumn insteadof TestsApiImageViewing;
    }

    protected function getResourceName(): string
    {
        return 'publication-image';
    }

    protected function getModelClass(): string
    {
        return PublicationImage::class;
    }

    protected function servesBurnedImage(): bool
    {
        return true;
    }

    protected function getParentModel()
    {
        return Publication::factory()->create();
    }

    protected function getParentRelation(): string
    {
        return 'publication';
    }

    protected function usesNestedRoutes(): bool
    {
        return true;
    }

    public function test_attach_swaps_an_available_image_into_a_cover_of_an_edition(): void
    {
        Storage::fake('public');
        $publication = Publication::factory()->create();
        $edition = PublicationEdition::factory()->forPublication($publication)->create();
        $available = AvailableImage::factory()->create(['path' => 'cover.jpg', 'copyright' => '© A partner']);

        $this->postJson(route('publication.attachImage', ['publication' => $publication, 'include' => 'publicationEdition']), [
            'available_image_id' => $available->id,
            'alt_text' => 'The cover',
            'kind' => 'cover',
            'publication_edition_id' => $edition->id,
        ])->assertCreated()
            ->assertJsonPath('data.id', $available->id)
            ->assertJsonPath('data.kind', 'cover')
            ->assertJsonPath('data.path', 'cover.jpg')
            ->assertJsonPath('data.copyright', '© A partner')
            ->assertJsonPath('data.publicationEdition.id', $edition->id);

        $this->assertDatabaseMissing('available_images', ['id' => $available->id]);
    }

    public function test_attach_defaults_to_a_page_and_refuses_another_publications_edition(): void
    {
        $publication = Publication::factory()->create();
        $foreignEdition = PublicationEdition::factory()->create();
        $available = AvailableImage::factory()->create();

        $this->postJson(route('publication.attachImage', $publication), [
            'available_image_id' => $available->id,
            'publication_edition_id' => $foreignEdition->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['publication_edition_id']);

        $this->postJson(route('publication.attachImage', $publication), ['available_image_id' => $available->id])
            ->assertCreated()
            ->assertJsonPath('data.kind', 'page');
    }

    public function test_detach_returns_the_image_to_the_pool(): void
    {
        Storage::fake('public');
        $image = PublicationImage::factory()->create(['path' => 'page-1.jpg']);

        $this->postJson(route('publication-image.detach', $image))
            ->assertOk();

        $this->assertDatabaseMissing('publication_images', ['id' => $image->id]);
        $this->assertDatabaseHas('available_images', ['id' => $image->id, 'path' => 'page-1.jpg']);
    }

    public function test_deleting_an_edition_keeps_its_covers(): void
    {
        $edition = PublicationEdition::factory()->create();
        $cover = PublicationImage::factory()->cover()->create([
            'publication_id' => $edition->publication_id,
            'publication_edition_id' => $edition->id,
        ]);

        $edition->delete();

        $this->assertDatabaseHas('publication_images', ['id' => $cover->id, 'publication_edition_id' => null]);
    }
}
