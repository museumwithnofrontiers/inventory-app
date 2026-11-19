<?php

namespace Database\Seeders;

use App\Enums\LinkType;
use App\Models\Collection;
use App\Models\Item;
use App\Models\Link;
use App\Models\Partner;
use Illuminate\Database\Seeder;

/**
 * A few links of each owner kind: videos on items, documents on collections,
 * websites on partners.
 */
class LinkSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Item::inRandomOrder()->limit(5)->get() as $item) {
            Link::factory()->ownedBy($item)->ofType(LinkType::VIDEO)->create();
        }
        foreach (Collection::inRandomOrder()->limit(3)->get() as $collection) {
            Link::factory()->ownedBy($collection)->ofType(LinkType::DOCUMENT)->create();
        }
        foreach (Partner::inRandomOrder()->limit(5)->get() as $partner) {
            Link::factory()->ownedBy($partner)->ofType(LinkType::WEBSITE)->create();
        }
    }
}
