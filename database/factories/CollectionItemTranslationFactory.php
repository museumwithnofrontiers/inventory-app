<?php

namespace Database\Factories;

use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\CollectionItemTranslation;
use App\Models\Item;
use App\Models\Language;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CollectionItemTranslation>
 */
class CollectionItemTranslationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'collection_item_id' => fn (): string => self::newPlacement()->id,
            'language_id' => Language::factory(),
            'title' => null,
            'description' => $this->faker->optional()->paragraph(),
            'curator_justification' => null,
            'partner_justification' => null,
            'justification' => null,
            'caption' => null,
            'item_name' => $this->faker->optional()->sentence(3),
            'item_date' => null,
            'item_location' => null,
            'item_museum' => null,
            'item_dynasty' => null,
            'item_artist' => null,
            'item_material' => null,
            'backward_compatibility' => null,
        ];
    }

    /**
     * The texts of this placement.
     */
    public function forPlacement(CollectionItem $placement): static
    {
        return $this->state(fn (array $attributes): array => [
            'collection_item_id' => $placement->id,
        ]);
    }

    /**
     * A new placement: a new item on a new collection.
     */
    public static function newPlacement(): CollectionItem
    {
        $collection = Collection::factory()->create();
        $item = Item::factory()->Object()->create();
        $collection->attachedItems()->attach($item->id);

        return CollectionItem::query()
            ->where('collection_id', $collection->id)
            ->where('item_id', $item->id)
            ->firstOrFail();
    }
}
