<?php

namespace Tests\Api\Resources;

use App\Models\CollectionImage;
use App\Models\ImageTranslation;
use App\Models\ItemImage;
use App\Models\Language;
use App\Support\Images\AttachedImageRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

/**
 * M16 F2 (#2652): an image's texts per language, polymorphic over the
 * AttachedImageRegistry.
 */
class ImageTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    public function test_every_registry_model_has_a_morph_alias(): void
    {
        $aliases = AttachedImageRegistry::morphAliases();

        foreach (AttachedImageRegistry::modelClasses() as $class) {
            $this->assertContains($class, $aliases);
            $this->assertSame(array_search($class, $aliases, true), (new $class)->getMorphClass());
        }
        $this->assertSame('item_image', (new ItemImage)->getMorphClass());
    }

    public function test_store_list_update_and_destroy(): void
    {
        $image = CollectionImage::factory()->create();
        $language = Language::factory()->create();

        $id = $this->postJson(route('image-translation.store'), [
            'image_type' => 'collection_image',
            'image_id' => $image->id,
            'language_id' => $language->id,
            'name' => 'Map of Spain, with provinces',
            'date' => '1845',
            'museum' => 'National Museum of Romanticism',
            'location' => 'Madrid, Spain',
        ])->assertCreated()
            ->assertJsonPath('data.museum', 'National Museum of Romanticism')
            ->json('data.id');

        $this->getJson(route('image-translation.index', ['image_type' => 'collection_image', 'image_id' => $image->id]))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id);

        $this->patchJson(route('image-translation.update', $id), ['caption' => '1815'])
            ->assertOk()
            ->assertJsonPath('data.caption', '1815')
            ->assertJsonPath('data.name', 'Map of Spain, with provinces');

        $this->patchJson(route('image-translation.update', $id), ['language_id' => $language->id])
            ->assertUnprocessable();

        $this->deleteJson(route('image-translation.destroy', $id))->assertNoContent();
        $this->assertDatabaseMissing('image_translations', ['id' => $id]);
    }

    public function test_store_refuses_an_unknown_image_kind_a_missing_image_and_a_second_row_per_language(): void
    {
        $image = ItemImage::factory()->create();
        $language = Language::factory()->create();
        ImageTranslation::factory()->of($image)->create(['language_id' => $language->id]);

        $this->postJson(route('image-translation.store'), [
            'image_type' => 'item', 'image_id' => $image->id, 'language_id' => $language->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['image_type']);

        $this->postJson(route('image-translation.store'), [
            'image_type' => 'item_image', 'image_id' => '00000000-0000-4000-8000-000000000000', 'language_id' => $language->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['image_id']);

        $this->postJson(route('image-translation.store'), [
            'image_type' => 'item_image', 'image_id' => $image->id, 'language_id' => $language->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['language_id']);
    }

    public function test_the_texts_follow_the_image_through_detach_and_attach(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $image = ItemImage::factory()->create();
        $itemId = $image->item_id;
        $text = ImageTranslation::factory()->of($image)->create(['caption' => 'A caption']);

        $available = $image->detachToAvailableImage();
        $this->assertDatabaseHas('image_translations', ['id' => $text->id, 'image_type' => 'available_image', 'image_id' => $image->id]);

        ItemImage::attachFromAvailableImage($available, $itemId);
        $this->assertDatabaseHas('image_translations', ['id' => $text->id, 'image_type' => 'item_image', 'image_id' => $image->id]);
    }

    public function test_deleting_an_image_deletes_its_texts(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $image = ItemImage::factory()->create();
        $text = ImageTranslation::factory()->of($image)->create();

        $image->delete();

        $this->assertDatabaseMissing('image_translations', ['id' => $text->id]);
    }
}
