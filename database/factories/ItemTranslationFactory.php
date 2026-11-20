<?php

namespace Database\Factories;

use App\Models\Author;
use App\Models\Context;
use App\Models\Item;
use App\Models\ItemTranslation;
use App\Models\Language;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ItemTranslation>
 */
class ItemTranslationFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = ItemTranslation::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'item_id' => Item::factory(),
            'language_id' => Language::factory(),
            'context_id' => Context::factory(),
            'name' => $this->faker->words(3, true),
            'alternate_name' => $this->faker->optional()->words(3, true),
            'description' => $this->faker->paragraph,
            'short_description' => $this->faker->optional()->sentence,
            'type' => $this->faker->optional()->randomElement(['archaeological', 'historical', 'artistic', 'cultural']),
            'holder' => $this->faker->optional()->company,
            'owner' => $this->faker->optional()->company,
            'initial_owner' => $this->faker->optional()->company,
            'dates' => $this->faker->optional()->sentence,
            'location' => $this->faker->optional()->address,
            'region' => $this->faker->optional()->state,
            'dimensions' => $this->faker->optional()->sentence,
            'materials' => $this->faker->optional()->words(3, true),
            'dynasty' => $this->faker->optional()->word,
            'place_of_production' => $this->faker->optional()->city,
            'method_for_datation' => $this->faker->optional()->sentence,
            'method_for_provenance' => $this->faker->optional()->sentence,
            'provenance' => $this->faker->optional()->company,
            'obtention' => $this->faker->optional()->sentence,
            'bibliography' => $this->faker->optional()->paragraph,
            'history' => $this->faker->optional()->paragraph,
            'author_id' => $this->faker->optional()->randomElement([Author::factory(), null]),
            'text_copy_editor_id' => $this->faker->optional()->randomElement([Author::factory(), null]),
            'translator_id' => $this->faker->optional()->randomElement([Author::factory(), null]),
            'translation_copy_editor_id' => $this->faker->optional()->randomElement([Author::factory(), null]),
            'author_credit' => $this->faker->optional()->name,
            'copy_editor_credit' => $this->faker->optional()->name,
            'translator_credit' => $this->faker->optional()->name,
            'translation_copy_editor_credit' => $this->faker->optional()->name,
            'keywords' => $this->faker->optional()->words(3, true),
            'artist' => $this->faker->optional()->name,
            'artist_period_of_activity' => $this->faker->optional()->century,
            'artist_birth_date' => $this->faker->optional()->year,
            'artist_birth_place' => $this->faker->optional()->city,
            'artist_death_date' => $this->faker->optional()->year,
            'artist_death_place' => $this->faker->optional()->city,
            'workshop' => $this->faker->optional()->company,
            'scribe' => $this->faker->optional()->name,
            'patrons' => $this->faker->optional()->name,
            'architects' => $this->faker->optional()->name,
            'status' => 'published',
            'catalogue_references' => $this->faker->optional()->sentence,
            'notice' => $this->faker->optional()->sentence,
            'external_notice' => $this->faker->optional()->sentence,
            'image_rights' => $this->faker->optional()->company,
            'external_sources' => null,
            'original_name' => null,
            'holder_original_name' => null,
            'archival_reference' => null,
            'extra' => $this->faker->optional()->passthrough(
                json_encode($this->faker->randomElements(['key1' => 'value1', 'key2' => 'value2'], null, false))
            ),
        ];
    }

    /**
     * Create a translation with default context.
     */
    public function defaultContext(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'context_id' => Context::factory()->default(),
            ];
        });
    }

    /**
     * Create a translation with default context.
     */
    public function withDefaultContext(): static
    {
        return $this->state(function (array $attributes) {
            $defaultContext = Context::default()->first();

            return [
                'context_id' => $defaultContext ? $defaultContext->id : Context::factory()->default(),
            ];
        });
    }

    /**
     * Create a translation without creating translations for the parent item.
     */
    public function withoutItemTranslations(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'item_id' => Item::factory()->withoutTranslations(),
            ];
        });
    }

    /**
     * Create a translation with specific language.
     */
    public function forLanguage(string $languageId): static
    {
        return $this->state(function (array $attributes) use ($languageId) {
            return [
                'language_id' => $languageId,
            ];
        });
    }

    /**
     * Create a translation with specific context.
     */
    public function forContext(string $contextId): static
    {
        return $this->state(function (array $attributes) use ($contextId) {
            return [
                'context_id' => $contextId,
            ];
        });
    }

    /**
     * Create a translation for a specific item.
     */
    public function forItem(string $itemId): static
    {
        return $this->state(function (array $attributes) use ($itemId) {
            return [
                'item_id' => $itemId,
            ];
        });
    }

    /**
     * Create a translation with all author fields filled.
     */
    public function withAllAuthors(): static
    {
        return $this->state(function (array $attributes) {
            return [
                'author_id' => Author::factory(),
                'text_copy_editor_id' => Author::factory(),
                'translator_id' => Author::factory(),
                'translation_copy_editor_id' => Author::factory(),
            ];
        });
    }
}
