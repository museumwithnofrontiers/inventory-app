<?php

namespace Database\Seeders;

use App\Models\PublicationDocument;
use App\Models\PublicationEdition;
use Illuminate\Database\Seeder;

/**
 * A sample and a credits PDF row for a few editions. Rows only, like the
 * other document seeders: no file is written to the documents disk.
 */
class PublicationDocumentSeeder extends Seeder
{
    public function run(): void
    {
        $editions = PublicationEdition::inRandomOrder()->limit(5)->get();

        foreach ($editions as $edition) {
            PublicationDocument::factory()->forEdition($edition)->sample()->withOrder(1)->create();
            PublicationDocument::factory()->forEdition($edition)->credits()->withOrder(2)->create();
        }
    }
}
