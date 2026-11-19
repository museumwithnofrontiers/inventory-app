<?php

namespace Database\Seeders;

use App\Models\CollectionItem;
use App\Models\CollectionItemExploreMonument;
use Illuminate\Database\Seeder;

/**
 * An Explore monument for a few placements.
 */
class CollectionItemExploreMonumentSeeder extends Seeder
{
    public function run(): void
    {
        foreach (CollectionItem::query()->inRandomOrder()->limit(3)->get() as $placement) {
            CollectionItemExploreMonument::factory()->forPlacement($placement)->create();
        }
    }
}
