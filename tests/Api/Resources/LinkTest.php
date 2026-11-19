<?php

namespace Tests\Api\Resources;

use App\Enums\LinkType;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Link;
use App\Models\Partner;
use App\Models\PublicationEdition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\TestCase;

/**
 * M16 F3 (#2653): the links of items, collections, partners and publication
 * editions, through one controller; the owner always comes from the route.
 */
class LinkTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;

    public function test_each_owner_lists_only_its_own_links(): void
    {
        $item = Item::factory()->create();
        $collection = Collection::factory()->create();
        $partner = Partner::factory()->create();
        $edition = PublicationEdition::factory()->create();
        $itemLink = Link::factory()->ownedBy($item)->create();
        $collectionLink = Link::factory()->forCollection($collection)->create();
        $partnerLink = Link::factory()->forPartner($partner)->create();
        $shopLink = Link::factory()->forEdition($edition)->create();

        $this->getJson(route('item.links.index', $item))->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $itemLink->id)
            ->assertJsonPath('data.0.linkable_type', 'item');
        $this->getJson(route('collection.links.index', $collection))->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $collectionLink->id);
        $this->getJson(route('partner.links.index', $partner))->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $partnerLink->id)
            ->assertJsonPath('data.0.type', 'website');
        $this->getJson(route('publication-edition.links.index', $edition))->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $shopLink->id)
            ->assertJsonPath('data.0.type', 'shop');
    }

    public function test_store_takes_the_owner_from_the_route(): void
    {
        $partner = Partner::factory()->create();

        $response = $this->postJson(route('partner.links.store', $partner), [
            'type' => LinkType::WEBSITE->value,
            'url' => 'https://museum.example.org/',
            'title' => 'The museum',
            'language_id' => null,
        ])->assertCreated();

        $response->assertJsonPath('data.linkable_type', 'partner')
            ->assertJsonPath('data.linkable_id', $partner->id)
            ->assertJsonPath('data.display_order', 1);

        $this->postJson(route('partner.links.store', $partner), [
            'type' => LinkType::WEBSITE->value,
            'url' => 'https://museum.example.org/',
            'linkable_type' => 'item',
            'linkable_id' => Item::factory()->create()->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['linkable_type', 'linkable_id']);
    }

    public function test_store_validates_type_and_url(): void
    {
        $item = Item::factory()->create();

        $this->postJson(route('item.links.store', $item), ['type' => 'podcast', 'url' => 'not a url'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type', 'url']);
    }

    public function test_show_update_move_and_destroy(): void
    {
        $item = Item::factory()->create();
        $first = Link::factory()->ownedBy($item)->create(['display_order' => 1]);
        $second = Link::factory()->ownedBy($item)->create(['display_order' => 2]);

        $this->getJson(route('link.show', $first))->assertOk()->assertJsonPath('data.id', $first->id);

        $this->patchJson(route('link.update', $first), [
            'title' => 'Conservation video',
            'authors' => 'Ana Author',
            'type' => LinkType::VIDEO->value,
        ])->assertOk()
            ->assertJsonPath('data.title', 'Conservation video')
            ->assertJsonPath('data.authors', 'Ana Author');

        $this->patchJson(route('link.update', $first), ['linkable_id' => $item->id])
            ->assertUnprocessable();

        $this->patchJson(route('link.moveUp', $second))->assertOk()->assertJsonPath('data.display_order', 1);
        $this->assertSame(2, $first->fresh()?->display_order);

        $this->deleteJson(route('link.destroy', $first))->assertNoContent();
        $this->assertDatabaseMissing('links', ['id' => $first->id]);
    }

    public function test_the_related_content_fields_are_columns(): void
    {
        $link = Link::factory()->forCollection()->create();

        $this->patchJson(route('link.update', $link), [
            'category' => 2,
            'resource_type' => 'Online Exhibition',
            'location' => 'London',
            'country_code' => 'uk',
            'further_reading' => 'Cahill, James, *Parting at the Shore*.',
        ])->assertOk()
            ->assertJsonPath('data.category', 2)
            ->assertJsonPath('data.resource_type', 'Online Exhibition')
            ->assertJsonPath('data.location', 'London')
            ->assertJsonPath('data.country_code', 'uk')
            ->assertJsonPath('data.further_reading', 'Cahill, James, *Parting at the Shore*.');

        $this->patchJson(route('link.update', $link), ['category' => 'four'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category']);
    }

    public function test_an_owner_includes_its_links(): void
    {
        $item = Item::factory()->create();
        Link::factory()->ownedBy($item)->create(['title' => 'A video']);

        $this->getJson(route('item.show', [$item, 'include' => 'links']))
            ->assertOk()
            ->assertJsonPath('data.links.0.title', 'A video');
    }
}
