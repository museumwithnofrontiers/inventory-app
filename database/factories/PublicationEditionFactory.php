<?php

namespace Database\Factories;

use App\Enums\PublicationFormat;
use App\Models\Language;
use App\Models\Publication;
use App\Models\PublicationEdition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PublicationEdition>
 */
class PublicationEditionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'publication_id' => Publication::factory(),
            'language_id' => Language::factory(),
            'format' => $this->faker->randomElement(PublicationFormat::cases())->value,
            'edition' => $this->faker->numberBetween(1, 3),
            'publish_year' => $this->faker->numberBetween(1995, 2025),
            'isbn' => $this->faker->optional()->isbn13(),
            'publisher' => $this->faker->optional()->company(),
            'page_count' => $this->faker->optional()->numberBetween(40, 400),
            'image_count' => $this->faker->optional()->numberBetween(10, 300),
            'plan_count' => $this->faker->optional()->numberBetween(0, 20),
            'dimensions' => $this->faker->optional()->randomElement(['24 × 17 cm', '21 × 15 cm']),
            'binding' => $this->faker->optional()->randomElement(['Paperback', 'Hardcover']),
            'visible' => true,
            'display_order' => null,
            'backward_compatibility' => 'mwnf3:books:'.$this->faker->unique()->numberBetween(1, 999999).':en:1:book:1',
            'extra' => null,
        ];
    }

    public function forPublication(Publication $publication): static
    {
        return $this->state(fn (array $attributes): array => [
            'publication_id' => $publication->id,
        ]);
    }

    public function hidden(): static
    {
        return $this->state(fn (array $attributes): array => [
            'visible' => false,
        ]);
    }
}
