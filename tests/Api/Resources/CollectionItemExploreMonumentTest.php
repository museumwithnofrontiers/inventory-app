<?php

namespace Tests\Api\Resources;

use App\Models\Collection;
use App\Models\CollectionItemExploreMonument;
use App\Models\Partner;
use Database\Factories\CollectionItemTranslationFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

/**
 * M16 C4 (#2644): the Explore monuments a placement stands for.
 */
class CollectionItemExploreMonumentTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    public function test_store_list_show_update_and_destroy(): void
    {
        $placement = CollectionItemTranslationFactory::newPlacement();
        $location = Collection::factory()->create(['backward_compatibility' => 'mwnf3_explore:location:539']);
        [$first, $second] = Partner::factory()->count(2)->create()->all();

        $id = $this->postJson(route('collection-item-explore-monument.store'), [
            'collection_item_id' => $placement->id,
            'position' => 1,
            'backward_compatibility' => 'mwnf3_explore:monument:1440',
            'latitude' => 34.030727,
            'longitude' => -6.835677,
            'map_zoom' => 16,
            'location_collection_id' => $location->id,
            'description_types' => 'ET#1,VM#2',
            'partner_ids' => [$second->id, $first->id],
        ])->assertCreated()
            ->assertJsonPath('data.backward_compatibility', 'mwnf3_explore:monument:1440')
            ->assertJsonPath('data.map_zoom', 16)
            ->assertJsonPath('data.partner_ids', [$second->id, $first->id])
            ->json('data.id');

        $this->getJson(route('collection-item-explore-monument.index', ['collection_item_id' => $placement->id, 'include' => 'locationCollection']))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.location_collection.id', $location->id);

        $this->getJson(route('collection-item-explore-monument.show', $id))
            ->assertOk()
            ->assertJsonPath('data.description_types', 'ET#1,VM#2');

        $this->patchJson(route('collection-item-explore-monument.update', $id), ['partner_ids' => [$first->id], 'map_zoom' => 17])
            ->assertOk()
            ->assertJsonPath('data.map_zoom', 17)
            ->assertJsonPath('data.partner_ids', [$first->id])
            ->assertJsonPath('data.latitude', 34.030727);

        $this->deleteJson(route('collection-item-explore-monument.destroy', $id))->assertNoContent();
        $this->assertDatabaseMissing('collection_item_explore_monuments', ['id' => $id]);
        $this->assertDatabaseMissing('collection_item_explore_monument_partner', ['collection_item_explore_monument_id' => $id]);
    }

    public function test_store_refuses_a_missing_placement_a_taken_position_and_an_unknown_partner(): void
    {
        $monument = CollectionItemExploreMonument::factory()->create();

        $this->postJson(route('collection-item-explore-monument.store'), [
            'collection_item_id' => '00000000-0000-4000-8000-000000000000',
            'position' => 1,
            'backward_compatibility' => 'mwnf3_explore:monument:1',
        ])->assertUnprocessable()->assertJsonValidationErrors(['collection_item_id']);

        $this->postJson(route('collection-item-explore-monument.store'), [
            'collection_item_id' => $monument->collection_item_id,
            'position' => $monument->position,
            'backward_compatibility' => 'mwnf3_explore:monument:1',
            'partner_ids' => ['00000000-0000-4000-8000-000000000000'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['position', 'partner_ids.0']);
    }

    public function test_detaching_the_item_deletes_its_explore_monuments(): void
    {
        $monument = CollectionItemExploreMonument::factory()->create();
        $placement = $monument->collectionItem;
        $this->assertNotNull($placement);

        Collection::findOrFail($placement->collection_id)->attachedItems()->detach($placement->item_id);

        $this->assertDatabaseMissing('collection_item_explore_monuments', ['id' => $monument->id]);
    }
}
