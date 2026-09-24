<?php

namespace Database\Factories;

use App\Models\AvailableImage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Storage;

/**
 * @extends Factory<AvailableImage>
 */
class AvailableImageFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $disk = config('localstorage.available.images.disk');
        $directory = rtrim(config('localstorage.available.images.directory'), '/');

        $path = $this->faker->image(width: 640, height: 480, disk: $disk, directory: $directory, options: ['grayscale' => true]);
        $filename = basename($path);
        $relativePath = $directory.'/'.$filename;

        return [
            'path' => $filename,
            'original_name' => $filename,
            'mime_type' => 'image/jpeg',
            'size' => Storage::disk($disk)->size($relativePath),
            'comment' => $this->faker->sentence(10),
            'copyright' => null,
        ];
    }
}
