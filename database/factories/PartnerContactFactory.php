<?php

namespace Database\Factories;

use App\Models\Partner;
use App\Models\PartnerContact;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PartnerContact>
 */
class PartnerContactFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'partner_id' => Partner::factory(),
            'display_order' => $this->faker->unique()->numberBetween(1, 1_000_000),
            'name' => $this->faker->name(),
            'title' => $this->faker->optional()->jobTitle(),
            'email' => $this->faker->optional()->safeEmail(),
            'phone' => $this->faker->optional()->phoneNumber(),
            'fax' => null,
            'backward_compatibility' => null,
        ];
    }

    public function forPartner(Partner $partner, int $displayOrder = 1): static
    {
        return $this->state(fn (array $attributes): array => [
            'partner_id' => $partner->id,
            'display_order' => $displayOrder,
        ]);
    }
}
