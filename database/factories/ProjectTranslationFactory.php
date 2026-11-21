<?php

namespace Database\Factories;

use App\Models\Language;
use App\Models\Project;
use App\Models\ProjectTranslation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectTranslation>
 */
class ProjectTranslationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'language_id' => Language::factory(),
            'name' => $this->faker->words(3, true),
        ];
    }

    /**
     * A name in this language.
     */
    public function forLanguage(string $languageId): static
    {
        return $this->state(fn (array $attributes): array => [
            'language_id' => $languageId,
        ]);
    }
}
