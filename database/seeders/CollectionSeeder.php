<?php

namespace Database\Seeders;

use App\Enums\CollectionPartnerType;
use App\Enums\PartnerLevel;
use App\Models\Collection;
use App\Models\CollectionTranslation;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use Illuminate\Database\Seeder;

class CollectionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get default language and context
        $defaultLanguage = Language::where('is_default', true)->first();
        $defaultContext = Context::where('is_default', true)->first();

        if (! $defaultLanguage || ! $defaultContext) {
            $this->command->info('Skipping CollectionSeeder: Default language or context not found');

            return;
        }

        // Create sample collections
        $collections = [
            [
                'internal_name' => 'ancient_artifacts',
                'translations' => [
                    'title' => 'Ancient Artifacts Collection',
                    'description' => 'A comprehensive collection of ancient artifacts from various civilizations, showcasing the rich cultural heritage and craftsmanship of our ancestors.',
                    'url' => 'https://museum.example.com/collections/ancient-artifacts',
                ],
            ],
            [
                'internal_name' => 'medieval_art',
                'translations' => [
                    'title' => 'Medieval Art Collection',
                    'description' => 'An exquisite collection of medieval artworks including paintings, sculptures, and decorative objects from the Middle Ages.',
                    'url' => null,
                ],
            ],
            [
                'internal_name' => 'contemporary_works',
                'translations' => [
                    'title' => 'Contemporary Works',
                    'description' => 'A dynamic collection featuring contemporary artworks and modern installations by emerging and established artists.',
                    'url' => 'https://museum.example.com/collections/contemporary',
                ],
            ],
        ];

        foreach ($collections as $collectionData) {
            // Create the collection
            $collection = Collection::create([
                'internal_name' => $collectionData['internal_name'],
                'language_id' => $defaultLanguage->id,
                'context_id' => $defaultContext->id,
            ]);

            // Create translation
            CollectionTranslation::create([
                'collection_id' => $collection->id,
                'language_id' => $defaultLanguage->id,
                'context_id' => $defaultContext->id,
                'title' => $collectionData['translations']['title'],
                'description' => $collectionData['translations']['description'],
                'url' => $collectionData['translations']['url'],
            ]);

            // Attach some random partners with different levels
            $partners = Partner::take(3)->get();
            if ($partners->count() > 0) {
                $levels = [PartnerLevel::PARTNER, PartnerLevel::ASSOCIATED_PARTNER, PartnerLevel::MINOR_CONTRIBUTOR];

                foreach ($partners as $index => $partner) {
                    $collection->partners()->attach($partner->id, [
                        'collection_type' => CollectionPartnerType::COLLECTION->value,
                        'level' => $levels[$index % count($levels)]->value,
                    ]);
                }
            }

            // Assign some random items to this collection
            $availableItems = Item::whereNull('collection_id')->take(rand(3, 8))->get();
            foreach ($availableItems as $item) {
                $item->update(['collection_id' => $collection->id]);
            }
        }
    }
}
