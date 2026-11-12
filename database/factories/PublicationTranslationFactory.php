<?php

namespace Database\Factories;

use App\Models\Context;
use App\Models\Language;
use App\Models\Publication;
use App\Models\PublicationTranslation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PublicationTranslation>
 */
class PublicationTranslationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'publication_id' => Publication::factory(),
            'language_id' => Language::factory(),
            'context_id' => Context::factory(),
            'title' => $this->faker->sentence(4),
            'subtitle' => $this->faker->optional()->sentence(6),
            'description' => $this->faker->optional()->paragraph(),
            'introduction' => $this->faker->optional()->paragraph(),
            'author_credit' => $this->faker->optional()->name(),
            'photography_credit' => $this->faker->optional()->name(),
            'coordination_credit' => $this->faker->optional()->name(),
            'backward_compatibility' => null,
            'extra' => null,
        ];
    }

    public function forPublication(Publication $publication): static
    {
        return $this->state(fn (array $attributes): array => [
            'publication_id' => $publication->id,
        ]);
    }
}
