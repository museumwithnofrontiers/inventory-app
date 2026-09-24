<?php

namespace Database\Factories;

use App\Models\Collection;
use App\Models\CollectionImage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CollectionImage>
 */
class CollectionImageFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Generate a local path for testing - this creates a path that would exist
        // in the storage/app/images directory. For tests, we'll create actual placeholder files.
        $filename = fake()->uuid().'.jpg';
        $path = 'images/collections/'.$filename;

        return [
            'collection_id' => Collection::factory(),
            'path' => $path,
            'original_name' => fake()->word().'_'.fake()->randomNumber(4).'.jpg',
            'mime_type' => fake()->randomElement(['image/jpeg', 'image/png', 'image/webp']),
            'size' => fake()->numberBetween(50000, 2000000), // 50KB to 2MB
            'alt_text' => fake()->sentence(6),
            'copyright' => null,
            'display_order' => fake()->numberBetween(1, 10),
        ];
    }

    /**
     * Indicate that the image should be for a specific collection.
     */
    public function forCollection(Collection $collection): static
    {
        return $this->state(fn (array $attributes) => [
            'collection_id' => $collection->id,
        ]);
    }

    /**
     * Indicate that the image should have a specific display order.
     */
    public function withOrder(int $order): static
    {
        return $this->state(fn (array $attributes) => [
            'display_order' => $order,
        ]);
    }

    /**
     * Create an image with realistic exhibition characteristics.
     */
    public function exhibition(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => fake()->imageUrl(1600, 900, 'exhibition', true),
            'original_name' => 'exhibition_'.fake()->uuid().'.jpg',
            'mime_type' => 'image/jpeg',
            'size' => fake()->numberBetween(300000, 5000000), // 300KB to 5MB
            'alt_text' => 'Exhibition: '.fake()->words(4, true),
        ]);
    }

    /**
     * Create an image with realistic gallery characteristics.
     */
    public function gallery(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => fake()->imageUrl(1200, 800, 'gallery', true),
            'original_name' => 'gallery_'.fake()->uuid().'.jpg',
            'mime_type' => 'image/jpeg',
            'size' => fake()->numberBetween(200000, 4000000), // 200KB to 4MB
            'alt_text' => 'Gallery: '.fake()->words(5, true),
        ]);
    }
}
