<?php

namespace Tests\Unit\Models;

use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\CollectionItemTranslation;
use App\Models\Item;
use App\Models\Language;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for the CollectionItem typed pivot model: the placement.
 */
class CollectionItemTest extends TestCase
{
    use RefreshDatabase;

    public function test_collection_item_casts_display_order_to_integer(): void
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id, ['display_order' => 3]);

        /** @var CollectionItem $pivot */
        $pivot = $collection->attachedItems()->withPivot('display_order')->first()->pivot;

        $this->assertInstanceOf(CollectionItem::class, $pivot);
        $this->assertSame(3, $pivot->display_order);
        $this->assertIsInt($pivot->display_order);
    }

    public function test_collection_item_casts_extra_to_array(): void
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id, ['extra' => ['membership' => 'project']]);

        /** @var CollectionItem $pivot */
        $pivot = $collection->attachedItems()->first()->pivot;

        $this->assertInstanceOf(CollectionItem::class, $pivot);
        $this->assertIsArray($pivot->extra);
        $this->assertArrayHasKey('membership', $pivot->extra);
    }

    public function test_the_placement_has_its_texts_per_language(): void
    {
        $pivot = $this->placementWithTexts([
            'eng' => ['description' => 'English contextual text.', 'backward_compatibility' => 'THG-source-001'],
            'fra' => ['description' => 'Texte contextuel en français.', 'backward_compatibility' => 'THG-source-002'],
        ]);

        $this->assertSame([
            'eng' => 'English contextual text.',
            'fra' => 'Texte contextuel en français.',
        ], $pivot->contextualDescriptions());
        $this->assertSame('English contextual text.', $pivot->contextualDescriptionForLanguage('eng'));
        $this->assertNull($pivot->contextualDescriptionForLanguage('deu'));
        $this->assertSame(['eng', 'fra'], $pivot->contextualDescriptionLanguages());
        $this->assertSame(['eng' => 'THG-source-001', 'fra' => 'THG-source-002'], $pivot->sourceBackwardCompatibilityByLanguage());
        $this->assertSame('THG-source-002', $pivot->sourceBackwardCompatibilityForLanguage('fra'));
    }

    public function test_a_language_without_a_description_is_left_out(): void
    {
        $pivot = $this->placementWithTexts([
            'eng' => ['item_name' => 'The Hercules fountain'],
            'fra' => ['description' => 'Texte.'],
        ]);

        $this->assertSame(['fra' => 'Texte.'], $pivot->contextualDescriptions());
        $this->assertSame([], $pivot->sourceBackwardCompatibilityByLanguage());
        $this->assertNull($pivot->sourceBackwardCompatibilityForLanguage('eng'));
    }

    public function test_a_placement_without_texts_has_none(): void
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        /** @var CollectionItem $pivot */
        $pivot = $collection->attachedItems()->first()->pivot;

        $this->assertSame([], $pivot->contextualDescriptions());
        $this->assertSame([], $pivot->contextualDescriptionLanguages());
        $this->assertSame([], $pivot->sourceBackwardCompatibilityByLanguage());
    }

    public function test_collection_relationship_resolves_to_collection_model(): void
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        /** @var CollectionItem $pivot */
        $pivot = $collection->attachedItems()->first()->pivot;

        $this->assertInstanceOf(Collection::class, $pivot->collection);
        $this->assertTrue($pivot->collection->is($collection));
    }

    public function test_item_relationship_resolves_to_item_model(): void
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        /** @var CollectionItem $pivot */
        $pivot = $collection->attachedItems()->first()->pivot;

        $this->assertInstanceOf(Item::class, $pivot->item);
        $this->assertTrue($pivot->item->is($item));
    }

    public function test_attached_items_relationship_uses_collection_item_pivot(): void
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        $attachedItem = $collection->attachedItems()->first();

        $this->assertInstanceOf(CollectionItem::class, $attachedItem->pivot);
    }

    public function test_attached_to_collections_relationship_uses_collection_item_pivot(): void
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        $attachedCollection = $item->attachedToCollections()->first();

        $this->assertInstanceOf(CollectionItem::class, $attachedCollection->pivot);
    }

    /**
     * A placement with these texts, read back through the relation as the
     * panel reads it.
     *
     * @param  array<string, array<string, string>>  $texts  language id → columns
     */
    private function placementWithTexts(array $texts): CollectionItem
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);
        $placement = CollectionItem::query()->where('collection_id', $collection->id)->firstOrFail();
        foreach ($texts as $languageId => $columns) {
            Language::factory()->create(['id' => $languageId]);
            CollectionItemTranslation::factory()->forPlacement($placement)->create([
                'language_id' => $languageId,
                'description' => null,
                'item_name' => null,
                ...$columns,
            ]);
        }

        /** @var CollectionItem $pivot */
        $pivot = $collection->attachedItems()->first()->pivot;

        return $pivot;
    }
}
