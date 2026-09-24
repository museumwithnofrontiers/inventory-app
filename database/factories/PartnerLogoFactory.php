<?php

namespace Database\Factories;

use App\Models\Partner;
use App\Models\PartnerLogo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PartnerLogo>
 */
class PartnerLogoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Generate a local path for testing
        $filename = fake()->uuid().'.svg';
        $path = 'logos/partners/'.$filename;

        return [
            'partner_id' => Partner::factory(),
            'path' => $path,
            'original_name' => fake()->word().'_logo_'.fake()->randomNumber(4).'.svg',
            'mime_type' => fake()->randomElement(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']),
            'size' => fake()->numberBetween(5000, 100000), // 5KB to 100KB (logos are typically smaller)
            'logo_type' => 'primary',
            'alt_text' => fake()->optional()->sentence(3),
            'copyright' => null,
            'display_order' => fake()->numberBetween(1, 5),
        ];
    }

    /**
     * Indicate that the logo should be for a specific partner.
     */
    public function forPartner(Partner $partner): static
    {
        return $this->state(fn (array $attributes) => [
            'partner_id' => $partner->id,
        ]);
    }

    /**
     * Indicate that the logo should have a specific display order.
     */
    public function withOrder(int $order): static
    {
        return $this->state(fn (array $attributes) => [
            'display_order' => $order,
        ]);
    }

    /**
     * Create a primary logo.
     */
    public function primary(): static
    {
        return $this->state(fn (array $attributes) => [
            'logo_type' => 'primary',
        ]);
    }

    /**
     * Create a secondary logo.
     */
    public function secondary(): static
    {
        return $this->state(fn (array $attributes) => [
            'logo_type' => 'secondary',
        ]);
    }

    /**
     * Create a sponsor logo.
     */
    public function sponsor(): static
    {
        return $this->state(fn (array $attributes) => [
            'logo_type' => 'sponsor',
        ]);
    }

    /**
     * Create an SVG logo.
     */
    public function svg(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => 'logos/'.fake()->uuid().'.svg',
            'original_name' => 'logo_'.fake()->uuid().'.svg',
            'mime_type' => 'image/svg+xml',
            'size' => fake()->numberBetween(2000, 20000), // 2KB to 20KB
        ]);
    }

    /**
     * Create a PNG logo.
     */
    public function png(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => 'logos/'.fake()->uuid().'.png',
            'original_name' => 'logo_'.fake()->uuid().'.png',
            'mime_type' => 'image/png',
            'size' => fake()->numberBetween(10000, 100000), // 10KB to 100KB
        ]);
    }
}
