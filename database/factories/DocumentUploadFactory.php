<?php

namespace Database\Factories;

use App\Models\DocumentUpload;
use App\Models\Item;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DocumentUpload>
 */
class DocumentUploadFactory extends Factory
{
    protected $model = DocumentUpload::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->uuid(),
            'item_id' => Item::factory(),
            'language_id' => null,
            'path' => $this->faker->uuid().'.pdf',
            'original_name' => $this->faker->slug(2).'.pdf',
            'mime_type' => 'application/pdf',
            'size' => $this->faker->numberBetween(1024, 5_000_000),
            'title' => $this->faker->optional(0.5)->sentence(3),
            'display_order' => null,
            'uploaded_by' => User::factory(),
        ];
    }

    /**
     * Indicate that the pending upload is for a specific item.
     */
    public function forItem(Item $item): static
    {
        return $this->state(fn (array $attributes) => [
            'item_id' => $item->id,
        ]);
    }
}
