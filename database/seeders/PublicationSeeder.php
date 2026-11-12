<?php

namespace Database\Seeders;

use App\Enums\PublicationCategory;
use App\Enums\PublicationFormat;
use App\Enums\PublicationStatus;
use App\Models\Collection;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Project;
use App\Models\Publication;
use App\Models\Tag;
use Illuminate\Database\Seeder;

/**
 * Sample publications with a translation in the default language and
 * context, one edition each, and links to a few collections, items and
 * tags when the database has some.
 */
class PublicationSeeder extends Seeder
{
    public function run(): void
    {
        $defaultLanguage = Language::where('is_default', true)->first();
        $defaultContext = Context::where('is_default', true)->first();

        if (! $defaultLanguage || ! $defaultContext) {
            $this->command->info('Skipping PublicationSeeder: Default language or context not found');

            return;
        }

        $samples = [
            [
                'internal_name' => 'sample_exhibition_trail_guide',
                'category' => PublicationCategory::EXHIBITION_TRAIL,
                'status' => PublicationStatus::PUBLISHED,
                'title' => 'Sample Exhibition Trail Guide',
                'subtitle' => 'A walk through the monuments of one region',
                'format' => PublicationFormat::PRINT,
            ],
            [
                'internal_name' => 'sample_educational_guide',
                'category' => PublicationCategory::EDUCATIONAL,
                'status' => PublicationStatus::IN_PREPARATION,
                'title' => 'Sample Educational Guide',
                'subtitle' => null,
                'format' => PublicationFormat::EBOOK,
            ],
        ];

        $project = Project::query()->first();

        foreach ($samples as $index => $sample) {
            $publication = Publication::firstOrCreate(
                ['internal_name' => $sample['internal_name']],
                [
                    'category' => $sample['category'],
                    'status' => $sample['status'],
                    'project_id' => $project?->id,
                    'language_id' => $defaultLanguage->id,
                    'display_order' => $index + 1,
                ]
            );

            $publication->translations()->firstOrCreate(
                ['language_id' => $defaultLanguage->id, 'context_id' => $defaultContext->id],
                ['title' => $sample['title'], 'subtitle' => $sample['subtitle']]
            );

            $publication->editions()->firstOrCreate(
                ['language_id' => $defaultLanguage->id, 'format' => $sample['format'], 'edition' => 1],
                ['publisher' => 'Museum With No Frontiers', 'visible' => true, 'display_order' => 1]
            );

            $publication->collections()->syncWithoutDetaching(Collection::query()->limit(1)->pluck('id')->all());
            $publication->items()->syncWithoutDetaching(Item::query()->limit(2)->pluck('id')->all());
            $publication->tags()->syncWithoutDetaching(Tag::query()->limit(2)->pluck('id')->all());
        }
    }
}
