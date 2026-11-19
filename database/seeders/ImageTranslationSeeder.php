<?php

namespace Database\Seeders;

use App\Models\CollectionImage;
use App\Models\ImageTranslation;
use App\Models\ItemImage;
use App\Models\Language;
use Illuminate\Database\Seeder;

/**
 * A caption for a few item and collection images, in an existing language.
 */
class ImageTranslationSeeder extends Seeder
{
    public function run(): void
    {
        $language = Language::query()->first();
        if ($language === null) {
            return;
        }
        $images = [
            ...ItemImage::inRandomOrder()->limit(5)->get(),
            ...CollectionImage::inRandomOrder()->limit(3)->get(),
        ];
        foreach ($images as $image) {
            ImageTranslation::factory()->of($image)->create(['language_id' => $language->id]);
        }
    }
}
