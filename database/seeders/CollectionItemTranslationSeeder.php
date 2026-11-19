<?php

namespace Database\Seeders;

use App\Models\CollectionItem;
use App\Models\CollectionItemTranslation;
use App\Models\Language;
use Illuminate\Database\Seeder;

/**
 * Texts for a few placements, in an existing language.
 */
class CollectionItemTranslationSeeder extends Seeder
{
    public function run(): void
    {
        $language = Language::query()->first();
        if ($language === null) {
            return;
        }
        foreach (CollectionItem::query()->inRandomOrder()->limit(5)->get() as $placement) {
            CollectionItemTranslation::factory()
                ->forPlacement($placement)
                ->create(['language_id' => $language->id]);
        }
    }
}
