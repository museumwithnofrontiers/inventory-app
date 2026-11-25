<?php

namespace Database\Factories;

use App\Enums\ContributorCategory;
use App\Models\Collection;
use App\Models\Contributor;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contributor>
 */
class ContributorFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->uuid(),
            'collection_id' => Collection::factory(),
            'category' => $this->faker->randomElement(ContributorCategory::cases()),
            'display_order' => $this->faker->numberBetween(0, 10),
            'visible' => $this->faker->boolean(80),
            'backward_compatibility' => $this->faker->bothify('???_##'),
            'internal_name' => $this->faker->unique()->words(3, true),
        ];
    }

    public function category(ContributorCategory $category): self
    {
        return $this->state(fn (array $attributes) => [
            'category' => $category,
        ]);
    }
}
