<?php

namespace Database\Factories;

use App\Models\ImageTranslation;
use App\Models\ItemImage;
use App\Models\Language;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<ImageTranslation>
 */
class ImageTranslationFactory extends Factory
{
    protected $model = ImageTranslation::class;

    /**
     * Define the model's default state: a caption of a new item image.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->uuid(),
            'image_type' => 'item_image',
            'image_id' => ItemImage::factory(),
            'language_id' => Language::factory(),
            'caption' => $this->faker->sentence(),
            'name' => null,
            'date' => null,
            'museum' => null,
            'location' => null,
            'copyright' => null,
            'photographer' => null,
            'backward_compatibility' => null,
        ];
    }

    /**
     * Texts of this image.
     */
    public function of(Model $image): static
    {
        return $this->state(fn (): array => [
            'image_type' => $image->getMorphClass(),
            'image_id' => $image->getKey(),
        ]);
    }
}
