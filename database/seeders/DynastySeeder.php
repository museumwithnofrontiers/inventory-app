<?php

namespace Database\Seeders;

use App\Models\Dynasty;
use App\Models\DynastyTranslation;
use App\Models\Item;
use App\Models\Language;
use Illuminate\Database\Seeder;

class DynastySeeder extends Seeder
{
    /**
     * Run the database seeds: a few dynasties with a translation in the
     * default language, each linked to up to three of the seeded items.
     */
    public function run(): void
    {
        $languageId = Language::default()->value('id') ?? Language::query()->value('id');
        $itemIds = Item::query()->inRandomOrder()->limit(30)->pluck('id');

        Dynasty::factory()->count(10)->create()->each(function (Dynasty $dynasty) use ($languageId, $itemIds): void {
            if (is_string($languageId)) {
                DynastyTranslation::factory()
                    ->forLanguage($languageId)
                    ->create(['dynasty_id' => $dynasty->id]);
            }

            if ($itemIds->isNotEmpty()) {
                $dynasty->items()->attach($itemIds->random(min(3, $itemIds->count()))->all());
            }
        });
    }
}
