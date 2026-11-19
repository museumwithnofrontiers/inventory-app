<?php

namespace Database\Seeders;

use App\Models\Partner;
use App\Models\PartnerContact;
use Illuminate\Database\Seeder;

/**
 * One or two contact persons (M16 D2) for some seeded partners.
 */
class PartnerContactSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (Partner::query()->inRandomOrder()->limit(8)->get() as $partner) {
            PartnerContact::factory()->forPartner($partner, 1)->create();
            if (fake()->boolean(40)) {
                PartnerContact::factory()->forPartner($partner, 2)->create();
            }
        }
    }
}
