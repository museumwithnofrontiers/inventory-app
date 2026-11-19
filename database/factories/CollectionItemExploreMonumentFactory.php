<?php

namespace Database\Factories;

use App\Models\CollectionItem;
use App\Models\CollectionItemExploreMonument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CollectionItemExploreMonument>
 */
class CollectionItemExploreMonumentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'collection_item_id' => fn (): string => CollectionItemTranslationFactory::newPlacement()->id,
            'position' => 1,
            'backward_compatibility' => 'mwnf3_explore:monument:'.$this->faker->unique()->numberBetween(1, 99999),
            'latitude' => $this->faker->latitude(),
            'longitude' => $this->faker->longitude(),
            'map_zoom' => $this->faker->numberBetween(10, 18),
            'location_collection_id' => null,
            'description_types' => null,
            'travels_description_ref' => null,
            'explore_description_ref' => null,
            'virtual_museum_description_ref' => null,
        ];
    }

    /**
     * An Explore monument of this placement.
     */
    public function forPlacement(CollectionItem $placement): static
    {
        return $this->state(fn (array $attributes): array => [
            'collection_item_id' => $placement->id,
        ]);
    }
}
