<?php

namespace Database\Factories;

use App\Models\Contributor;
use App\Models\ContributorImage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ContributorImage>
 */
class ContributorImageFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->uuid(),
            'contributor_id' => Contributor::factory(),
            'path' => $this->faker->filePath(),
            'original_name' => $this->faker->word().'.'.$this->faker->fileExtension(),
            'mime_type' => $this->faker->mimeType(),
            'size' => $this->faker->numberBetween(1000, 5000000),
            'alt_text' => $this->faker->optional()->sentence(),
            'copyright' => null,
            'display_order' => $this->faker->numberBetween(0, 10),
        ];
    }
}
