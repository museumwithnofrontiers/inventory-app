<?php

namespace Database\Factories;

use App\Enums\PublicationCategory;
use App\Enums\PublicationStatus;
use App\Models\Country;
use App\Models\Language;
use App\Models\Project;
use App\Models\Publication;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Publication>
 */
class PublicationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'internal_name' => $this->faker->unique()->words(3, true),
            'backward_compatibility' => 'mwnf3:bookbase:'.$this->faker->unique()->numberBetween(1, 999999),
            'category' => $this->faker->randomElement(PublicationCategory::cases())->value,
            'project_id' => null,
            'country_id' => null,
            'language_id' => Language::factory(),
            'status' => PublicationStatus::PUBLISHED->value,
            'display_order' => null,
            'extra' => null,
        ];
    }

    public function forProject(Project $project): static
    {
        return $this->state(fn (array $attributes): array => [
            'project_id' => $project->id,
        ]);
    }

    public function forCountry(Country $country): static
    {
        return $this->state(fn (array $attributes): array => [
            'country_id' => $country->id,
        ]);
    }

    public function inPreparation(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => PublicationStatus::IN_PREPARATION->value,
        ]);
    }
}
