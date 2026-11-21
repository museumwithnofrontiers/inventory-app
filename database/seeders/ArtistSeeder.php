<?php

namespace Database\Seeders;

use App\Models\Artist;
use App\Models\Item;
use Illuminate\Database\Seeder;

class ArtistSeeder extends Seeder
{
    /**
     * Run the database seeds: a few artists, each linked to up to three of
     * the seeded items.
     */
    public function run(): void
    {
        $itemIds = Item::query()->inRandomOrder()->limit(30)->pluck('id');

        Artist::factory()->count(10)->create()->each(function (Artist $artist) use ($itemIds): void {
            if ($itemIds->isNotEmpty()) {
                $artist->items()->attach($itemIds->random(min(3, $itemIds->count()))->all());
            }
        });
    }
}
