<?php

namespace Database\Factories;

use App\Models\Artist;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Artist>
 */
class ArtistFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->name(),
            'place_of_birth' => $this->faker->optional(0.8)->city(),
            'place_of_death' => $this->faker->optional(0.6)->city(),
            'date_of_birth' => $this->faker->optional(0.8)->year(1400, 1900),
            'date_of_death' => $this->faker->optional(0.6)->year(1450, 1950),
            'period_of_activity' => $this->faker->optional(0.7)->randomElement([
                'Early 16th century',
                '1580-1620',
                'Late 17th century',
                'c. 1750-1800',
                'First half of the 18th century',
            ]),
            'internal_name' => $this->faker->lastName().'_'.$this->faker->firstName().'_'.$this->faker->unique()->numberBetween(1, 9999999),
            'backward_compatibility' => $this->faker->optional(0.3)->uuid(),
        ];
    }
}
