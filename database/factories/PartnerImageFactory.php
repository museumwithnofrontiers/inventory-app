<?php

namespace Database\Factories;

use App\Models\Partner;
use App\Models\PartnerImage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PartnerImage>
 */
class PartnerImageFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Generate a local path for testing
        $filename = fake()->uuid().'.jpg';
        $path = 'images/partners/'.$filename;

        return [
            'partner_id' => Partner::factory(),
            'path' => $path,
            'original_name' => fake()->word().'_'.fake()->randomNumber(4).'.jpg',
            'mime_type' => fake()->randomElement(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
            'size' => fake()->numberBetween(10000, 500000), // 10KB to 500KB (logos are typically smaller)
            'alt_text' => fake()->sentence(4),
            'copyright' => null,
            'display_order' => fake()->numberBetween(1, 5),
        ];
    }

    /**
     * Indicate that the image should be for a specific partner.
     */
    public function forPartner(Partner $partner): static
    {
        return $this->state(fn (array $attributes) => [
            'partner_id' => $partner->id,
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
     * Create a logo image.
     */
    public function logo(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => 'logos/'.fake()->uuid().'.svg',
            'original_name' => 'partner_logo_'.fake()->uuid().'.svg',
            'mime_type' => 'image/svg+xml',
            'size' => fake()->numberBetween(5000, 50000), // 5KB to 50KB
            'alt_text' => 'Partner logo',
        ]);
    }

    /**
     * Create a banner image.
     */
    public function banner(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => 'banners/'.fake()->uuid().'.jpg',
            'original_name' => 'partner_banner_'.fake()->uuid().'.jpg',
            'mime_type' => 'image/jpeg',
            'size' => fake()->numberBetween(100000, 1000000), // 100KB to 1MB
            'alt_text' => 'Partner banner image',
        ]);
    }
}
