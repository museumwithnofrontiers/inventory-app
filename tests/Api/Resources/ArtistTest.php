<?php

namespace Tests\Api\Resources;

use App\Models\Artist;
use App\Models\Item;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\TestCase;

class ArtistTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;

    protected function getResourceName(): string
    {
        return 'artist';
    }

    protected function getModelClass(): string
    {
        return Artist::class;
    }

    public function test_show_includes_the_linked_items(): void
    {
        $artist = Artist::factory()->create();
        $item = Item::factory()->create();
        $artist->items()->attach($item->id);

        $this->getJson(route('artist.show', ['artist' => $artist->id, 'include' => 'items']))
            ->assertOk()
            ->assertJsonPath('data.items.0.id', $item->id);
    }

    public function test_store_requires_a_unique_internal_name(): void
    {
        Artist::factory()->create(['internal_name' => 'taken']);

        $this->postJson(route('artist.store'), ['name' => 'Someone', 'internal_name' => 'taken'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['internal_name']);
    }

    public function test_update_keeps_its_own_internal_name(): void
    {
        $artist = Artist::factory()->create(['internal_name' => 'mine']);

        $this->patchJson(route('artist.update', ['artist' => $artist->id]), ['name' => 'Renamed', 'internal_name' => 'mine'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed');
    }

    public function test_destroy_removes_the_links_and_keeps_the_items(): void
    {
        $artist = Artist::factory()->create();
        $item = Item::factory()->create();
        $artist->items()->attach($item->id);

        $this->deleteJson(route('artist.destroy', ['artist' => $artist->id]))
            ->assertNoContent();

        $this->assertDatabaseMissing('artist_item', ['artist_id' => $artist->id]);
        $this->assertModelExists($item);
    }
}
