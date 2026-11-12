<?php

namespace Database\Factories;

use App\Enums\PublicationImageKind;
use App\Models\Publication;
use App\Models\PublicationImage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PublicationImage>
 */
class PublicationImageFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'publication_id' => Publication::factory(),
            'publication_edition_id' => null,
            'kind' => $this->faker->randomElement(PublicationImageKind::cases())->value,
            // The stored filename on the private originals disk
            'path' => $this->faker->uuid().'.jpg',
            'original_name' => $this->faker->word().'_'.$this->faker->randomNumber(4).'.jpg',
            'mime_type' => $this->faker->randomElement(['image/jpeg', 'image/png', 'image/webp']),
            'size' => $this->faker->numberBetween(50000, 2000000),
            'alt_text' => $this->faker->sentence(6),
            'copyright' => null,
            'display_order' => $this->faker->numberBetween(1, 10),
            'extra' => null,
        ];
    }

    public function forPublication(Publication $publication): static
    {
        return $this->state(fn (array $attributes): array => [
            'publication_id' => $publication->id,
        ]);
    }

    public function withOrder(int $order): static
    {
        return $this->state(fn (array $attributes): array => [
            'display_order' => $order,
        ]);
    }

    public function cover(): static
    {
        return $this->state(fn (array $attributes): array => [
            'kind' => PublicationImageKind::COVER->value,
        ]);
    }

    public function page(): static
    {
        return $this->state(fn (array $attributes): array => [
            'kind' => PublicationImageKind::PAGE->value,
        ]);
    }
}
