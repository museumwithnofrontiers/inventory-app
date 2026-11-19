<?php

namespace Tests\Api\Resources;

use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\CollectionItemTranslation;
use App\Models\Item;
use App\Models\Language;
use Database\Factories\CollectionItemTranslationFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

/**
 * M16 C2 (#2642): a placement's texts per language.
 */
class CollectionItemTranslationTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    public function test_store_list_show_update_and_destroy(): void
    {
        $placement = CollectionItemTranslationFactory::newPlacement();
        $language = Language::factory()->create();

        $id = $this->postJson(route('collection-item-translation.store'), [
            'collection_item_id' => $placement->id,
            'language_id' => $language->id,
            'description' => 'The fountain on this page.',
            'item_name' => 'The Hercules fountain',
            'curator_justification' => 'A curator chose it.',
            'backward_compatibility' => 'mwnf3_thematic_gallery:theme_item_i18n:1:2:3:en',
        ])->assertCreated()
            ->assertJsonPath('data.item_name', 'The Hercules fountain')
            ->assertJsonPath('data.partner_justification', null)
            ->json('data.id');

        $this->getJson(route('collection-item-translation.index', ['collection_item_id' => $placement->id, 'include' => 'language']))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.language.id', $language->id);

        $this->getJson(route('collection-item-translation.show', $id))
            ->assertOk()
            ->assertJsonPath('data.description', 'The fountain on this page.');

        $this->patchJson(route('collection-item-translation.update', $id), ['caption' => 'Orientalist painting (detail)'])
            ->assertOk()
            ->assertJsonPath('data.caption', 'Orientalist painting (detail)')
            ->assertJsonPath('data.item_name', 'The Hercules fountain');

        $this->patchJson(route('collection-item-translation.update', $id), ['collection_item_id' => $placement->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['collection_item_id']);

        $this->deleteJson(route('collection-item-translation.destroy', $id))->assertNoContent();
        $this->assertDatabaseMissing('collection_item_translations', ['id' => $id]);
    }

    public function test_store_refuses_a_missing_placement_and_a_second_row_per_language(): void
    {
        $translation = CollectionItemTranslation::factory()->create();

        $this->postJson(route('collection-item-translation.store'), [
            'collection_item_id' => '00000000-0000-4000-8000-000000000000',
            'language_id' => $translation->language_id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['collection_item_id']);

        $this->postJson(route('collection-item-translation.store'), [
            'collection_item_id' => $translation->collection_item_id,
            'language_id' => $translation->language_id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['language_id']);
    }

    public function test_each_placement_of_one_item_keeps_its_own_texts(): void
    {
        $item = Item::factory()->Object()->create();
        $language = Language::factory()->create();
        $first = Collection::factory()->create();
        $second = Collection::factory()->create();
        $first->attachedItems()->attach($item->id);
        $second->attachedItems()->attach($item->id);

        $placements = CollectionItem::query()->where('item_id', $item->id)->orderBy('collection_id')->get();
        $this->assertCount(2, $placements);
        foreach ($placements as $index => $placement) {
            CollectionItemTranslation::factory()->forPlacement($placement)->create([
                'language_id' => $language->id,
                'item_name' => "Caption {$index}",
            ]);
        }

        $this->assertSame(['Caption 0', 'Caption 1'], CollectionItemTranslation::query()
            ->whereIn('collection_item_id', $placements->pluck('id'))
            ->orderBy('item_name')
            ->pluck('item_name')
            ->all());
    }

    public function test_detaching_the_item_deletes_the_placement_texts(): void
    {
        $translation = CollectionItemTranslation::factory()->create();
        $placement = $translation->collectionItem;
        $this->assertNotNull($placement);

        Collection::findOrFail($placement->collection_id)->attachedItems()->detach($placement->item_id);

        $this->assertDatabaseMissing('collection_item_translations', ['id' => $translation->id]);
    }
}
