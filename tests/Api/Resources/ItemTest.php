<?php

namespace Tests\Api\Resources;

use App\Models\Item;
use App\Models\ItemTranslation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Api\Traits\AuthenticatesApiRequests;
use Tests\Api\Traits\TestsApiCrud;
use Tests\Api\Traits\TestsApiTagManagement;
use Tests\TestCase;

class ItemTest extends TestCase
{
    use AuthenticatesApiRequests;
    use RefreshDatabase;
    use TestsApiCrud;
    use TestsApiTagManagement;

    protected function getResourceName(): string
    {
        return 'item';
    }

    protected function getModelClass(): string
    {
        return Item::class;
    }

    public function test_show_with_include_translations_returns_200_without_infinite_recursion(): void
    {
        $item = Item::factory()->create();
        ItemTranslation::factory()->create(['item_id' => $item->id]);

        $response = $this->getJson(route('item.show', $item).'?include=translations');

        $response->assertOk()
            ->assertJsonPath('data.id', $item->id)
            ->assertJsonStructure(['data' => ['translations']]);
    }

    /**
     * Legacy dates an object from the Paleolithic: -300000 to -8000.
     */
    public function test_keeps_a_paleolithic_start_year(): void
    {
        $item = Item::factory()->create();

        $this->putJson(route('item.update', $item), ['start_date' => -300000, 'end_date' => -8000])
            ->assertOk();

        $item->refresh();
        $this->assertSame(-300000, $item->start_date);
        $this->assertSame(-8000, $item->end_date);
    }

    /**
     * M17 B1 (#2744): an item is not a draft unless it says so; the API
     * stores, serves and lists a draft item like any other.
     */
    public function test_draft_is_stored_served_and_listed(): void
    {
        $item = Item::factory()->create();
        $this->assertFalse($item->fresh()?->draft);

        $this->putJson(route('item.update', $item), ['draft' => true])
            ->assertOk()
            ->assertJsonPath('data.draft', true);
        $this->assertTrue($item->fresh()?->draft);

        $this->getJson(route('item.show', $item))
            ->assertOk()
            ->assertJsonPath('data.draft', true);
        $this->getJson(route('item.index'))
            ->assertOk()
            ->assertJsonFragment(['id' => $item->id, 'draft' => true]);

        $this->putJson(route('item.update', $item), ['draft' => 'maybe'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('draft');
    }
}
