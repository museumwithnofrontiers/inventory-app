<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {

        $this->call([
            RolePermissionSeeder::class,
            UserSeeder::class,
            LanguageSeeder::class,
            CountrySeeder::class,
            ContextSeeder::class,
            ProjectSeeder::class,
            TagSeeder::class,
            PartnerSeeder::class,
            ItemSeeder::class,
            ItemTagSeeder::class,
            ItemImageSeeder::class,
            CollectionSeeder::class,
            PublicationSeeder::class,
            ItemTranslationSeeder::class,
            ImageUploadSeeder::class,
            AvailableImageSeeder::class,
            AuthorSeeder::class,
            MapTagSeeder::class,
        ]);
    }
}
