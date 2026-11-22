<?php

namespace Database\Factories;

use App\Enums\ItemType;
use App\Models\Country;
use App\Models\Item;
use App\Models\Partner;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Item>
 */
class ItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->uuid(),
            'partner_id' => null, // This must be set to a valid partner ID
            'parent_id' => null, // This should be set for detail and picture types
            'internal_name' => $this->faker->unique()->words(3, true),
            'backward_compatibility' => $this->faker->lexify('???'),
            'type' => $this->faker->randomElement([ItemType::OBJECT, ItemType::MONUMENT]), // Default to top-level types
            'draft' => false,
            'display_order' => null,
            'project_id' => null, // This should be set to a valid project ID if needed
            'country_id' => null, // This should be set to a valid country ID if needed
            'owner_reference' => $this->faker->bothify('???##'),
            'mwnf_reference' => $this->faker->bothify('???##'),
            // Datation (nullable by default)
            'start_date' => null,
            'end_date' => null,
            // GPS Location (nullable by default)
            'latitude' => null,
            'longitude' => null,
            'map_zoom' => null,
        ];
    }

    public function withPartner(): self
    {
        return $this->state(function (array $attributes) {
            return [
                'partner_id' => Partner::factory(),
            ];
        });
    }

    public function withProject(): self
    {
        return $this->state(function (array $attributes) {
            return [
                'project_id' => Project::factory(),
            ];
        });
    }

    public function withCountry(): self
    {
        return $this->state(function (array $attributes) {
            return [
                'country_id' => Country::factory(),
            ];
        });
    }

    public function Object(): self
    {
        return $this->state(fn (array $attributes) => [
            'type' => ItemType::OBJECT,
        ]);
    }

    public function Monument(): self
    {
        return $this->state(fn (array $attributes) => [
            'type' => ItemType::MONUMENT,
        ]);
    }

    public function Detail(): self
    {
        return $this->state(fn (array $attributes) => [
            'type' => ItemType::DETAIL,
            'parent_id' => Item::factory()->Object(),
        ]);
    }

    public function Picture(): self
    {
        return $this->state(fn (array $attributes) => [
            'type' => ItemType::PICTURE,
            'parent_id' => Item::factory(),
        ]);
    }

    public function withParent(Item $parent): self
    {
        return $this->state(fn (array $attributes) => [
            'parent_id' => $parent->id,
        ]);
    }

    /**
     * Create an item without creating translations.
     */
    public function withoutTranslations(): self
    {
        return $this->state(function (array $attributes) {
            // This state doesn't change the item but signals to translation factories
            // not to create translations for this item
            return [];
        });
    }

    /**
     * Configure the factory with datation years.
     */
    public function withDates(?int $startDate = null, ?int $endDate = null): self
    {
        return $this->state(fn (array $attributes) => [
            'start_date' => $startDate ?? $this->faker->numberBetween(1500, 1900),
            'end_date' => $endDate ?? $this->faker->numberBetween(1900, (int) date('Y')),
        ]);
    }

    /**
     * Configure the factory with random datation dates.
     */
    public function withRandomDates(): self
    {
        return $this->withDates();
    }

    /**
     * Configure the factory with geocoordinates.
     */
    public function withGeocoordinates(?float $latitude = null, ?float $longitude = null, ?int $mapZoom = null): self
    {
        return $this->state(fn (array $attributes) => [
            'latitude' => $latitude ?? $this->faker->latitude(),
            'longitude' => $longitude ?? $this->faker->longitude(),
            'map_zoom' => $mapZoom ?? $this->faker->numberBetween(1, 20),
        ]);
    }

    /**
     * Configure the factory with random geocoordinates.
     */
    public function withRandomGeocoordinates(): self
    {
        return $this->withGeocoordinates();
    }
}
