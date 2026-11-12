<?php

namespace Database\Factories;

use App\Enums\PublicationDocumentKind;
use App\Models\Publication;
use App\Models\PublicationDocument;
use App\Models\PublicationEdition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PublicationDocument>
 */
class PublicationDocumentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'publication_id' => Publication::factory(),
            'publication_edition_id' => null,
            'language_id' => null,
            'kind' => $this->faker->randomElement(PublicationDocumentKind::cases())->value,
            // The stored filename on the private documents disk: a UUID and .pdf
            'path' => $this->faker->uuid().'.pdf',
            'original_name' => $this->faker->word().'.pdf',
            'mime_type' => 'application/pdf',
            'size' => $this->faker->numberBetween(10000, 5000000),
            'display_order' => $this->faker->numberBetween(1, 10),
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

    public function forEdition(PublicationEdition $edition): static
    {
        return $this->state(fn (array $attributes): array => [
            'publication_id' => $edition->publication_id,
            'publication_edition_id' => $edition->id,
            'language_id' => $edition->language_id,
        ]);
    }

    public function withOrder(int $order): static
    {
        return $this->state(fn (array $attributes): array => [
            'display_order' => $order,
        ]);
    }

    public function sample(): static
    {
        return $this->state(fn (array $attributes): array => [
            'kind' => PublicationDocumentKind::SAMPLE->value,
        ]);
    }

    public function credits(): static
    {
        return $this->state(fn (array $attributes): array => [
            'kind' => PublicationDocumentKind::CREDITS->value,
        ]);
    }
}
