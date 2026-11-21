<?php

namespace Database\Seeders;

use App\Models\Language;
use App\Models\Project;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
    /**
     * Run the database seeds: the projects, each with its name in the
     * default language.
     */
    public function run(): void
    {
        $projects = [
            ['backward_compatibility' => 'BAR,AMA', 'internal_name' => 'Discover Baroque Art', 'is_launched' => true, 'is_enabled' => true],
            ['backward_compatibility' => 'ISL,EPM', 'internal_name' => 'Discover Islamic Art', 'is_launched' => true, 'is_enabled' => true],
            ['backward_compatibility' => 'AWE', 'internal_name' => 'Sharing History', 'is_launched' => true, 'is_enabled' => true],
            ['backward_compatibility' => null, 'internal_name' => 'Explore', 'is_launched' => true, 'is_enabled' => true],
            ['backward_compatibility' => null, 'internal_name' => 'Travels', 'is_launched' => true, 'is_enabled' => true],
        ];

        $languageId = Language::default()->value('id') ?? Language::query()->value('id');

        foreach ($projects as $data) {
            $project = Project::create($data);

            if (is_string($languageId)) {
                $project->translations()->create([
                    'language_id' => $languageId,
                    'name' => $data['internal_name'],
                ]);
            }
        }
    }
}
