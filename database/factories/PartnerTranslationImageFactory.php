<?php

namespace Database\Factories;

use App\Models\PartnerTranslation;
use App\Models\PartnerTranslationImage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PartnerTranslationImage>
 */
class PartnerTranslationImageFactory extends Factory
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
        $path = 'images/partner_translations/'.$filename;

        return [
            'partner_translation_id' => PartnerTranslation::factory(),
            'path' => $path,
            'original_name' => fake()->word().'_'.fake()->randomNumber(4).'.jpg',
            'mime_type' => fake()->randomElement(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
            'size' => fake()->numberBetween(10000, 500000), // 10KB to 500KB
            'alt_text' => fake()->sentence(4),
            'copyright' => null,
            'display_order' => fake()->numberBetween(1, 5),
        ];
    }

    /**
     * Indicate that the image should be for a specific partner translation.
     */
    public function forPartnerTranslation(PartnerTranslation $partnerTranslation): static
    {
        return $this->state(fn (array $attributes) => [
            'partner_translation_id' => $partnerTranslation->id,
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
     * Create a context-specific logo image.
     */
    public function logo(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => 'logos/context/'.fake()->uuid().'.svg',
            'original_name' => 'context_logo_'.fake()->uuid().'.svg',
            'mime_type' => 'image/svg+xml',
            'size' => fake()->numberBetween(5000, 50000), // 5KB to 50KB
            'alt_text' => 'Context-specific partner logo',
        ]);
    }

    /**
     * Create a context-specific banner image.
     */
    public function banner(): static
    {
        return $this->state(fn (array $attributes) => [
            'path' => 'banners/context/'.fake()->uuid().'.jpg',
            'original_name' => 'context_banner_'.fake()->uuid().'.jpg',
            'mime_type' => 'image/jpeg',
            'size' => fake()->numberBetween(100000, 1000000), // 100KB to 1MB
            'alt_text' => 'Context-specific partner banner',
        ]);
    }
}
