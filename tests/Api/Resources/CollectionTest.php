<?php

namespace Tests\Api\Resources;

use App\Models\Collection;
use App\Models\Context;
use App\Models\Country;
use App\Models\Item;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class CollectionTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'collection';
    }

    protected function getModelClass(): string
    {
        return Collection::class;
    }

    public function test_can_create_collection_with_purpose(): void
    {
        $data = Collection::factory()->make()->toArray();
        $data['purpose'] = Collection::PURPOSE_EXHIBITIONS_ROOT;

        $response = $this->postJson(route('collection.store'), $data);

        $response->assertCreated()
            ->assertJsonPath('data.purpose', Collection::PURPOSE_EXHIBITIONS_ROOT);

        $this->assertDatabaseHas('collections', [
            'internal_name' => $data['internal_name'],
            'purpose' => Collection::PURPOSE_EXHIBITIONS_ROOT,
        ]);
    }

    public function test_cannot_create_collection_with_unknown_purpose(): void
    {
        $data = Collection::factory()->make()->toArray();
        $data['purpose'] = 'not-a-known-purpose';

        $response = $this->postJson(route('collection.store'), $data);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['purpose']);
    }

    public function test_root_purpose_is_unique_per_context(): void
    {
        $context = Context::factory()->create();
        Collection::factory()
            ->withContext($context->id)
            ->withPurpose(Collection::PURPOSE_EXHIBITIONS_ROOT)
            ->create();

        $data = Collection::factory()->make(['context_id' => $context->id])->toArray();
        $data['purpose'] = Collection::PURPOSE_EXHIBITIONS_ROOT;

        $response = $this->postJson(route('collection.store'), $data);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['purpose']);
    }

    public function test_same_root_purpose_is_allowed_in_different_contexts(): void
    {
        Collection::factory()
            ->withPurpose(Collection::PURPOSE_EXHIBITIONS_ROOT)
            ->create();

        $data = Collection::factory()->make()->toArray();
        $data['purpose'] = Collection::PURPOSE_EXHIBITIONS_ROOT;

        $response = $this->postJson(route('collection.store'), $data);

        $response->assertCreated()
            ->assertJsonPath('data.purpose', Collection::PURPOSE_EXHIBITIONS_ROOT);
    }

    public function test_national_context_purpose_may_repeat_within_a_context(): void
    {
        $context = Context::factory()->create();
        Collection::factory()
            ->withContext($context->id)
            ->withPurpose(Collection::PURPOSE_NATIONAL_CONTEXT)
            ->create();

        $data = Collection::factory()->make(['context_id' => $context->id])->toArray();
        $data['purpose'] = Collection::PURPOSE_NATIONAL_CONTEXT;

        $response = $this->postJson(route('collection.store'), $data);

        $response->assertCreated()
            ->assertJsonPath('data.purpose', Collection::PURPOSE_NATIONAL_CONTEXT);
    }

    public function test_can_update_collection_purpose_and_clear_it(): void
    {
        $collection = Collection::factory()->create();

        $response = $this->putJson(route('collection.update', $collection), [
            'purpose' => Collection::PURPOSE_HISTORICAL_PROFILES_ROOT,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.purpose', Collection::PURPOSE_HISTORICAL_PROFILES_ROOT);

        $response = $this->putJson(route('collection.update', $collection), [
            'purpose' => null,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.purpose', null);

        $this->assertDatabaseHas('collections', [
            'id' => $collection->id,
            'purpose' => null,
        ]);
    }

    public function test_can_create_collection_with_extra(): void
    {
        $data = Collection::factory()->make()->toArray();
        $data['extra'] = ['thg_gallery' => ['mwnf3_project_id' => 'DCA', 'slug' => 'carpets']];

        $response = $this->postJson(route('collection.store'), $data);

        $response->assertCreated()
            ->assertJsonPath('data.extra.thg_gallery.mwnf3_project_id', 'DCA')
            ->assertJsonPath('data.extra.thg_gallery.slug', 'carpets');
    }

    public function test_cannot_create_collection_with_scalar_extra(): void
    {
        $data = Collection::factory()->make()->toArray();
        $data['extra'] = 'not-an-object';

        $response = $this->postJson(route('collection.store'), $data);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['extra']);
    }

    public function test_can_update_collection_extra_and_clear_it(): void
    {
        $collection = Collection::factory()->create();

        $response = $this->putJson(route('collection.update', $collection), [
            'extra' => ['thg_gallery' => ['host' => 'https://carpets.museumwnf.org']],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.extra.thg_gallery.host', 'https://carpets.museumwnf.org');

        $response = $this->putJson(route('collection.update', $collection), [
            'extra' => null,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.extra', null);

        $this->assertDatabaseHas('collections', [
            'id' => $collection->id,
            'extra' => null,
        ]);
    }

    public function test_extra_is_exposed_by_the_collection_resource(): void
    {
        $collection = Collection::factory()
            ->withExtra(['thg_gallery' => ['i18n_group_id' => 18]])
            ->create();

        $response = $this->getJson(route('collection.show', $collection));

        $response->assertOk()
            ->assertJsonPath('data.extra.thg_gallery.i18n_group_id', 18);
    }

    public function test_by_type_returns_only_collections_of_the_requested_type(): void
    {
        Collection::factory()->subtheme()->count(2)->create();
        Collection::factory()->exhibition()->create();

        $response = $this->getJson(route('collection.byType', ['type' => 'subtheme']));

        $response->assertOk()
            ->assertJsonCount(2, 'data');
        foreach ($response->json('data') as $row) {
            $this->assertEquals('subtheme', $row['type']);
        }
    }

    public function test_by_type_accepts_every_type_in_the_vocabulary(): void
    {
        foreach (Collection::TYPES as $type) {
            $this->getJson(route('collection.byType', ['type' => $type]))->assertOk();
        }
    }

    public function test_by_type_rejects_an_unknown_type(): void
    {
        $response = $this->getJson(route('collection.byType', ['type' => 'not-a-type']));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    public function test_updating_a_root_purpose_collection_does_not_collide_with_itself(): void
    {
        $collection = Collection::factory()
            ->withPurpose(Collection::PURPOSE_EXHIBITIONS_ROOT)
            ->create();

        $response = $this->putJson(route('collection.update', $collection), [
            'purpose' => Collection::PURPOSE_EXHIBITIONS_ROOT,
            'display_order' => 5,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.purpose', Collection::PURPOSE_EXHIBITIONS_ROOT);
    }

    /**
     * M16 E3: the cover picture and the days are columns, and the other
     * countries and the links to other collections are included on request.
     */
    public function test_stores_the_cover_picture_and_days_and_includes_the_relations(): void
    {
        $collection = Collection::factory()->create();
        $picture = Item::factory()->create();
        $country = Country::factory()->create();
        $location = Collection::factory()->create();
        $collection->countries()->attach($country->id, ['display_order' => 1]);
        $collection->relatedCollections()->attach($location->id, ['kind' => 'location', 'display_order' => 1]);

        $this->putJson(route('collection.update', $collection), ['cover_item_id' => $picture->id, 'days' => 2])
            ->assertOk()
            ->assertJsonPath('data.cover_item_id', $picture->id)
            ->assertJsonPath('data.days', 2);

        $this->getJson(route('collection.show', $collection).'?include=countries,relatedCollections,coverItem')
            ->assertOk()
            ->assertJsonPath('data.countries.0.id', $country->id)
            ->assertJsonPath('data.relatedCollections.0.id', $location->id)
            ->assertJsonPath('data.relatedCollections.0.link.kind', 'location')
            ->assertJsonPath('data.coverItem.id', $picture->id);
    }

    public function test_rejects_days_that_are_no_positive_number(): void
    {
        $collection = Collection::factory()->create();

        $this->putJson(route('collection.update', $collection), ['days' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['days']);
    }
}
