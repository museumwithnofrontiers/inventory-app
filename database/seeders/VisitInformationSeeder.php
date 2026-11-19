<?php

namespace Database\Seeders;

use App\Enums\ItemType;
use App\Models\Context;
use App\Models\Item;
use App\Models\Language;
use App\Models\Partner;
use App\Models\VisitInformation;
use Illuminate\Database\Seeder;

/**
 * Visit information (M16 D1) for some seeded monuments and partners, in the
 * default language and context.
 */
class VisitInformationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $language = Language::default()->first();
        $context = Context::default()->first();
        if ($language === null || $context === null) {
            return;
        }

        $monuments = Item::query()->where('type', ItemType::MONUMENT)->inRandomOrder()->limit(10)->get();
        foreach ($monuments as $monument) {
            VisitInformation::factory()
                ->forItem($monument)
                ->state(['language_id' => $language->id, 'context_id' => $context->id])
                ->create();
        }

        foreach (Partner::query()->inRandomOrder()->limit(5)->get() as $partner) {
            VisitInformation::factory()
                ->forPartner($partner)
                ->state(['language_id' => $language->id, 'context_id' => $context->id])
                ->create();
        }
    }
}
