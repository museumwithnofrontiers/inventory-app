<?php

namespace Database\Seeders;

use App\Models\Publication;
use App\Models\PublicationImage;
use Illuminate\Database\Seeder;

class PublicationImageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $publications = Publication::inRandomOrder()->limit(5)->get();

        foreach ($publications as $publication) {
            // A cover, then a few sample pages, in order
            PublicationImage::factory()
                ->forPublication($publication)
                ->cover()
                ->withOrder(1)
                ->create();

            $pageCount = rand(1, 3);
            for ($i = 2; $i <= $pageCount + 1; $i++) {
                PublicationImage::factory()
                    ->forPublication($publication)
                    ->page()
                    ->withOrder($i)
                    ->create();
            }
        }
    }
}
